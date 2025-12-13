"""Main application entry point and orchestration."""
import asyncio
import os
from datetime import datetime
from typing import Optional, List, Tuple

import uvicorn

from .config import settings
from .api.server import app
from .api.routes import set_account_info, set_live_positions, set_copier
from .database import supabase_crud as crud
from .database.supabase import get_settings as get_db_settings, get_system_config, SYSTEM_USER_ID, get_supabase_admin
from .telegram.listener import TelegramListener
from .telegram.client import TelegramConfigError
from .parser.llm_parser import SignalParser
from .trading.validator import TradeValidator
from .trading.executor import TradeExecutor
from .utils.events import event_bus, Events
from .utils.logger import log

# Multi-tenant imports
from .users.manager import user_manager
from .signal_router import signal_router

# Plan limits imports
from .api.plans_routes import check_signal_limit, increment_signal_count


class ConfigurationError(Exception):
    """Raised when system is not properly configured."""
    pass


def get_active_user_settings() -> dict:
    """Get settings for the active/admin user.

    In multi-tenant mode, each user has their own settings. For now,
    this returns the first admin user's settings, falling back to defaults.

    TODO: In full multi-tenant mode, this should use signal_router to
    determine which user a signal belongs to based on channel subscriptions.
    """
    try:
        supabase = get_supabase_admin()

        # Get the admin user's ID
        result = supabase.table("profiles").select("id").eq("role", "admin").limit(1).execute()

        if result.data and len(result.data) > 0:
            admin_id = result.data[0]["id"]
            return get_db_settings(admin_id)

        # Fallback: try to get any active user
        result = supabase.table("profiles").select("id").eq("status", "active").limit(1).execute()
        if result.data and len(result.data) > 0:
            user_id = result.data[0]["id"]
            return get_db_settings(user_id)

    except Exception as e:
        log.warning("Could not get active user settings", error=str(e))

    # Return defaults if no user found
    return {
        "paused": False,
        "auto_accept_symbols": ["XAUUSD", "GOLD"],
        "max_risk_percent": 2.0,
        "max_lot_size": 0.1,
        "max_open_trades": 5,
        "lot_reference_balance": 500.0,
        "lot_reference_size_gold": 0.04,
        "lot_reference_size_default": 0.01,
        "gold_market_threshold": 3.0,
        "split_tps": True,
        "tp_split_ratios": [0.5, 0.3, 0.2],
        "enable_breakeven": True,
        "symbol_suffix": "",
        "telegram_channel_ids": [],
    }


def check_system_config() -> Tuple[bool, List[str]]:
    """Check if system configuration is complete.

    Checks both system_config (global settings) and user_credentials (per-user).

    Returns:
        Tuple of (is_configured, list of missing/issues)
    """
    config = get_system_config()
    issues = []

    # Check Anthropic API key (global in system_config)
    if not config.get("anthropic_api_key"):
        issues.append("Anthropic API Key not set")

    # Check MetaApi token (global in system_config)
    if not config.get("metaapi_token"):
        issues.append("MetaApi Token not set")

    # For Telegram and MetaApi account - check user_credentials for admin user
    try:
        supabase = get_supabase_admin()
        admin_result = supabase.table("profiles").select("id").eq("role", "admin").limit(1).execute()

        if admin_result.data:
            admin_id = admin_result.data[0]["id"]
            creds_result = supabase.table("user_credentials").select("*").eq("user_id", admin_id).execute()

            if creds_result.data:
                creds = creds_result.data[0]

                # Check MetaApi account (per-user in user_credentials)
                if not creds.get("metaapi_account_id"):
                    issues.append("MetaApi Account ID not set")

                # Check Telegram credentials (per-user in user_credentials)
                if not creds.get("telegram_api_id"):
                    issues.append("Telegram API ID not set")
                if not creds.get("telegram_api_hash"):
                    issues.append("Telegram API Hash not set")
                if not creds.get("telegram_phone"):
                    issues.append("Telegram Phone not set")

                # Check channels (per-user in user_settings_v2)
                settings_result = supabase.table("user_settings_v2").select("telegram_channel_ids").eq("user_id", admin_id).execute()
                if not settings_result.data or not settings_result.data[0].get("telegram_channel_ids"):
                    issues.append("No Telegram channels configured (signals won't be received)")
            else:
                issues.append("Admin user credentials not configured")
        else:
            issues.append("No admin user found")

    except Exception as e:
        log.warning(f"Error checking user credentials: {e}")
        issues.append("Could not check user credentials")

    return len(issues) == 0 or (len(issues) == 1 and "channels" in issues[0].lower()), issues


