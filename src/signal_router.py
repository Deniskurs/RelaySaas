"""Signal router for multi-tenant signal processing."""
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List

from .config import settings
from .database import supabase_crud as crud
from .database.supabase import get_supabase_admin
from .parser.llm_parser import SignalParser
from .trading.validator import TradeValidator
from .trading.executor import (
    TradeExecutor,
    ExecutorSettings,
    AccountExecutionResult,
    MultiAccountExecutionResult,
)
from .users.manager import user_manager, UserConnection, AccountExecutor
from .users.credentials import get_user_settings
from .utils.events import event_bus, Events
from .utils.logger import log
from .api.plans_routes import check_signal_limit, increment_signal_count


class SignalRouter:
    """Routes signals to the correct user's executor in multi-tenant mode.

    Supports two modes:
    1. Per-user listeners: Each user has their own Telegram listener (legacy)
    2. Shared listener: One system listener fans out to all subscribed users (recommended)
    """

    def __init__(self):
        self.parser = SignalParser()
        self._validators: Dict[str, TradeValidator] = {}
        self._channel_subscribers_cache: Dict[str, List[str]] = {}  # channel_id -> [user_ids]
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl_seconds = 60  # Refresh cache every 60 seconds

    def _get_subscribers_for_channel(self, channel_id: str) -> List[str]:
        """Get list of user IDs subscribed to a channel.

        Uses cached data with TTL to avoid hitting database on every message.
        """
        now = datetime.utcnow()

        # Refresh cache if stale or empty
        if (self._cache_timestamp is None or
            (now - self._cache_timestamp).total_seconds() > self._cache_ttl_seconds):
            self._refresh_channel_subscribers_cache()

        # Normalize channel_id (remove leading # if present)
        normalized_id = channel_id.lstrip('#')

        return self._channel_subscribers_cache.get(normalized_id, [])

    def _refresh_channel_subscribers_cache(self):
        """Refresh the channel subscribers cache from database."""
        try:
            supabase = get_supabase_admin()

            # Get all user settings with channel subscriptions
            result = supabase.table("user_settings_v2").select(
                "user_id, telegram_channel_ids"
            ).execute()

            # Build reverse index: channel_id -> [user_ids]
            new_cache: Dict[str, List[str]] = {}

            for row in (result.data or []):
                user_id = row.get("user_id")
                channels = row.get("telegram_channel_ids") or []

                for channel in channels:
                    # Normalize channel_id
                    normalized = str(channel).lstrip('#')
                    if normalized not in new_cache:
                        new_cache[normalized] = []
                    if user_id not in new_cache[normalized]:
                        new_cache[normalized].append(user_id)

            self._channel_subscribers_cache = new_cache
            self._cache_timestamp = datetime.utcnow()

            log.debug(
                "Channel subscribers cache refreshed",
                channels=len(new_cache),
                total_subscriptions=sum(len(v) for v in new_cache.values()),
            )

        except Exception as e:
            log.error("Failed to refresh channel subscribers cache", error=str(e))

    async def route_message_to_subscribers(self, message: dict):
        """Route a message from SHARED LISTENER to all subscribed users.

        This is the recommended approach for multi-tenant:
        - One system Telegram listener receives signals
        - Signals are fanned out to ALL users subscribed to that channel

        Args:
            message: Dict with text, channel_name, channel_id, message_id, date
                     (NO user_id - that's determined by subscription)
        """
        channel_id = message.get("channel_id", "")
        channel_name = message.get("channel_name", "Unknown")
        text = message.get("text", "")

        if not text or len(text) < 10:
            return

        # Get all users subscribed to this channel
        subscribers = self._get_subscribers_for_channel(channel_id)

        if not subscribers:
            # Log at info level so admin can see unsubscribed channels
            log.info(
                f"📭 No subscribers for channel '{channel_name}' - message ignored",
                channel_id=channel_id,
                hint="Users can subscribe to this channel in Settings",
            )
            return

        log.info(
            f"📡 SHARED LISTENER: Routing to {len(subscribers)} subscribers",
            channel=channel_name,
            channel_id=channel_id,
            subscribers=[s[:8] for s in subscribers],
            preview=text[:50],
        )

        # Process for each subscriber concurrently
        tasks = []
        for user_id in subscribers:
            # Create user-specific message
            user_message = {
                **message,
                "user_id": user_id,
            }
            tasks.append(self.route_message(user_message))

        # Run all in parallel
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Log any errors
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    log.error(
                        f"Error routing to subscriber {subscribers[i][:8]}",
                        error=str(result),
                    )

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

    async def _execute_on_all_accounts(
        self,
        account_executors: List[AccountExecutor],
        signal: Any,
        lot_size: float,
    ) -> MultiAccountExecutionResult:
        """Execute a signal on all provided MT account executors in parallel.

        Each account execution is isolated - one failure doesn't stop others.

        Args:
            account_executors: List of AccountExecutor objects to execute on.
            signal: Parsed signal to execute.
            lot_size: Lot size to use for each execution.

        Returns:
            MultiAccountExecutionResult with per-account results.
        """
        async def execute_on_account(ae: AccountExecutor) -> AccountExecutionResult:
            try:
                executions = await ae.executor.execute(signal, lot_size)
                return AccountExecutionResult(
                    account_id=ae.account_id,
                    account_alias=ae.account_alias,
                    success=bool(executions),
                    executions=executions or [],
                    error=ae.executor.last_error if not executions else None,
                )
            except Exception as e:
                log.error(
                    f"Execution failed on account '{ae.account_alias}'",
                    error=str(e),
                )
                return AccountExecutionResult(
                    account_id=ae.account_id,
                    account_alias=ae.account_alias,
                    success=False,
                    error=str(e),
                )

        # Execute on all accounts in parallel
        results = await asyncio.gather(
            *[execute_on_account(ae) for ae in account_executors],
            return_exceptions=False,  # We handle exceptions inside execute_on_account
        )

        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful

        return MultiAccountExecutionResult(
            total_accounts=len(results),
            successful_accounts=successful,
            failed_accounts=failed,
            results=list(results),
        )

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
        message_id = message.get("message_id")
        log.info(
            f"{user_tag}🔄 ROUTING MESSAGE",
            channel=channel_name,
            message_id=message_id,
            preview=text[:50],
        )

        # Create signal record in Supabase with user_id
        signal = await crud.create_signal(
            raw_message=text,
            channel_name=channel_name,
            channel_id=message.get("channel_id"),
            message_id=message.get("message_id"),
            user_id=user_id,
        )

        # Check if signal was created (None means duplicate for THIS user)
        if not signal:
            log.debug(
                f"{user_tag}⏭️ Duplicate message skipped",
                message_id=message_id,
                channel=channel_name,
            )
            return

        signal_id = signal["id"]
        log.info(
            f"{user_tag}✅ SIGNAL CREATED",
            signal_id=signal_id,
            message_id=message_id,
        )

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

        # Get all connected executors for multi-account execution
        account_executors = user_manager.get_all_executors(user_id)
        if not account_executors:
            log.error(f"{user_tag}No connected MT accounts available")
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="No MetaApi accounts connected",
            )
            return

        # Use primary executor for validation (backward compat)
        executor = conn.metaapi_executor
        if not executor:
            executor = account_executors[0].executor

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

        # Auto-accept: Execute trades on ALL connected accounts
        multi_result = await self._execute_on_all_accounts(
            account_executors=account_executors,
            signal=parsed,
            lot_size=lot_size,
        )

        # Determine signal status based on multi-account results
        if multi_result.overall_status == "failed":
            # Build error message from all failures
            errors = [
                f"{r.account_alias}: {r.error}"
                for r in multi_result.results
                if not r.success and r.error
            ]
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="; ".join(errors) if errors else "Execution failed on all accounts",
            )
            log.error(
                f"{user_tag}Signal execution failed on all accounts",
                signal_id=signal_id,
                failed_accounts=multi_result.failed_accounts,
            )
            return

        # Save trades from successful accounts
        for account_result in multi_result.results:
            if not account_result.success:
                continue

            for exe in account_result.executions:
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
                    mt_account_id=account_result.account_id,
                )

        # Update signal status
        await crud.update_signal(
            signal_id,
            status=multi_result.overall_status,
            executed_at=datetime.utcnow().isoformat(),
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
                "trades": len(multi_result.all_executions),
                "lot_size": lot_size,
                "accounts": multi_result.total_accounts,
                "successful_accounts": multi_result.successful_accounts,
            },
        )

        log.info(
            f"{user_tag}{multi_result.summary_message}",
            signal_id=signal_id,
            symbol=parsed.symbol,
            direction=parsed.direction,
            trades=len(multi_result.all_executions),
            lot_size=lot_size,
            accounts=f"{multi_result.successful_accounts}/{multi_result.total_accounts}",
        )

    async def _handle_close_signal(self, user_id: str, signal_id: int, parsed: Any, conn: UserConnection):
        """Handle a CLOSE signal to exit positions on all connected accounts."""
        user_tag = self._get_user_tag(user_id)
        symbol = parsed.symbol

        # Get all connected executors
        account_executors = user_manager.get_all_executors(user_id)
        if not account_executors:
            log.error(f"{user_tag}No connected accounts for close signal")
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="No MetaApi accounts connected",
            )
            return

        symbol_suffix = conn.settings.symbol_suffix if conn.settings else ""

        log.info(
            f"{user_tag}Processing CLOSE signal on {len(account_executors)} account(s)",
            signal_id=signal_id,
            symbol=symbol,
        )

        await crud.update_signal(
            signal_id,
            symbol=symbol,
            status="parsed",
            warnings=getattr(parsed, 'warnings', []),
            parsed_at=datetime.utcnow().isoformat(),
        )

        # Close positions on all accounts in parallel
        async def close_on_account(ae: AccountExecutor) -> int:
            """Close matching positions on a single account. Returns count closed."""
            try:
                account_info = await ae.executor.get_account_info()
                positions = account_info.get("positions", [])

                # Find matching positions
                matching = [
                    p for p in positions
                    if p.get("symbol", "").upper().replace(symbol_suffix.upper(), "") == symbol.upper()
                ]

                closed = 0
                for pos in matching:
                    position_id = pos.get("id") or pos.get("positionId")
                    if position_id:
                        try:
                            await ae.executor.close_position(str(position_id))
                            closed += 1
                        except Exception as e:
                            log.error(
                                f"{user_tag}Failed to close position on '{ae.account_alias}'",
                                position_id=position_id,
                                error=str(e),
                            )

                return closed
            except Exception as e:
                log.error(
                    f"{user_tag}Failed to get positions on '{ae.account_alias}'",
                    error=str(e),
                )
                return 0

        results = await asyncio.gather(
            *[close_on_account(ae) for ae in account_executors],
            return_exceptions=True,
        )

        # Sum up closed positions
        total_closed = sum(r for r in results if isinstance(r, int))

        if total_closed > 0:
            await crud.update_signal(
                signal_id,
                status="executed",
                executed_at=datetime.utcnow().isoformat(),
            )
        else:
            await crud.update_signal(
                signal_id,
                status="skipped",
                failure_reason=f"No open positions found for {symbol} on any account",
            )

        await event_bus.emit(
            Events.TRADE_CLOSED,
            {
                "signal_id": signal_id,
                "user_id": user_id,
                "symbol": symbol,
                "positions_closed": total_closed,
                "accounts": len(account_executors),
            },
        )

        log.info(
            f"{user_tag}CLOSE signal processed",
            signal_id=signal_id,
            symbol=symbol,
            closed=total_closed,
            accounts=len(account_executors),
        )

    async def _handle_lot_modifier_signal(self, user_id: str, signal_id: int, parsed: Any, conn: UserConnection):
        """Handle a LOT_MODIFIER signal to add to existing positions on all accounts."""
        user_tag = self._get_user_tag(user_id)
        target_symbol = getattr(parsed, 'target_symbol', None) or "XAUUSD"
        multiplier = getattr(parsed, 'lot_multiplier', 1.0) or 1.0
        modifier_type = getattr(parsed, 'lot_modifier_type', 'ADD') or 'ADD'
        warnings = getattr(parsed, 'warnings', []) or []

        if target_symbol.upper() == "GOLD":
            target_symbol = "XAUUSD"

        # Get all connected executors
        account_executors = user_manager.get_all_executors(user_id)
        if not account_executors:
            log.error(f"{user_tag}No connected accounts for lot modifier")
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="No MetaApi accounts connected",
            )
            return

        symbol_suffix = conn.settings.symbol_suffix if conn.settings else ""
        max_lot = conn.settings.max_lot_size if conn.settings else 0.1
        broker_symbol = target_symbol + symbol_suffix

        log.info(
            f"{user_tag}Processing LOT_MODIFIER signal on {len(account_executors)} account(s)",
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

        # Execute lot modifier on each account
        async def modify_on_account(ae: AccountExecutor) -> AccountExecutionResult:
            """Execute lot modifier on a single account."""
            try:
                account_info = await ae.executor.get_account_info()
                positions = account_info.get("positions", [])

                # Find matching position on this account
                matching = [
                    p for p in positions
                    if p.get("symbol", "").upper().replace(symbol_suffix.upper(), "") == target_symbol.upper()
                ]

                if not matching:
                    return AccountExecutionResult(
                        account_id=ae.account_id,
                        account_alias=ae.account_alias,
                        success=False,
                        error=f"No {target_symbol} position found",
                    )

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
                    return AccountExecutionResult(
                        account_id=ae.account_id,
                        account_alias=ae.account_alias,
                        success=False,
                        error=f"Unknown position type: {position_type}",
                    )

                if not stop_loss or not take_profit:
                    return AccountExecutionResult(
                        account_id=ae.account_id,
                        account_alias=ae.account_alias,
                        success=False,
                        error="Reference position has no SL/TP",
                    )

                # Calculate new lot size
                if modifier_type == "DOUBLE":
                    new_lot_size = original_lot
                else:
                    new_lot_size = round(original_lot * multiplier, 2)
                new_lot_size = max(0.01, min(new_lot_size, max_lot))

                # Get current price
                try:
                    price_info = await ae.executor.connection.get_symbol_price(broker_symbol)
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

                executions = await ae.executor.execute(mod_signal, new_lot_size)
                return AccountExecutionResult(
                    account_id=ae.account_id,
                    account_alias=ae.account_alias,
                    success=bool(executions),
                    executions=executions or [],
                    error=ae.executor.last_error if not executions else None,
                )

            except Exception as e:
                log.error(
                    f"{user_tag}Lot modifier failed on '{ae.account_alias}'",
                    error=str(e),
                )
                return AccountExecutionResult(
                    account_id=ae.account_id,
                    account_alias=ae.account_alias,
                    success=False,
                    error=str(e),
                )

        results = await asyncio.gather(
            *[modify_on_account(ae) for ae in account_executors],
            return_exceptions=False,
        )

        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful

        multi_result = MultiAccountExecutionResult(
            total_accounts=len(results),
            successful_accounts=successful,
            failed_accounts=failed,
            results=list(results),
        )

        if multi_result.overall_status == "failed":
            errors = [f"{r.account_alias}: {r.error}" for r in results if not r.success and r.error]
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="; ".join(errors) if errors else "Lot modifier failed on all accounts",
            )
            return

        # Save trades from successful accounts
        for account_result in multi_result.results:
            if not account_result.success:
                continue

            for exe in account_result.executions:
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
                    mt_account_id=account_result.account_id,
                )

        await crud.update_signal(
            signal_id,
            direction=multi_result.all_executions[0].direction if multi_result.all_executions else None,
            status=multi_result.overall_status,
            executed_at=datetime.utcnow().isoformat(),
        )

        await event_bus.emit(
            Events.TRADE_OPENED,
            {
                "signal_id": signal_id,
                "user_id": user_id,
                "symbol": target_symbol,
                "direction": multi_result.all_executions[0].direction if multi_result.all_executions else None,
                "trades": len(multi_result.all_executions),
                "lot_modifier": True,
                "modifier_type": modifier_type,
                "accounts": multi_result.total_accounts,
                "successful_accounts": multi_result.successful_accounts,
            },
        )

        log.info(
            f"{user_tag}LOT_MODIFIER signal: {multi_result.summary_message}",
            signal_id=signal_id,
            symbol=target_symbol,
            modifier_type=modifier_type,
            accounts=f"{multi_result.successful_accounts}/{multi_result.total_accounts}",
        )

    async def confirm_signal(self, user_id: str, signal_id: int, lot_size_override: Optional[float] = None) -> bool:
        """Confirm and execute a pending signal on all connected accounts.

        Args:
            user_id: User UUID.
            signal_id: Database signal ID.
            lot_size_override: Optional lot size override from user selection.

        Returns:
            True if at least one execution succeeded, False otherwise.
        """
        user_tag = self._get_user_tag(user_id)
        log.info(f"{user_tag}Confirming signal", signal_id=signal_id, lot_size_override=lot_size_override)

        # Get user connection
        conn = user_manager.get_connection(user_id)
        if not conn or not conn.is_active:
            log.error(f"{user_tag}No active connection for confirm_signal")
            return False

        # Get all connected executors
        account_executors = user_manager.get_all_executors(user_id)
        if not account_executors:
            log.error(f"{user_tag}No connected MT accounts for confirm_signal")
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="No MetaAPI accounts connected",
            )
            return False

        # Use primary executor for balance calculation (backward compat)
        executor = conn.metaapi_executor
        if not executor:
            executor = account_executors[0].executor

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
        max_lot_size = user_settings.max_lot_size if user_settings else 0.1

        # Get lot size: use override if provided, otherwise calculate from balance
        if lot_size_override is not None and lot_size_override > 0:
            lot_size = lot_size_override
        else:
            # First try to extract from warnings (pre-calculated lot from validation)
            lot_size = None
            for warning in (signal.get("warnings") or []):
                if "lot size:" in warning.lower():
                    try:
                        lot_size = float(warning.split("lot size:")[1].strip().rstrip(")"))
                        break
                    except:
                        pass

            # If no lot size found in warnings, calculate dynamically from user's balance
            if lot_size is None:
                from .trading.validator import calculate_lot_for_symbol
                from .database.supabase import get_settings

                # Get user's actual balance from their executor
                try:
                    account_info = await executor.get_account_info()
                    balance = account_info.get("balance", 0)
                except Exception:
                    balance = 0

                # Get user's settings for reference balance calculation
                db_settings = get_settings(user_id)

                lot_size = calculate_lot_for_symbol(
                    symbol=parsed.symbol,
                    account_balance=balance,
                    min_lot=0.01,
                    max_lot=max_lot_size,
                    db_settings=db_settings,
                )
                log.info(f"{user_tag}Calculated lot size for confirmation",
                         symbol=parsed.symbol, balance=balance, lot_size=lot_size)

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

        # Execute on ALL connected accounts
        multi_result = await self._execute_on_all_accounts(
            account_executors=account_executors,
            signal=parsed,
            lot_size=lot_size,
        )

        if multi_result.overall_status == "failed":
            errors = [
                f"{r.account_alias}: {r.error}"
                for r in multi_result.results
                if not r.success and r.error
            ]
            await crud.update_signal(
                signal_id,
                status="failed",
                failure_reason="; ".join(errors) if errors else "Execution failed on all accounts",
            )
            log.error(
                f"{user_tag}Confirmed signal failed on all accounts",
                signal_id=signal_id,
            )
            return False

        # Save trades from successful accounts
        for account_result in multi_result.results:
            if not account_result.success:
                continue

            for exe in account_result.executions:
                await crud.create_trade(
                    signal_id=signal_id,
                    user_id=user_id,
                    order_id=exe.order_id,
                    symbol=exe.symbol,
                    direction=exe.direction,
                    lot_size=exe.lot_size,
                    entry_price=exe.entry_price,
                    stop_loss=exe.stop_loss,
                    take_profit=exe.take_profit,
                    tp_index=exe.tp_index,
                    mt_account_id=account_result.account_id,
                )

        # Update signal status
        await crud.update_signal(
            signal_id,
            status=multi_result.overall_status,
            executed_at=datetime.utcnow().isoformat(),
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
                "trades": len(multi_result.all_executions),
                "lot_size": lot_size,
                "manual_confirm": True,
                "accounts": multi_result.total_accounts,
                "successful_accounts": multi_result.successful_accounts,
            },
        )

        log.info(
            f"{user_tag}Signal confirmed: {multi_result.summary_message}",
            signal_id=signal_id,
            symbol=parsed.symbol,
            direction=parsed.direction,
            lot_size=lot_size,
            trades=len(multi_result.all_executions),
            accounts=f"{multi_result.successful_accounts}/{multi_result.total_accounts}",
        )

        return True


# Global instance
signal_router = SignalRouter()
