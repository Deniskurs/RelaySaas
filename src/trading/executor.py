"""MetaApi trade execution."""
from typing import List, Optional, Dict, Any

from metaapi_cloud_sdk import MetaApi

from ..config import settings
from ..parser.models import ParsedSignal, TradeExecution
from ..utils.logger import log


class TradeExecutor:
    """Execute trades via MetaApi."""

    def __init__(self):
        self.api: Optional[MetaApi] = None
        self.account = None
        self.connection = None

    async def connect(self):
        """Connect to MetaApi and synchronize."""
        log.info("Connecting to MetaApi...")

        self.api = MetaApi(settings.metaapi_token)
        self.account = await self.api.metatrader_account_api.get_account(
            settings.metaapi_account_id
        )

        # Deploy if needed
        if self.account.state != "DEPLOYED":
            log.info("Deploying MetaApi account...")
            await self.account.deploy()

        # Wait for connection
        log.info("Waiting for account connection...")
        await self.account.wait_connected()

        # Get RPC connection
        self.connection = self.account.get_rpc_connection()
        await self.connection.connect()
        await self.connection.wait_synchronized()

        log.info(
            "Connected to MetaApi",
            account_id=settings.metaapi_account_id,
            state=self.account.state,
        )

    async def get_account_info(self) -> Dict[str, Any]:
        """Get current account information.

        Returns:
            Dict with balance, equity, margin, freeMargin, and positions.
        """
        if not self.connection:
            raise RuntimeError("Not connected to MetaApi")

        info = await self.connection.get_account_information()
        positions = await self.connection.get_positions()

        return {
            "balance": info.get("balance", 0),
            "equity": info.get("equity", 0),
            "margin": info.get("margin", 0),
            "freeMargin": info.get("freeMargin", 0),
            "positions": positions,
        }

    async def execute(
        self,
        signal: ParsedSignal,
        lot_size: float,
    ) -> List[TradeExecution]:
        """Execute a signal with optional TP splitting.

        Args:
            signal: Parsed signal to execute.
            lot_size: Total lot size to use.

        Returns:
            List of executed trades.
        """
        if not self.connection:
            raise RuntimeError("Not connected to MetaApi")

        executions = []

        # Apply broker symbol suffix
        broker_symbol = signal.symbol + settings.symbol_suffix

        # Get current price for order type determination
        price = await self.connection.get_symbol_price(broker_symbol)
        current_price = price["ask"] if signal.direction == "BUY" else price["bid"]

        # Determine threshold for pending vs market order
        threshold = self._get_price_threshold(signal.symbol)

        if settings.split_tps and len(signal.take_profits) > 1:
            # Split across multiple TPs
            ratios = settings.tp_ratios[: len(signal.take_profits)]
            # Normalize ratios
            total = sum(ratios)
            ratios = [r / total for r in ratios]

            for i, (tp, ratio) in enumerate(zip(signal.take_profits, ratios)):
                tp_lot = round(lot_size * ratio, 2)
                tp_lot = max(0.01, tp_lot)

                execution = await self._place_order(
                    signal=signal,
                    broker_symbol=broker_symbol,
                    lot_size=tp_lot,
                    take_profit=tp,
                    tp_index=i + 1,
                    current_price=current_price,
                    threshold=threshold,
                )
                if execution:
                    executions.append(execution)
        else:
            # Single order with TP1
            execution = await self._place_order(
                signal=signal,
                broker_symbol=broker_symbol,
                lot_size=lot_size,
                take_profit=signal.take_profits[0],
                tp_index=1,
                current_price=current_price,
                threshold=threshold,
            )
            if execution:
                executions.append(execution)

        return executions

    async def _place_order(
        self,
        signal: ParsedSignal,
        broker_symbol: str,
        lot_size: float,
        take_profit: float,
        tp_index: int,
        current_price: float,
        threshold: float,
    ) -> Optional[TradeExecution]:
        """Place a single order.

        Args:
            signal: Signal data.
            broker_symbol: Symbol with broker suffix.
            lot_size: Lot size for this order.
            take_profit: TP level for this order.
            tp_index: TP index (1, 2, 3...).
            current_price: Current market price.
            threshold: Price threshold for pending vs market.

        Returns:
            TradeExecution if successful, None otherwise.
        """
        try:
            order_type = self._get_order_type(
                signal.direction,
                signal.entry_price,
                current_price,
                threshold,
            )

            comment = f"Signal TP{tp_index}"

            if order_type == "ORDER_TYPE_BUY":
                result = await self.connection.create_market_buy_order(
                    broker_symbol,
                    lot_size,
                    signal.stop_loss,
                    take_profit,
                    {"comment": comment},
                )
            elif order_type == "ORDER_TYPE_SELL":
                result = await self.connection.create_market_sell_order(
                    broker_symbol,
                    lot_size,
                    signal.stop_loss,
                    take_profit,
                    {"comment": comment},
                )
            elif order_type == "ORDER_TYPE_BUY_LIMIT":
                result = await self.connection.create_limit_buy_order(
                    broker_symbol,
                    lot_size,
                    signal.entry_price,
                    signal.stop_loss,
                    take_profit,
                    {"comment": comment},
                )
            elif order_type == "ORDER_TYPE_SELL_LIMIT":
                result = await self.connection.create_limit_sell_order(
                    broker_symbol,
                    lot_size,
                    signal.entry_price,
                    signal.stop_loss,
                    take_profit,
                    {"comment": comment},
                )
            elif order_type == "ORDER_TYPE_BUY_STOP":
                result = await self.connection.create_stop_buy_order(
                    broker_symbol,
                    lot_size,
                    signal.entry_price,
                    signal.stop_loss,
                    take_profit,
                    {"comment": comment},
                )
            elif order_type == "ORDER_TYPE_SELL_STOP":
                result = await self.connection.create_stop_sell_order(
                    broker_symbol,
                    lot_size,
                    signal.entry_price,
                    signal.stop_loss,
                    take_profit,
                    {"comment": comment},
                )
            else:
                log.error("Unknown order type", order_type=order_type)
                return None

            order_id = result.get("orderId") or result.get("positionId") or "unknown"

            log.info(
                "Order placed",
                order_id=order_id,
                symbol=signal.symbol,
                direction=signal.direction,
                lot=lot_size,
                tp=take_profit,
                type=order_type,
            )

            return TradeExecution(
                order_id=str(order_id),
                symbol=signal.symbol,
                direction=signal.direction,
                lot_size=lot_size,
                entry_price=signal.entry_price,
                stop_loss=signal.stop_loss,
                take_profit=take_profit,
                tp_index=tp_index,
            )

        except Exception as e:
            log.error(
                "Order failed",
                error=str(e),
                symbol=signal.symbol,
                direction=signal.direction,
                lot=lot_size,
            )
            return None

    def _get_order_type(
        self,
        direction: str,
        entry_price: float,
        current_price: float,
        threshold: float,
    ) -> str:
        """Determine order type based on entry vs current price.

        Args:
            direction: BUY or SELL.
            entry_price: Desired entry price.
            current_price: Current market price.
            threshold: Price threshold for pending orders.

        Returns:
            MetaApi order type string.
        """
        if direction == "BUY":
            if entry_price < current_price - threshold:
                return "ORDER_TYPE_BUY_LIMIT"
            elif entry_price > current_price + threshold:
                return "ORDER_TYPE_BUY_STOP"
            return "ORDER_TYPE_BUY"
        else:  # SELL
            if entry_price > current_price + threshold:
                return "ORDER_TYPE_SELL_LIMIT"
            elif entry_price < current_price - threshold:
                return "ORDER_TYPE_SELL_STOP"
            return "ORDER_TYPE_SELL"

    def _get_price_threshold(self, symbol: str) -> float:
        """Get price threshold for determining order type.

        For GOLD/XAUUSD, uses configurable threshold for "smart" market execution.
        This allows fast signals to execute at market even if price moved slightly.

        Args:
            symbol: Trading symbol.

        Returns:
            Price threshold value.
        """
        symbol = symbol.upper()
        if "JPY" in symbol:
            return 0.05
        elif symbol in ["XAUUSD", "GOLD"]:
            # Smart execution: use configurable threshold (default $3)
            # This means if price is within $3 of entry, use market order
            return settings.gold_market_threshold
        elif symbol in ["DJ30", "US30", "USTEC", "NAS100"]:
            return 10.0
        else:
            return 0.0005

    async def modify_position_sl(self, position_id: str, new_sl: float):
        """Modify stop loss for a position (for breakeven).

        Args:
            position_id: Position ID to modify.
            new_sl: New stop loss price.
        """
        if not self.connection:
            raise RuntimeError("Not connected to MetaApi")

        try:
            await self.connection.modify_position(
                position_id=position_id,
                stop_loss=new_sl,
            )
            log.info("Position SL modified", position_id=position_id, new_sl=new_sl)
        except Exception as e:
            log.error(
                "Failed to modify position",
                error=str(e),
                position_id=position_id,
            )

    async def close_position(self, position_id: str):
        """Close a position.

        Args:
            position_id: Position ID to close.
        """
        if not self.connection:
            raise RuntimeError("Not connected to MetaApi")

        try:
            await self.connection.close_position(position_id=position_id)
            log.info("Position closed", position_id=position_id)
        except Exception as e:
            log.error(
                "Failed to close position",
                error=str(e),
                position_id=position_id,
            )

    async def disconnect(self):
        """Disconnect from MetaApi."""
        if self.connection:
            try:
                await self.connection.close()
                log.info("Disconnected from MetaApi")
            except Exception as e:
                log.error("Error disconnecting", error=str(e))