class SignalCopier:
    """Main signal copier orchestration class."""

    def __init__(self):
        self.telegram = TelegramListener()
        self.parser = SignalParser()
        self.executor = TradeExecutor()
        self.validator: Optional[TradeValidator] = None
        self._account_update_task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the signal copier."""
        log.info("Starting Signal Copier")

        # Set copier reference FIRST so API routes work even if MetaAPI fails
        set_copier(self)

        # Connect to MetaApi (optional - may fail in multi-tenant if no default account)
        try:
            await self.executor.connect()
            self.validator = TradeValidator(self.executor.connection)
            log.info("MetaApi connected successfully")

            # Start account info updater (only if connected)
            self._account_update_task = asyncio.create_task(self._update_account_loop())
        except Exception as e:
            log.warning("MetaApi connection skipped (multi-tenant mode)", error=str(e))
            log.info("Account info will be fetched per-user from API endpoints")

        # Start Telegram listener (this blocks)
        await self.telegram.start(self.on_message)

    async def on_message(self, message: dict):
        """Handle incoming Telegram message.

        Args:
            message: Dict with text, channel_name, channel_id, message_id, date.
        """
        text = message.get("text", "")
        channel_name = message.get("channel_name", "Unknown")

        # Log every message received for debugging
        log.info("Message received from Telegram",
                 channel=channel_name,
                 length=len(text) if text else 0,
                 preview=text[:30] if text else "")

        # Get user settings from database (reads from admin/active user for now)
        db_settings = get_active_user_settings()

        # Check if paused
        if db_settings.get("paused", False):
            log.info("Processing paused, skipping message")
            return

        if not text or len(text) < 10:
            log.debug("Message too short, skipping", length=len(text) if text else 0)
            return

        log.info("Processing signal message", channel=channel_name, preview=text[:50])

        # Create signal record (returns None if duplicate message)
        signal = await crud.create_signal(
            raw_message=text,
            channel_name=channel_name,
            channel_id=message.get("channel_id"),
            message_id=message.get("message_id"),
        )
        
        # Skip if duplicate message already processed
        if not signal:
            log.debug("Duplicate message detected, skipping", 
                     channel=channel_name, message_id=message.get("message_id"))
            return
        
        signal_id = signal["id"]

        await event_bus.emit(
            Events.SIGNAL_RECEIVED,
            {
                "id": signal_id,
                "channel": channel_name,
                "preview": text[:100],
            },
        )

        # Parse signal
        parsed = await self.parser.parse(text)

        # Check if parser rejected the signal (is_signal=false) or returned nothing
        is_rejected = (
            not parsed or
            (hasattr(parsed, 'is_signal') and not parsed.is_signal)
        )

        if is_rejected:
            # Extract details from parsed result if available
            rejection_reason = getattr(parsed, 'rejection_reason', None) or "Not a valid trade signal"
            suggested = getattr(parsed, 'suggested_correction', None)
            direction = getattr(parsed, 'direction', None)
            symbol = getattr(parsed, 'symbol', None)
            entry_price = getattr(parsed, 'entry_price', None)
            stop_loss = getattr(parsed, 'stop_loss', None)
            take_profits = getattr(parsed, 'take_profits', None) or []
            warnings = getattr(parsed, 'warnings', []) or []

            if suggested:
                warnings = warnings + [f"Suggested correction: Change to {suggested}"]

            await crud.update_signal(
                signal_id,
                status="skipped",
                failure_reason=rejection_reason,
                # Store extracted data even for rejected signals so user can see what was parsed
                direction=direction,
                symbol=symbol,
                entry_price=entry_price,
                stop_loss=stop_loss,
                take_profits=take_profits,
                warnings=warnings,
            )

            await event_bus.emit(
                Events.SIGNAL_SKIPPED,
                {
                    "id": signal_id,
                    "reason": rejection_reason,
                    "suggested_correction": suggested,
                    "symbol": symbol,
                    "direction": direction,
                },
            )
            log.debug(
                "Signal skipped",
                signal_id=signal_id,
                reason=rejection_reason,
                suggested=suggested,
            )
            return

        # Check if this is a CLOSE signal
        signal_type = getattr(parsed, 'signal_type', 'OPEN')
        if signal_type == "CLOSE":
            await self._handle_close_signal(signal_id, parsed)
            return

        # Check if this is a LOT_MODIFIER signal
        if signal_type == "LOT_MODIFIER":
            await self._handle_lot_modifier_signal(signal_id, parsed)
            return

        # Update signal with parsed data (for OPEN signals)
        await crud.update_signal(
            signal_id,
            direction=parsed.direction,
            symbol=parsed.symbol,
            entry_price=parsed.entry_price,
            stop_loss=parsed.stop_loss,
            take_profits=parsed.take_profits,
            confidence=parsed.confidence,
            warnings=parsed.warnings,
            status="parsed",
            parsed_at=datetime.utcnow().isoformat(),
        )

        await event_bus.emit(
            Events.SIGNAL_PARSED,
            {
                "id": signal_id,
                "symbol": parsed.symbol,
                "direction": parsed.direction,
                "entry": parsed.entry_price,
                "sl": parsed.stop_loss,
                "tps": parsed.take_profits,
                "confidence": parsed.confidence,
                "warnings": parsed.warnings,
            },
        )

        log.info(
            "Signal parsed",
            signal_id=signal_id,
            symbol=parsed.symbol,
            direction=parsed.direction,
            confidence=parsed.confidence,
        )

        # Validate
        try:
            account_info = await self.executor.get_account_info()
        except Exception as e:
            log.error("Failed to get account info", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Account info error: {str(e)}",
            )
            await event_bus.emit(
                Events.SIGNAL_FAILED,
                {"id": signal_id, "errors": [str(e)]},
            )
            return

        validation = await self.validator.validate(parsed, account_info)

        await event_bus.emit(
            Events.SIGNAL_VALIDATED,
            {
                "id": signal_id,
                "passed": validation.passed,
                "errors": validation.errors,
                "warnings": validation.warnings,
            },
        )

        if not validation.passed:
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="; ".join(validation.errors),
            )

            await event_bus.emit(
                Events.SIGNAL_FAILED,
                {"id": signal_id, "errors": validation.errors},
            )

            log.warning(
                "Signal validation failed",
                signal_id=signal_id,
                errors=validation.errors,
            )
            return

        # Check if this symbol requires confirmation or auto-executes
        # Use settings from database instead of static config
        symbol_upper = parsed.symbol.upper()
        auto_accept_list = db_settings.get("auto_accept_symbols", ["XAUUSD", "GOLD"])
        # Normalize auto_accept_list to uppercase strings
        if isinstance(auto_accept_list, list):
            auto_accept_list = [s.upper() if isinstance(s, str) else str(s).upper() for s in auto_accept_list]
        is_auto_accept = symbol_upper in auto_accept_list

        # Get default lot size from database settings
        default_lot_size = float(db_settings.get("lot_reference_size_default", 0.01))

        if not is_auto_accept:
            # Requires manual confirmation - save and wait
            await crud.update_signal(
                signal_id,
                status="pending_confirmation",
                # Store the adjusted lot size for when user confirms
                warnings=(parsed.warnings or []) + [
                    f"Awaiting confirmation (lot size: {validation.adjusted_lot_size or default_lot_size})"
                ],
            )

            await event_bus.emit(
                Events.SIGNAL_PENDING_CONFIRMATION,
                {
                    "id": signal_id,
                    "symbol": parsed.symbol,
                    "direction": parsed.direction,
                    "entry": parsed.entry_price,
                    "sl": parsed.stop_loss,
                    "tps": parsed.take_profits,
                    "lot_size": validation.adjusted_lot_size or default_lot_size,
                },
            )

            log.info(
                "Signal awaiting confirmation",
                signal_id=signal_id,
                symbol=parsed.symbol,
                direction=parsed.direction,
            )
            return

        # Auto-accept: Execute trades immediately
        lot_size = validation.adjusted_lot_size or default_lot_size

        try:
            executions = await self.executor.execute(parsed, lot_size)
        except Exception as e:
            log.error("Trade execution error", error=str(e), signal_id=signal_id)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Execution error: {str(e)}",
            )
            await event_bus.emit(
                Events.SIGNAL_FAILED,
                {"id": signal_id, "errors": [str(e)]},
            )
            return

        if not executions:
            error_msg = self.executor.last_error or "Order execution failed"
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=error_msg,
            )

            await event_bus.emit(
                Events.SIGNAL_FAILED,
                {"id": signal_id, "errors": [error_msg]},
            )
            return

        # Save trades
        await crud.update_signal(
            signal_id,
            status="executed",
            executed_at=datetime.utcnow().isoformat(),
        )

        for exe in executions:
            await crud.create_trade(
                signal_id=signal_id,
                order_id=exe.order_id,
                symbol=exe.symbol,
                direction=exe.direction,
                lot_size=exe.lot_size,
                entry_price=exe.entry_price,
                stop_loss=exe.stop_loss,
                take_profit=exe.take_profit,
                tp_index=exe.tp_index,
            )

        await event_bus.emit(
            Events.TRADE_OPENED,
            {
                "signal_id": signal_id,
                "symbol": parsed.symbol,
                "direction": parsed.direction,
                "trades": len(executions),
                "lot_size": lot_size,
            },
        )

        log.info(
            "Signal executed successfully",
            signal_id=signal_id,
            symbol=parsed.symbol,
            direction=parsed.direction,
            trades=len(executions),
            lot_size=lot_size,
        )

    async def confirm_signal(self, signal_id: int, lot_size_override: Optional[float] = None) -> bool:
        """Confirm and execute a pending signal.

        Args:
            signal_id: Database signal ID.
            lot_size_override: Optional lot size override from user selection.

        Returns:
            True if execution succeeded, False otherwise.
        """
        log.info("Confirming signal", signal_id=signal_id, lot_size_override=lot_size_override)

        # Get signal from database
        signal = await crud.get_signal(signal_id)

        if not signal:
            log.error("Signal not found for confirmation", signal_id=signal_id)
            return False

        if signal.get("status") != "pending_confirmation":
            log.error("Signal not pending confirmation", signal_id=signal_id, status=signal.get("status"))
            return False

        # Check we have the required fields
        if not signal.get("symbol") or not signal.get("entry_price") or not signal.get("stop_loss") or not signal.get("direction"):
            log.error("Signal missing required fields", signal_id=signal_id)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="Missing required fields",
            )
            return False

        take_profits = signal.get("take_profits") or []
        if not take_profits:
            log.error("Signal has no take profits", signal_id=signal_id)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="No take profit levels defined",
            )
            return False

        # Create a ParsedSignal-like object
        class ConfirmedSignal:
            pass

        parsed = ConfirmedSignal()
        parsed.direction = signal.get("direction")
        parsed.symbol = signal.get("symbol")
        parsed.entry_price = signal.get("entry_price")
        parsed.stop_loss = signal.get("stop_loss")
        parsed.take_profits = take_profits
        parsed.confidence = signal.get("confidence") or 0.8
        parsed.warnings = ["Manually confirmed"]

        # Get settings from database
        db_settings = get_active_user_settings()
        default_lot_size = float(db_settings.get("lot_reference_size_default", 0.01))
        max_lot_size = float(db_settings.get("max_lot_size", 0.1))

        # Get lot size: use override if provided, otherwise extract from warnings or use default
        if lot_size_override is not None and lot_size_override > 0:
            lot_size = lot_size_override
        else:
            lot_size = default_lot_size
            for warning in (signal.get("warnings") or []):
                if "lot size:" in warning.lower():
                    try:
                        lot_size = float(warning.split("lot size:")[1].strip().rstrip(")"))
                    except:
                        pass

        # Ensure lot size is within bounds
        lot_size = max(0.01, min(lot_size, max_lot_size))

        # Check plan limits before executing (legacy single-user mode)
        limit_check = await check_signal_limit(SYSTEM_USER_ID)
        if not limit_check.get("allowed", True):
            log.warning("Signal blocked by plan limit", signal_id=signal_id)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=limit_check.get("message", "Daily signal limit reached"),
            )
            return False

        # Execute
        try:
            executions = await self.executor.execute(parsed, lot_size)
        except Exception as e:
            log.error("Confirmed signal execution error", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Execution error: {str(e)}",
            )
            return False

        if not executions:
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=self.executor.last_error or "Order execution failed",
            )
            return False

        # Save trades
        await crud.update_signal(
            signal_id,
            status="executed",
            executed_at=datetime.utcnow().isoformat(),
        )

        for exe in executions:
            await crud.create_trade(
                signal_id=signal_id,
                order_id=exe.order_id,
                symbol=exe.symbol,
                direction=exe.direction,
                lot_size=exe.lot_size,
                entry_price=exe.entry_price,
                stop_loss=exe.stop_loss,
                take_profit=exe.take_profit,
                tp_index=exe.tp_index,
            )

        # Increment daily signal count after successful execution (legacy single-user mode)
        await increment_signal_count(SYSTEM_USER_ID)

        await event_bus.emit(
            Events.TRADE_OPENED,
            {
                "signal_id": signal_id,
                "symbol": parsed.symbol,
                "direction": parsed.direction,
                "trades": len(executions),
                "lot_size": lot_size,
                "confirmed": True,
            },
        )

        log.info(
            "Confirmed signal executed successfully",
            signal_id=signal_id,
            symbol=parsed.symbol,
            direction=parsed.direction,
            trades=len(executions),
        )

        return True

    async def reject_signal(self, signal_id: int, reason: str = "Manually rejected") -> bool:
        """Reject a pending signal.

        Args:
            signal_id: Database signal ID.
            reason: Rejection reason.

        Returns:
            True if rejection succeeded, False otherwise.
        """
        log.info("Rejecting signal", signal_id=signal_id, reason=reason)

        signal = await crud.get_signal(signal_id)

        if not signal:
            log.error("Signal not found for rejection", signal_id=signal_id)
            return False

        if signal.get("status") != "pending_confirmation":
            log.error("Signal not pending confirmation", signal_id=signal_id, status=signal.get("status"))
            return False

        await crud.update_signal(
            signal_id,
            status="rejected",
            failure_reason=reason,
        )

        await event_bus.emit(
            Events.SIGNAL_SKIPPED,
            {"id": signal_id, "reason": reason},
        )

        return True

    async def execute_corrected_signal(self, signal_id: int, direction: str) -> bool:
        """Execute a corrected signal with the specified direction.

        Args:
            signal_id: Database signal ID.
            direction: Corrected direction (BUY or SELL).

        Returns:
            True if execution succeeded, False otherwise.
        """
        log.info("Executing corrected signal", signal_id=signal_id, direction=direction)

        # Get signal from database
        signal = await crud.get_signal(signal_id)

        if not signal:
            log.error("Signal not found for correction", signal_id=signal_id)
            return False

        # Check we have the required fields
        if not signal.get("symbol") or not signal.get("entry_price") or not signal.get("stop_loss"):
            log.error("Signal missing required fields", signal_id=signal_id)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="Missing required fields (symbol, entry, or SL)",
            )
            return False

        take_profits = signal.get("take_profits") or []
        if not take_profits:
            log.error("Signal has no take profits", signal_id=signal_id)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="No take profit levels defined",
            )
            return False

        # Create a ParsedSignal-like object
        class CorrectedSignal:
            pass

        parsed = CorrectedSignal()
        parsed.direction = direction
        parsed.symbol = signal.get("symbol")
        parsed.entry_price = signal.get("entry_price")
        parsed.stop_loss = signal.get("stop_loss")
        parsed.take_profits = take_profits
        parsed.confidence = signal.get("confidence") or 0.8
        parsed.warnings = ["Direction manually corrected"]

        # Validate
        try:
            account_info = await self.executor.get_account_info()
        except Exception as e:
            log.error("Failed to get account info for correction", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Account info error: {str(e)}",
            )
            return False

        validation = await self.validator.validate(parsed, account_info)

        if not validation.passed:
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="; ".join(validation.errors),
            )
            log.warning("Corrected signal validation failed", errors=validation.errors)
            return False

        # Get settings from database
        db_settings = get_active_user_settings()
        default_lot_size = float(db_settings.get("lot_reference_size_default", 0.01))

        # Execute
        lot_size = validation.adjusted_lot_size or default_lot_size

        try:
            executions = await self.executor.execute(parsed, lot_size)
        except Exception as e:
            log.error("Corrected signal execution error", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Execution error: {str(e)}",
            )
            return False

        if not executions:
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=self.executor.last_error or "Order execution failed",
            )
            return False

        # Save trades
        await crud.update_signal(
            signal_id,
            direction=direction,
            status="executed",
            executed_at=datetime.utcnow().isoformat(),
        )

        for exe in executions:
            await crud.create_trade(
                signal_id=signal_id,
                order_id=exe.order_id,
                symbol=exe.symbol,
                direction=exe.direction,
                lot_size=exe.lot_size,
                entry_price=exe.entry_price,
                stop_loss=exe.stop_loss,
                take_profit=exe.take_profit,
                tp_index=exe.tp_index,
            )

        await event_bus.emit(
            Events.TRADE_OPENED,
            {
                "signal_id": signal_id,
                "symbol": parsed.symbol,
                "direction": direction,
                "trades": len(executions),
                "lot_size": lot_size,
                "corrected": True,
            },
        )

        log.info(
            "Corrected signal executed successfully",
            signal_id=signal_id,
            symbol=parsed.symbol,
            direction=direction,
            trades=len(executions),
        )

        return True

    async def _handle_close_signal(self, signal_id: int, parsed):
        """Handle a CLOSE signal to exit positions.

        Args:
            signal_id: Database signal ID.
            parsed: Parsed signal with symbol to close.
        """
        symbol = parsed.symbol
        broker_symbol = symbol + settings.symbol_suffix

        log.info("Processing CLOSE signal", signal_id=signal_id, symbol=symbol)

        # Update signal record
        await crud.update_signal(
            signal_id,
            symbol=symbol,
            status="parsed",
            warnings=getattr(parsed, 'warnings', []),
            parsed_at=datetime.utcnow().isoformat(),
        )

        # Get current positions
        try:
            account_info = await self.executor.get_account_info()
            positions = account_info.get("positions", [])
        except Exception as e:
            log.error("Failed to get positions for close signal", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Could not fetch positions: {str(e)}",
            )
            return

        # Find matching positions
        matching = [
            p for p in positions
            if p.get("symbol", "").upper().replace(settings.symbol_suffix.upper(), "") == symbol.upper()
        ]

        if not matching:
            log.warning("No open positions found for symbol", symbol=symbol)
            await crud.update_signal(
                signal_id,
                status="skipped",
                failure_reason=f"No open positions found for {symbol}",
            )
            await event_bus.emit(
                Events.SIGNAL_SKIPPED,
                {"id": signal_id, "reason": f"No open positions for {symbol}"},
            )
            return

        # Close all matching positions
        closed_count = 0
        for pos in matching:
            position_id = pos.get("id") or pos.get("positionId")
            if position_id:
                try:
                    await self.executor.close_position(str(position_id))
                    closed_count += 1
                    log.info("Position closed", position_id=position_id, symbol=symbol)
                except Exception as e:
                    log.error("Failed to close position", position_id=position_id, error=str(e))

        # Update signal status
        if closed_count > 0:
            await crud.update_signal(
                signal_id,
                status="executed",
                executed_at=datetime.utcnow().isoformat(),
            )
        else:
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="Failed to close any positions",
            )

        await event_bus.emit(
            Events.TRADE_CLOSED,
            {
                "signal_id": signal_id,
                "symbol": symbol,
                "positions_closed": closed_count,
            },
        )

        log.info(
            "CLOSE signal processed",
            signal_id=signal_id,
            symbol=symbol,
            closed=closed_count,
        )

    async def _handle_lot_modifier_signal(self, signal_id: int, parsed):
        """Handle a LOT_MODIFIER signal to add to existing positions.

        Args:
            signal_id: Database signal ID.
            parsed: Parsed signal with modifier details.
        """
        target_symbol = getattr(parsed, 'target_symbol', None)
        multiplier = getattr(parsed, 'lot_multiplier', 1.0) or 1.0
        modifier_type = getattr(parsed, 'lot_modifier_type', 'ADD') or 'ADD'
        warnings = getattr(parsed, 'warnings', []) or []

        log.info(
            "Processing LOT_MODIFIER signal",
            signal_id=signal_id,
            target_symbol=target_symbol,
            modifier_type=modifier_type,
            multiplier=multiplier,
        )

        # If no target symbol, default to GOLD (most common for lot modifiers)
        if not target_symbol:
            target_symbol = "XAUUSD"

        # Normalize symbol aliases
        if target_symbol.upper() == "GOLD":
            target_symbol = "XAUUSD"

        broker_symbol = target_symbol + settings.symbol_suffix

        # Update signal record with parsed data
        await crud.update_signal(
            signal_id,
            symbol=target_symbol,
            status="parsed",
            warnings=warnings + [f"LOT_MODIFIER: {modifier_type} (x{multiplier})"],
            parsed_at=datetime.utcnow().isoformat(),
        )

        # Get current positions to find the matching trade
        try:
            account_info = await self.executor.get_account_info()
            positions = account_info.get("positions", [])
        except Exception as e:
            log.error("Failed to get positions for lot modifier", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Could not fetch positions: {str(e)}",
            )
            return

        # Find matching position
        matching = [
            p for p in positions
            if p.get("symbol", "").upper().replace(settings.symbol_suffix.upper(), "") == target_symbol.upper()
        ]

        if not matching:
            log.warning("No open positions found for lot modifier", symbol=target_symbol)
            await crud.update_signal(
                signal_id,
                status="skipped",
                failure_reason=f"No open {target_symbol} positions to modify",
            )
            await event_bus.emit(
                Events.SIGNAL_SKIPPED,
                {"id": signal_id, "reason": f"No open positions for {target_symbol}"},
            )
            return

        # Use the most recent position as reference
        ref_position = matching[-1]

        # Get position details
        original_lot = ref_position.get("volume", 0.01)
        position_type = ref_position.get("type", "").upper()
        stop_loss = ref_position.get("stopLoss")
        take_profit = ref_position.get("takeProfit")

        # Determine direction from position type
        if "BUY" in position_type:
            direction = "BUY"
        elif "SELL" in position_type:
            direction = "SELL"
        else:
            log.error("Could not determine position direction", position_type=position_type)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Unknown position type: {position_type}",
            )
            return

        # If no SL/TP on position, we can't proceed safely
        if not stop_loss:
            log.error("Reference position has no stop loss")
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="Reference position has no stop loss",
            )
            return

        if not take_profit:
            log.error("Reference position has no take profit")
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="Reference position has no take profit",
            )
            return

        # Calculate new lot size based on modifier type
        if modifier_type == "DOUBLE":
            # For double, we add another position of same size (effectively doubling total)
            new_lot_size = original_lot
        else:
            # For ADD or other, use multiplier
            new_lot_size = round(original_lot * multiplier, 2)

        # Get max lot size from database settings
        db_settings = get_active_user_settings()
        max_lot_size = float(db_settings.get("max_lot_size", 0.1))
        new_lot_size = max(0.01, min(new_lot_size, max_lot_size))

        # Get current price for market order
        try:
            price_info = await self.executor.connection.get_symbol_price(broker_symbol)
            entry_price = price_info["ask"] if direction == "BUY" else price_info["bid"]
        except Exception as e:
            log.error("Failed to get current price", error=str(e))
            # Use position's open price as fallback
            entry_price = ref_position.get("openPrice", 0)

        # Create a signal-like object for execution
        class ModifierSignal:
            pass

        mod_signal = ModifierSignal()
        mod_signal.direction = direction
        mod_signal.symbol = target_symbol
        mod_signal.entry_price = entry_price
        mod_signal.stop_loss = stop_loss
        mod_signal.take_profits = [take_profit]
        mod_signal.confidence = 0.9
        mod_signal.warnings = []

        # Execute the additional trade
        try:
            executions = await self.executor.execute(mod_signal, new_lot_size)
        except Exception as e:
            log.error("Lot modifier execution error", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Execution error: {str(e)}",
            )
            return

        if not executions:
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="Additional order execution failed",
            )
            return

        # Save trades
        await crud.update_signal(
            signal_id,
            direction=direction,
            entry_price=entry_price,
            stop_loss=stop_loss,
            take_profits=[take_profit],
            status="executed",
            executed_at=datetime.utcnow().isoformat(),
        )

        for exe in executions:
            await crud.create_trade(
                signal_id=signal_id,
                order_id=exe.order_id,
                symbol=exe.symbol,
                direction=exe.direction,
                lot_size=exe.lot_size,
                entry_price=exe.entry_price,
                stop_loss=exe.stop_loss,
                take_profit=exe.take_profit,
                tp_index=exe.tp_index,
            )

        await event_bus.emit(
            Events.TRADE_OPENED,
            {
                "signal_id": signal_id,
                "symbol": target_symbol,
                "direction": direction,
                "trades": len(executions),
                "lot_size": new_lot_size,
                "lot_modifier": True,
                "modifier_type": modifier_type,
            },
        )

        log.info(
            "LOT_MODIFIER signal executed",
            signal_id=signal_id,
            symbol=target_symbol,
            direction=direction,
            lot_size=new_lot_size,
            modifier_type=modifier_type,
        )

    async def _sync_closed_trades(self):
        """Sync closed trades by comparing DB records with MetaApi positions.

        Called periodically to detect positions that have closed and update
        the database with profit/close data for accurate stats.
        """
        try:
            # Get current live positions from MetaApi
            account_info = await self.executor.get_account_info()
            live_positions = account_info.get("positions", [])

            # Build set of currently open position IDs
            # MetaApi uses 'id' or 'positionId' depending on context
            live_position_ids = set()
            for pos in live_positions:
                pos_id = str(pos.get("id") or pos.get("positionId", ""))
                if pos_id:
                    live_position_ids.add(pos_id)

            # Get all "open" or "pending" trades from database
            db_trades = await crud.get_open_trades_for_sync()

            for trade in db_trades:
                order_id = str(trade.get("order_id", ""))
                trade_id = trade["id"]

                # Check if this trade's order_id matches any live position
                if order_id and order_id not in live_position_ids:
                    # Position has closed - fetch deal history
                    await self._process_closed_trade(trade_id, order_id)

        except Exception as e:
            log.error("Trade sync failed", error=str(e))

    async def _process_closed_trade(self, trade_id: int, position_id: str):
        """Process a trade that appears to have closed.

        Fetches deal history to get close price and profit, then updates DB.

        Args:
            trade_id: Database trade ID.
            position_id: MetaApi position/order ID.
        """
        try:
            # Fetch deal history from MetaApi
            deals = await self.executor.get_deals_by_position(position_id)

            if not deals:
                log.warning(
                    f"No deals found for position {position_id}, marking as closed with unknown P&L"
                )
                await crud.mark_trade_closed(
                    trade_id=trade_id,
                    close_price=0,
                    profit=0,
                    closed_at=datetime.utcnow().isoformat(),
                )
                return

            # Find the closing deal (DEAL_ENTRY_OUT) and opening deal (DEAL_ENTRY_IN)
            close_deal = None
            open_deal = None
            total_profit = 0

            for deal in deals:
                entry_type = deal.get("entryType", "")
                if entry_type == "DEAL_ENTRY_OUT":
                    close_deal = deal
                elif entry_type == "DEAL_ENTRY_IN":
                    open_deal = deal
                # Sum up all profits (handles partial closes)
                total_profit += deal.get("profit", 0) or 0

            # Extract close data
            close_price = close_deal.get("price", 0) if close_deal else 0
            # Handle datetime object or string for closed_at
            close_time = close_deal.get("time") if close_deal else None
            if close_time:
                closed_at = close_time.isoformat() if hasattr(close_time, "isoformat") else str(close_time)
            else:
                closed_at = datetime.utcnow().isoformat()
            open_price = open_deal.get("price") if open_deal else None

            # Update database
            await crud.mark_trade_closed(
                trade_id=trade_id,
                close_price=close_price,
                profit=total_profit,
                closed_at=closed_at,
                open_price=open_price,
            )

            log.info(
                "Trade closed",
                trade_id=trade_id,
                position_id=position_id,
                profit=total_profit,
                close_price=close_price,
            )

            # Emit event for WebSocket clients
            await event_bus.emit(
                Events.TRADE_CLOSED,
                {
                    "trade_id": trade_id,
                    "position_id": position_id,
                    "profit": total_profit,
                    "close_price": close_price,
                },
            )

        except Exception as e:
            log.error(f"Failed to process closed trade {trade_id}", error=str(e))

    async def _update_account_loop(self):
        """Periodically update account info, sync closed trades, and broadcast to clients."""
        sync_counter = 0
        SYNC_INTERVAL = 6  # Sync trades every 6 iterations (30 seconds)

        while True:
            try:
                info = await self.executor.get_account_info()

                # Update cached info for API
                set_account_info({
                    "balance": info["balance"],
                    "equity": info["equity"],
                    "margin": info["margin"],
                    "freeMargin": info["freeMargin"],
                })

                # Update live positions for API
                set_live_positions(info.get("positions", []))

                # Broadcast to WebSocket clients
                await event_bus.emit(
                    Events.ACCOUNT_UPDATED,
                    {
                        "balance": info["balance"],
                        "equity": info["equity"],
                        "margin": info["margin"],
                        "freeMargin": info["freeMargin"],
                        "positions": len(info.get("positions", [])),
                    },
                )

                # Sync closed trades every 30 seconds (6 * 5s)
                sync_counter += 1
                if sync_counter >= SYNC_INTERVAL:
                    sync_counter = 0
                    await self._sync_closed_trades()

            except Exception as e:
                log.error("Account update failed", error=str(e))

            await asyncio.sleep(5)  # Update every 5 seconds

    async def restart_telegram(self):
        """Restart the Telegram listener with fresh config from database.

        This allows reconnecting after Telegram verification without server restart.
        """
        log.info("Restarting Telegram listener...")

        # Stop existing listener if running
        if self.telegram and self.telegram.client:
            try:
                await self.telegram.stop()
            except Exception as e:
                log.warning("Error stopping old Telegram listener", error=str(e))

        # Create new listener instance (will pick up fresh config from DB)
        self.telegram = TelegramListener()

        # Start it in a background task (non-blocking)
        asyncio.create_task(self._run_telegram_listener())

        log.info("Telegram listener restart initiated")
        return True

    async def _run_telegram_listener(self):
        """Run Telegram listener in background task."""
        try:
            await self.telegram.start(self.on_message)
        except TelegramConfigError as e:
            log.error(f"Telegram configuration error: {e}")
        except Exception as e:
            log.error("Telegram listener error", error=str(e))

    async def stop(self):
        """Stop the signal copier."""
        log.info("Stopping Signal Copier")

        if self._account_update_task:
            self._account_update_task.cancel()
            try:
                await self._account_update_task
            except asyncio.CancelledError:
                pass

        await self.telegram.stop()
        await self.executor.disconnect()


# Global copier instance (for legacy single-user mode)
copier = SignalCopier()


async def run_copier():
    """Run the signal copier (Telegram listener) in legacy single-user mode."""
    # Check configuration first
    is_configured, issues = check_system_config()

    if not is_configured:
        log.error(
            "System not configured! Please set up your configuration in Admin > System Config.",
            missing=issues,
        )
        log.info("API server will start, but signal processing is disabled until configuration is complete.")
        log.info("Visit your dashboard and go to Admin > System Config to configure:")
        for issue in issues:
            log.info(f"  - {issue}")

        # Keep running but don't start the copier - just wait
        while True:
            # Check config periodically
            await asyncio.sleep(30)
            is_configured, issues = check_system_config()
            if is_configured:
                log.info("Configuration detected! Starting signal copier...")
                break

    try:
        await copier.start()
    except TelegramConfigError as e:
        log.error(f"Telegram configuration error: {e}")
        log.info("Please configure Telegram in Admin > System Config and restart.")
        # Keep API running
        while True:
            await asyncio.sleep(60)
    except Exception as e:
        log.error("Signal copier error", error=str(e))
        raise


async def run_multi_tenant():
    """Run the multi-tenant signal copier."""
    log.info("Starting multi-tenant signal copier")

    # Set the global copier reference so admin endpoints work
    # (Even in multi-tenant mode, admin needs to manage Telegram via the copier)
    set_copier(copier)

    # Set up signal router as the message handler
    user_manager.set_message_handler(signal_router.route_message)

    # Start the user connection manager
    await user_manager.start()

    # Load and connect active users from Supabase
    try:
        from .database.supabase import get_supabase
        supabase = get_supabase()

        # Get all active users who have completed onboarding
        result = supabase.table("profiles").select("id").eq("status", "active").execute()

        if result.data:
            for profile in result.data:
                user_id = profile["id"]
                success = await user_manager.connect_user(user_id)
                if success:
                    log.info("Connected user", user_id=user_id[:8])
                else:
                    log.warning("Failed to connect user", user_id=user_id[:8])

            log.info(
                "Multi-tenant startup complete",
                active_users=user_manager.active_users,
                connected_users=user_manager.connected_users,
            )
        else:
            log.info("No active users found - waiting for users to onboard")

    except Exception as e:
        log.error("Error loading users from Supabase", error=str(e))

    # Keep running
    while True:
        await asyncio.sleep(60)  # Heartbeat every minute


async def main():
    """Main entry point - runs API server and signal copier.

    Supports two modes based on MULTI_TENANT_MODE environment variable:
    - Single-user (legacy): Uses environment variables for credentials
    - Multi-tenant: Uses Supabase for per-user credentials
    """
    multi_tenant = os.getenv("MULTI_TENANT_MODE", "false").lower() == "true"

    if multi_tenant:
        log.info("Running in MULTI-TENANT mode")
        # Start multi-tenant copier in background
        copier_task = asyncio.create_task(run_multi_tenant())
    else:
        log.info("Running in SINGLE-USER mode (legacy)")
        # Start legacy signal copier in background
        copier_task = asyncio.create_task(run_copier())

    # Start API server - use PORT env var (Railway) or fall back to settings
    port = int(os.getenv("PORT", settings.api_port))
    log.info(f"Starting API server on port {port}")
    config = uvicorn.Config(
        app,
        host=settings.api_host,
        port=port,
        log_level="info",
    )
    server = uvicorn.Server(config)

    try:
        await server.serve()
    finally:
        copier_task.cancel()
        try:
            await copier_task
        except asyncio.CancelledError:
            pass

        if multi_tenant:
            await user_manager.stop()
        else:
            await copier.stop()


if __name__ == "__main__":
    asyncio.run(main())
