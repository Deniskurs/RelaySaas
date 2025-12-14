"""Signal router for multi-tenant signal processing."""
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any

from .config import settings
from .database import supabase_crud as crud
from .parser.llm_parser import SignalParser
from .trading.validator import TradeValidator
from .trading.executor import TradeExecutor, ExecutorSettings
from .users.manager import user_manager, UserConnection
from .users.credentials import get_user_settings
from .utils.events import event_bus, Events
from .utils.logger import log
from .api.plans_routes import check_signal_limit, increment_signal_count


class SignalRouter:
    """Routes signals to the correct user's executor in multi-tenant mode."""

    def __init__(self):
        self.parser = SignalParser()
        self._validators: Dict[str, TradeValidator] = {}

    def _get_user_tag(self, user_id: Optional[str]) -> str:
        """Get user tag for logging."""
        return f"[user:{user_id[:8]}] " if user_id else ""

    def _get_validator(self, user_id: str, connection: Any) -> TradeValidator:
        """Get or create validator for a user."""
        if user_id not in self._validators:
            executor = user_manager.get_executor(user_id)
            if executor and executor.connection:
                # Pass user_id for multi-tenant settings lookup
                self._validators[user_id] = TradeValidator(executor.connection, user_id=user_id)
        return self._validators.get(user_id)

    async def route_message(self, message: dict):
        """Route a message to the appropriate user's signal processor.

        Args:
            message: Dict with text, channel_name, channel_id, message_id, date, user_id
        """
        user_id = message.get("user_id")

        if not user_id:
            # Legacy single-user mode - fall back to old behavior
            log.warning("Message received without user_id - cannot route in multi-tenant mode")
            return

        user_tag = self._get_user_tag(user_id)

        # Get user connection
        conn = user_manager.get_connection(user_id)
        if not conn or not conn.is_active:
            log.warning(f"{user_tag}No active connection for user")
            return

        # Get user settings
        user_settings = conn.settings
        if not user_settings:
            log.warning(f"{user_tag}No settings found for user")
            return

        # Check if processing is paused for this user
        if user_settings.paused:
            log.debug(f"{user_tag}Processing paused for user, skipping message")
            return

        text = message["text"]
        if not text or len(text) < 10:
            return

        channel_name = message["channel_name"]
        log.info(f"{user_tag}Processing message", channel=channel_name, preview=text[:50])

        # Create signal record in Supabase with user_id
        signal = await crud.create_signal(
            raw_message=text,
            channel_name=channel_name,
            channel_id=message.get("channel_id"),
            message_id=message.get("message_id"),
            user_id=user_id,
        )
        signal_id = signal["id"]

        await event_bus.emit(
            Events.SIGNAL_RECEIVED,
            {
                "id": signal_id,
                "user_id": user_id,
                "channel": channel_name,
                "preview": text[:100],
            },
        )

        # Parse signal (shared parser using owner's Anthropic API)
        parsed = await self.parser.parse(text)

        # Check if parser rejected the signal
        is_rejected = (
            not parsed or
            (hasattr(parsed, 'is_signal') and not parsed.is_signal)
        )

        if is_rejected:
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
                    "user_id": user_id,
                    "reason": rejection_reason,
                    "suggested_correction": suggested,
                    "symbol": symbol,
                    "direction": direction,
                },
            )
            log.debug(
                f"{user_tag}Signal skipped",
                signal_id=signal_id,
                reason=rejection_reason,
            )
            return

        # Handle CLOSE signals
        signal_type = getattr(parsed, 'signal_type', 'OPEN')
        if signal_type == "CLOSE":
            await self._handle_close_signal(user_id, signal_id, parsed, conn)
            return

        # Handle LOT_MODIFIER signals
        if signal_type == "LOT_MODIFIER":
            await self._handle_lot_modifier_signal(user_id, signal_id, parsed, conn)
            return

        # Update signal with parsed data (OPEN signals)
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
                "user_id": user_id,
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
            f"{user_tag}Signal parsed",
            signal_id=signal_id,
            symbol=parsed.symbol,
            direction=parsed.direction,
            confidence=parsed.confidence,
        )

        # Get user's executor
        executor = conn.metaapi_executor
        if not executor:
            log.error(f"{user_tag}No executor available")
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="MetaApi executor not connected",
            )
            return

        # Validate
        try:
            account_info = await executor.get_account_info()
        except Exception as e:
            log.error(f"{user_tag}Failed to get account info", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Account info error: {str(e)}",
            )
            return

        validator = self._get_validator(user_id, conn)
        if not validator:
            log.error(f"{user_tag}No validator available")
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="Validator not available",
            )
            return

        validation = await validator.validate(parsed, account_info)

        await event_bus.emit(
            Events.SIGNAL_VALIDATED,
            {
                "id": signal_id,
                "user_id": user_id,
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
            log.warning(
                f"{user_tag}Signal validation failed",
                signal_id=signal_id,
                errors=validation.errors,
            )
            return

        # Check if auto-accept based on user's settings
        symbol_upper = parsed.symbol.upper()
        auto_accept_list = user_settings.auto_accept_symbols or []
        is_auto_accept = symbol_upper in [s.upper() for s in auto_accept_list]

        # Get lot size from user settings
        default_lot = user_settings.lot_reference_size_default or 0.01
        if symbol_upper in ["XAUUSD", "GOLD"]:
            default_lot = user_settings.lot_reference_size_gold or 0.04

        lot_size = validation.adjusted_lot_size or default_lot

        if not is_auto_accept:
            # Requires manual confirmation
            await crud.update_signal(
                signal_id,
                status="pending_confirmation",
                warnings=(parsed.warnings or []) + [
                    f"Awaiting confirmation (lot size: {lot_size})"
                ],
            )

            await event_bus.emit(
                Events.SIGNAL_PENDING_CONFIRMATION,
                {
                    "id": signal_id,
                    "user_id": user_id,
                    "symbol": parsed.symbol,
                    "direction": parsed.direction,
                    "entry": parsed.entry_price,
                    "sl": parsed.stop_loss,
                    "tps": parsed.take_profits,
                    "lot_size": lot_size,
                },
            )

            log.info(
                f"{user_tag}Signal awaiting confirmation",
                signal_id=signal_id,
                symbol=parsed.symbol,
                direction=parsed.direction,
            )
            return

        # Check plan limits before executing
        limit_check = await check_signal_limit(user_id)
        if not limit_check.get("allowed", True):
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=limit_check.get("message", "Daily signal limit reached"),
            )
            await event_bus.emit(
                Events.SIGNAL_FAILED,
                {
                    "id": signal_id,
                    "user_id": user_id,
                    "reason": "limit_reached",
                    "message": limit_check.get("message"),
                },
            )
            log.warning(
                f"{user_tag}Signal blocked by plan limit",
                signal_id=signal_id,
                current=limit_check.get("current"),
                limit=limit_check.get("limit"),
            )
            return

        # Auto-accept: Execute trades immediately
        try:
            executions = await executor.execute(parsed, lot_size)
        except Exception as e:
            log.error(f"{user_tag}Trade execution error", error=str(e), signal_id=signal_id)
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
                failure_reason="Order execution failed",
            )
            return

        # Save trades and update signal
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
                user_id=user_id,
            )

        # Increment daily signal count after successful execution
        await increment_signal_count(user_id)

        await event_bus.emit(
            Events.TRADE_OPENED,
            {
                "signal_id": signal_id,
                "user_id": user_id,
                "symbol": parsed.symbol,
                "direction": parsed.direction,
                "trades": len(executions),
                "lot_size": lot_size,
            },
        )

        log.info(
            f"{user_tag}Signal executed successfully",
            signal_id=signal_id,
            symbol=parsed.symbol,
            direction=parsed.direction,
            trades=len(executions),
            lot_size=lot_size,
        )

    async def _handle_close_signal(self, user_id: str, signal_id: int, parsed: Any, conn: UserConnection):
        """Handle a CLOSE signal to exit positions."""
        user_tag = self._get_user_tag(user_id)
        symbol = parsed.symbol

        executor = conn.metaapi_executor
        if not executor:
            log.error(f"{user_tag}No executor for close signal")
            return

        symbol_suffix = conn.settings.symbol_suffix if conn.settings else ""
        broker_symbol = symbol + symbol_suffix

        log.info(f"{user_tag}Processing CLOSE signal", signal_id=signal_id, symbol=symbol)

        await crud.update_signal(
            signal_id,
            symbol=symbol,
            status="parsed",
            warnings=getattr(parsed, 'warnings', []),
            parsed_at=datetime.utcnow().isoformat(),
        )

        try:
            account_info = await executor.get_account_info()
            positions = account_info.get("positions", [])
        except Exception as e:
            log.error(f"{user_tag}Failed to get positions for close signal", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Could not fetch positions: {str(e)}",
            )
            return

        # Find matching positions
        matching = [
            p for p in positions
            if p.get("symbol", "").upper().replace(symbol_suffix.upper(), "") == symbol.upper()
        ]

        if not matching:
            log.warning(f"{user_tag}No open positions found for symbol", symbol=symbol)
            await crud.update_signal(
                signal_id,
                status="skipped",
                failure_reason=f"No open positions found for {symbol}",
            )
            return

        # Close all matching positions
        closed_count = 0
        for pos in matching:
            position_id = pos.get("id") or pos.get("positionId")
            if position_id:
                try:
                    await executor.close_position(str(position_id))
                    closed_count += 1
                except Exception as e:
                    log.error(f"{user_tag}Failed to close position", position_id=position_id, error=str(e))

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
                "user_id": user_id,
                "symbol": symbol,
                "positions_closed": closed_count,
            },
        )

        log.info(
            f"{user_tag}CLOSE signal processed",
            signal_id=signal_id,
            symbol=symbol,
            closed=closed_count,
        )

    async def _handle_lot_modifier_signal(self, user_id: str, signal_id: int, parsed: Any, conn: UserConnection):
        """Handle a LOT_MODIFIER signal to add to existing positions."""
        user_tag = self._get_user_tag(user_id)
        target_symbol = getattr(parsed, 'target_symbol', None) or "XAUUSD"
        multiplier = getattr(parsed, 'lot_multiplier', 1.0) or 1.0
        modifier_type = getattr(parsed, 'lot_modifier_type', 'ADD') or 'ADD'
        warnings = getattr(parsed, 'warnings', []) or []

        if target_symbol.upper() == "GOLD":
            target_symbol = "XAUUSD"

        executor = conn.metaapi_executor
        if not executor:
            log.error(f"{user_tag}No executor for lot modifier")
            return

        symbol_suffix = conn.settings.symbol_suffix if conn.settings else ""
        max_lot = conn.settings.max_lot_size if conn.settings else 0.1
        broker_symbol = target_symbol + symbol_suffix

        log.info(
            f"{user_tag}Processing LOT_MODIFIER signal",
            signal_id=signal_id,
            target_symbol=target_symbol,
            modifier_type=modifier_type,
            multiplier=multiplier,
        )

        await crud.update_signal(
            signal_id,
            symbol=target_symbol,
            status="parsed",
            warnings=warnings + [f"LOT_MODIFIER: {modifier_type} (x{multiplier})"],
            parsed_at=datetime.utcnow().isoformat(),
        )

        try:
            account_info = await executor.get_account_info()
            positions = account_info.get("positions", [])
        except Exception as e:
            log.error(f"{user_tag}Failed to get positions for lot modifier", error=str(e))
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Could not fetch positions: {str(e)}",
            )
            return

        # Find matching position
        matching = [
            p for p in positions
            if p.get("symbol", "").upper().replace(symbol_suffix.upper(), "") == target_symbol.upper()
        ]

        if not matching:
            log.warning(f"{user_tag}No open positions found for lot modifier", symbol=target_symbol)
            await crud.update_signal(
                signal_id,
                status="skipped",
                failure_reason=f"No open {target_symbol} positions to modify",
            )
            return

        # Use most recent position as reference
        ref_position = matching[-1]
        original_lot = ref_position.get("volume", 0.01)
        position_type = ref_position.get("type", "").upper()
        stop_loss = ref_position.get("stopLoss")
        take_profit = ref_position.get("takeProfit")

        if "BUY" in position_type:
            direction = "BUY"
        elif "SELL" in position_type:
            direction = "SELL"
        else:
            log.error(f"{user_tag}Could not determine position direction", position_type=position_type)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=f"Unknown position type: {position_type}",
            )
            return

        if not stop_loss or not take_profit:
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="Reference position has no SL/TP",
            )
            return

        # Calculate new lot size
        if modifier_type == "DOUBLE":
            new_lot_size = original_lot
        else:
            new_lot_size = round(original_lot * multiplier, 2)

        new_lot_size = max(0.01, min(new_lot_size, max_lot))

        # Get current price
        try:
            price_info = await executor.connection.get_symbol_price(broker_symbol)
            entry_price = price_info["ask"] if direction == "BUY" else price_info["bid"]
        except Exception:
            entry_price = ref_position.get("openPrice", 0)

        # Create signal-like object for execution
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

        try:
            executions = await executor.execute(mod_signal, new_lot_size)
        except Exception as e:
            log.error(f"{user_tag}Lot modifier execution error", error=str(e))
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
                user_id=user_id,
            )

        await event_bus.emit(
            Events.TRADE_OPENED,
            {
                "signal_id": signal_id,
                "user_id": user_id,
                "symbol": target_symbol,
                "direction": direction,
                "trades": len(executions),
                "lot_size": new_lot_size,
                "lot_modifier": True,
                "modifier_type": modifier_type,
            },
        )

        log.info(
            f"{user_tag}LOT_MODIFIER signal executed",
            signal_id=signal_id,
            symbol=target_symbol,
            direction=direction,
            lot_size=new_lot_size,
            modifier_type=modifier_type,
        )

    async def confirm_signal(self, user_id: str, signal_id: int, lot_size_override: Optional[float] = None) -> bool:
        """Confirm and execute a pending signal for a user.

        Args:
            user_id: User UUID.
            signal_id: Database signal ID.
            lot_size_override: Optional lot size override from user selection.

        Returns:
            True if execution succeeded, False otherwise.
        """
        user_tag = self._get_user_tag(user_id)
        log.info(f"{user_tag}Confirming signal", signal_id=signal_id, lot_size_override=lot_size_override)

        # Get user connection
        conn = user_manager.get_connection(user_id)
        if not conn or not conn.is_active:
            log.error(f"{user_tag}No active connection for confirm_signal")
            return False

        executor = conn.metaapi_executor
        if not executor or not executor.connection:
            log.error(f"{user_tag}No MetaAPI executor for confirm_signal")
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="MetaAPI executor not connected",
            )
            return False

        # Get signal from database
        signal = await crud.get_signal(signal_id)
        if not signal:
            log.error(f"{user_tag}Signal not found for confirmation", signal_id=signal_id)
            return False

        if signal.get("status") != "pending_confirmation":
            log.error(f"{user_tag}Signal not pending confirmation", signal_id=signal_id, status=signal.get("status"))
            return False

        # Verify ownership
        if signal.get("user_id") != user_id:
            log.error(f"{user_tag}Signal does not belong to user", signal_id=signal_id)
            return False

        # Check we have the required fields
        if not signal.get("symbol") or not signal.get("entry_price") or not signal.get("stop_loss") or not signal.get("direction"):
            log.error(f"{user_tag}Signal missing required fields", signal_id=signal_id)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="Missing required fields",
            )
            return False

        take_profits = signal.get("take_profits") or []
        if not take_profits:
            log.error(f"{user_tag}Signal has no take profits", signal_id=signal_id)
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

        # Get user settings
        user_settings = conn.settings
        default_lot_size = user_settings.lot_reference_size_default if user_settings else 0.01
        max_lot_size = user_settings.max_lot_size if user_settings else 0.1

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

        # Check plan limits before executing
        limit_check = await check_signal_limit(user_id)
        if not limit_check.get("allowed", True):
            log.warning(f"{user_tag}Signal blocked by plan limit", signal_id=signal_id)
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason=limit_check.get("message", "Daily signal limit reached"),
            )
            return False

        # Execute
        try:
            executions = await executor.execute(parsed, lot_size)
        except Exception as e:
            log.error(f"{user_tag}Confirmed signal execution error", error=str(e))
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
                failure_reason=executor.last_error or "Order execution failed",
            )
            return False

        # Update signal status
        await crud.update_signal(
            signal_id,
            status="executed",
            executed_at=datetime.utcnow().isoformat(),
        )

        # Save trades
        for exec_data in executions:
            await crud.create_trade(
                signal_id=signal_id,
                user_id=user_id,
                position_id=exec_data.get("position_id"),
                order_id=exec_data.get("order_id"),
                symbol=exec_data.get("symbol"),
                direction=exec_data.get("direction"),
                lot_size=exec_data.get("lot_size"),
                entry_price=exec_data.get("entry_price"),
                stop_loss=exec_data.get("stop_loss"),
                take_profit=exec_data.get("take_profit"),
                tp_index=exec_data.get("tp_index", 0),
            )

        # Increment signal count for plan tracking
        await increment_signal_count(user_id)

        # Emit event
        await event_bus.emit(
            Events.SIGNAL_EXECUTED,
            {
                "signal_id": signal_id,
                "user_id": user_id,
                "symbol": parsed.symbol,
                "direction": parsed.direction,
                "trades": len(executions),
                "lot_size": lot_size,
                "manual_confirm": True,
            },
        )

        log.info(
            f"{user_tag}Signal confirmed and executed",
            signal_id=signal_id,
            symbol=parsed.symbol,
            direction=parsed.direction,
            lot_size=lot_size,
            trades=len(executions),
        )

        return True


# Global instance
signal_router = SignalRouter()
