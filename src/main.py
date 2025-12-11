"""Main application entry point and orchestration."""
import asyncio
from datetime import datetime
from typing import Optional

import uvicorn

from .config import settings
from .api.server import app
from .api.routes import set_account_info, set_live_positions
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

        # Update signal with parsed data
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

        # Execute trades
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
