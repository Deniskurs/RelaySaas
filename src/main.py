"""Main application entry point and orchestration."""
import asyncio
from datetime import datetime
from typing import Optional

import uvicorn

from .config import settings
from .api.server import app
from .api.routes import set_account_info, set_live_positions, set_copier
from .database.database import init_db, async_session
from .database import crud
from .telegram.listener import TelegramListener
from .parser.llm_parser import SignalParser
from .trading.validator import TradeValidator
from .trading.executor import TradeExecutor
from .utils.events import event_bus, Events
from .utils.logger import log


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

        # Initialize database
        await init_db()

        # Connect to MetaApi
        try:
            await self.executor.connect()
            self.validator = TradeValidator(self.executor.connection)
            log.info("MetaApi connected successfully")
        except Exception as e:
            log.error("Failed to connect to MetaApi", error=str(e))
            raise

        # Set copier reference for API routes (signal correction)
        set_copier(self)

        # Start account info updater
        self._account_update_task = asyncio.create_task(self._update_account_loop())

        # Start Telegram listener (this blocks)
        await self.telegram.start(self.on_message)

    async def on_message(self, message: dict):
        """Handle incoming Telegram message.

        Args:
            message: Dict with text, channel_name, channel_id, message_id, date.
        """
        # Check if paused
        async with async_session() as session:
            if await crud.is_paused(session):
                log.debug("Processing paused, skipping message")
                return

        text = message["text"]
        if not text or len(text) < 10:
            return

        channel_name = message["channel_name"]
        log.info("Processing message", channel=channel_name, preview=text[:50])

        # Create signal record
        async with async_session() as session:
            signal = await crud.create_signal(
                session,
                raw_message=text,
                channel_name=channel_name,
                channel_id=message.get("channel_id"),
                message_id=message.get("message_id"),
            )
            signal_id = signal.id

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

            async with async_session() as session:
                await crud.update_signal(
                    session,
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
        async with async_session() as session:
            await crud.update_signal(
                session,
                signal_id,
                direction=parsed.direction,
                symbol=parsed.symbol,
                entry_price=parsed.entry_price,
                stop_loss=parsed.stop_loss,
                take_profits=parsed.take_profits,
                confidence=parsed.confidence,
                warnings=parsed.warnings,
                status="parsed",
                parsed_at=datetime.utcnow(),
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
            async with async_session() as session:
                await crud.update_signal(
                    session,
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
            async with async_session() as session:
                await crud.update_signal(
                    session,
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
        symbol_upper = parsed.symbol.upper()
        is_auto_accept = symbol_upper in settings.auto_accept_list

        if not is_auto_accept:
            # Requires manual confirmation - save and wait
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="pending_confirmation",
                    # Store the adjusted lot size for when user confirms
                    warnings=(parsed.warnings or []) + [
                        f"Awaiting confirmation (lot size: {validation.adjusted_lot_size or settings.default_lot_size})"
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
                    "lot_size": validation.adjusted_lot_size or settings.default_lot_size,
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
        lot_size = validation.adjusted_lot_size or settings.default_lot_size

        try:
            executions = await self.executor.execute(parsed, lot_size)
        except Exception as e:
            log.error("Trade execution error", error=str(e), signal_id=signal_id)
            async with async_session() as session:
                await crud.update_signal(
                    session,
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
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason="Order execution failed",
                )

            await event_bus.emit(
                Events.SIGNAL_FAILED,
                {"id": signal_id, "errors": ["Order execution failed"]},
            )
            return

        # Save trades
        async with async_session() as session:
            await crud.update_signal(
                session,
                signal_id,
                status="executed",
                executed_at=datetime.utcnow(),
            )

            for exe in executions:
                await crud.create_trade(
                    session,
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
        async with async_session() as session:
            signal = await crud.get_signal(session, signal_id)

        if not signal:
            log.error("Signal not found for confirmation", signal_id=signal_id)
            return False

        if signal.status != "pending_confirmation":
            log.error("Signal not pending confirmation", signal_id=signal_id, status=signal.status)
            return False

        # Check we have the required fields
        if not signal.symbol or not signal.entry_price or not signal.stop_loss or not signal.direction:
            log.error("Signal missing required fields", signal_id=signal_id)
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason="Missing required fields",
                )
            return False

        take_profits = signal.take_profits or []
        if not take_profits:
            log.error("Signal has no take profits", signal_id=signal_id)
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason="No take profit levels defined",
                )
            return False

        # Create a ParsedSignal-like object
        class ConfirmedSignal:
            pass

        parsed = ConfirmedSignal()
        parsed.direction = signal.direction
        parsed.symbol = signal.symbol
        parsed.entry_price = signal.entry_price
        parsed.stop_loss = signal.stop_loss
        parsed.take_profits = take_profits
        parsed.confidence = signal.confidence or 0.8
        parsed.warnings = ["Manually confirmed"]

        # Get lot size: use override if provided, otherwise extract from warnings or use default
        if lot_size_override is not None and lot_size_override > 0:
            lot_size = lot_size_override
        else:
            lot_size = settings.default_lot_size
            for warning in (signal.warnings or []):
                if "lot size:" in warning.lower():
                    try:
                        lot_size = float(warning.split("lot size:")[1].strip().rstrip(")"))
                    except:
                        pass

        # Ensure lot size is within bounds
        lot_size = max(0.01, min(lot_size, settings.max_lot_size))

        # Execute
        try:
            executions = await self.executor.execute(parsed, lot_size)
        except Exception as e:
            log.error("Confirmed signal execution error", error=str(e))
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason=f"Execution error: {str(e)}",
                )
            return False

        if not executions:
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason="Order execution failed",
                )
            return False

        # Save trades
        async with async_session() as session:
            await crud.update_signal(
                session,
                signal_id,
                status="executed",
                executed_at=datetime.utcnow(),
            )

            for exe in executions:
                await crud.create_trade(
                    session,
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

        async with async_session() as session:
            signal = await crud.get_signal(session, signal_id)

            if not signal:
                log.error("Signal not found for rejection", signal_id=signal_id)
                return False

            if signal.status != "pending_confirmation":
                log.error("Signal not pending confirmation", signal_id=signal_id, status=signal.status)
                return False

            await crud.update_signal(
                session,
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
        async with async_session() as session:
            signal = await crud.get_signal(session, signal_id)

        if not signal:
            log.error("Signal not found for correction", signal_id=signal_id)
            return False

        # Check we have the required fields
        if not signal.symbol or not signal.entry_price or not signal.stop_loss:
            log.error("Signal missing required fields", signal_id=signal_id)
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason="Missing required fields (symbol, entry, or SL)",
                )
            return False

        take_profits = signal.take_profits or []
        if not take_profits:
            log.error("Signal has no take profits", signal_id=signal_id)
            async with async_session() as session:
                await crud.update_signal(
                    session,
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
        parsed.symbol = signal.symbol
        parsed.entry_price = signal.entry_price
        parsed.stop_loss = signal.stop_loss
        parsed.take_profits = take_profits
        parsed.confidence = signal.confidence or 0.8
        parsed.warnings = ["Direction manually corrected"]

        # Validate
        try:
            account_info = await self.executor.get_account_info()
        except Exception as e:
            log.error("Failed to get account info for correction", error=str(e))
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason=f"Account info error: {str(e)}",
                )
            return False

        validation = await self.validator.validate(parsed, account_info)

        if not validation.passed:
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason="; ".join(validation.errors),
                )
            log.warning("Corrected signal validation failed", errors=validation.errors)
            return False

        # Execute
        lot_size = validation.adjusted_lot_size or settings.default_lot_size

        try:
            executions = await self.executor.execute(parsed, lot_size)
        except Exception as e:
            log.error("Corrected signal execution error", error=str(e))
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason=f"Execution error: {str(e)}",
                )
            return False

        if not executions:
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason="Order execution failed",
                )
            return False

        # Save trades
        async with async_session() as session:
            await crud.update_signal(
                session,
                signal_id,
                direction=direction,
                status="executed",
                executed_at=datetime.utcnow(),
            )

            for exe in executions:
                await crud.create_trade(
                    session,
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
        async with async_session() as session:
            await crud.update_signal(
                session,
                signal_id,
                symbol=symbol,
                status="parsed",
                warnings=getattr(parsed, 'warnings', []),
                parsed_at=datetime.utcnow(),
            )

        # Get current positions
        try:
            account_info = await self.executor.get_account_info()
            positions = account_info.get("positions", [])
        except Exception as e:
            log.error("Failed to get positions for close signal", error=str(e))
            async with async_session() as session:
                await crud.update_signal(
                    session,
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
            async with async_session() as session:
                await crud.update_signal(
                    session,
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
        async with async_session() as session:
            if closed_count > 0:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="executed",
                    executed_at=datetime.utcnow(),
                )
            else:
                await crud.update_signal(
                    session,
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
        async with async_session() as session:
            await crud.update_signal(
                session,
                signal_id,
                symbol=target_symbol,
                status="parsed",
                warnings=warnings + [f"LOT_MODIFIER: {modifier_type} (x{multiplier})"],
                parsed_at=datetime.utcnow(),
            )

        # Get current positions to find the matching trade
        try:
            account_info = await self.executor.get_account_info()
            positions = account_info.get("positions", [])
        except Exception as e:
            log.error("Failed to get positions for lot modifier", error=str(e))
            async with async_session() as session:
                await crud.update_signal(
                    session,
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
            async with async_session() as session:
                await crud.update_signal(
                    session,
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
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason=f"Unknown position type: {position_type}",
                )
            return

        # If no SL/TP on position, we can't proceed safely
        if not stop_loss:
            log.error("Reference position has no stop loss")
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason="Reference position has no stop loss",
                )
            return

        if not take_profit:
            log.error("Reference position has no take profit")
            async with async_session() as session:
                await crud.update_signal(
                    session,
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

        new_lot_size = max(0.01, min(new_lot_size, settings.max_lot_size))

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
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason=f"Execution error: {str(e)}",
                )
            return

        if not executions:
            async with async_session() as session:
                await crud.update_signal(
                    session,
                    signal_id,
                    status="failed",
                    failure_reason="Additional order execution failed",
                )
            return

        # Save trades
        async with async_session() as session:
            await crud.update_signal(
                session,
                signal_id,
                direction=direction,
                entry_price=entry_price,
                stop_loss=stop_loss,
                take_profits=[take_profit],
                status="executed",
                executed_at=datetime.utcnow(),
            )

            for exe in executions:
                await crud.create_trade(
                    session,
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

    async def _update_account_loop(self):
        """Periodically update account info and broadcast to clients."""
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

                # Save snapshot periodically (every 5 minutes worth of updates)
                # This is handled separately to avoid DB spam

            except Exception as e:
                log.error("Account update failed", error=str(e))

            await asyncio.sleep(5)  # Update every 5 seconds

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


# Global copier instance
copier = SignalCopier()


async def run_copier():
    """Run the signal copier (Telegram listener)."""
    try:
        await copier.start()
    except Exception as e:
        log.error("Signal copier error", error=str(e))
        raise


async def main():
    """Main entry point - runs API server and signal copier."""
    # Start signal copier in background
    copier_task = asyncio.create_task(run_copier())

    # Start API server
    config = uvicorn.Config(
        app,
        host=settings.api_host,
        port=settings.api_port,
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
        await copier.stop()


if __name__ == "__main__":
    asyncio.run(main())
