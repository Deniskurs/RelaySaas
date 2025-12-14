"""MetaApi trade execution."""
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from metaapi_cloud_sdk import MetaApi

from ..database.supabase import get_system_config, get_settings, SYSTEM_USER_ID
from ..parser.models import ParsedSignal, TradeExecution
from ..utils.logger import log


@dataclass
class ExecutorSettings:
    """Per-user trading settings for the executor."""
    symbol_suffix: str = ""
    split_tps: bool = True
    tp_ratios: List[float] = None
    tp_lot_mode: str = "split"  # "split" = divide lot across TPs, "equal" = same lot for each TP
    gold_market_threshold: float = 3.0
    max_lot_size: float = 0.1
    default_lot_size: float = 0.01

    def __post_init__(self):
        if self.tp_ratios is None:
            self.tp_ratios = [0.5, 0.3, 0.2]

    @classmethod
    def from_user_settings(cls, user_id: str = SYSTEM_USER_ID) -> "ExecutorSettings":
        """Create ExecutorSettings from user settings in database.

        Reads trading parameters from user_settings_v2 table, NOT system_config.
        This allows per-user configuration of trading behavior.
        """
        settings = get_settings(user_id)

        # tp_split_ratios comes as list from user_settings
        tp_ratios = settings.get("tp_split_ratios", [0.5, 0.3, 0.2])
        if isinstance(tp_ratios, str):
            tp_ratios = [float(r.strip()) for r in tp_ratios.split(",") if r.strip()]

        return cls(
            symbol_suffix=settings.get("symbol_suffix", ""),
            split_tps=settings.get("split_tps", True),
            tp_ratios=tp_ratios,
            tp_lot_mode=settings.get("tp_lot_mode", "split"),
            gold_market_threshold=float(settings.get("gold_market_threshold", 3.0)),
            max_lot_size=float(settings.get("max_lot_size", 0.1)),
            default_lot_size=float(settings.get("lot_reference_size_default", 0.01)),
        )

    @classmethod
    def from_system_config(cls) -> "ExecutorSettings":
        """DEPRECATED: Use from_user_settings() instead.
        
        Kept for backward compatibility during migration.
        """
        return cls.from_user_settings(SYSTEM_USER_ID)


class TradeExecutor:
    """Execute trades via MetaApi.

    Supports two modes:
    1. Single-user (legacy): Uses global settings from database
    2. Multi-user: Uses per-user account ID and settings
    """

    def __init__(
        self,
        user_id: Optional[str] = None,
        account_id: Optional[str] = None,
        api_token: Optional[str] = None,
        executor_settings: Optional[ExecutorSettings] = None,
    ):
        """Initialize the trade executor.

        Args:
            user_id: User UUID for multi-tenant mode (None for legacy single-user).
            account_id: MetaApi account ID (None reads from database config).
            api_token: MetaApi token (None reads from database config).
            executor_settings: Per-user trading settings (None reads from database config).
        """
        self.user_id = user_id
        self._account_id = account_id
        self._api_token = api_token
        self._settings = executor_settings
        self._is_multi_tenant = user_id is not None

        self.api: Optional[MetaApi] = None
        self.account = None
        self.connection = None
        self.last_error: Optional[str] = None  # Track last execution error

    def _get_config(self) -> dict:
        """Get system config from database."""
        return get_system_config()

    def _get_account_id(self) -> str:
        """Get MetaApi account ID from user credentials or constructor."""
        if self._account_id:
            return self._account_id

        # For multi-tenant mode, get from user_credentials
        if self.user_id:
            from ..users.credentials import get_user_credentials
            creds = get_user_credentials(self.user_id)
            if creds and creds.metaapi_account_id:
                return creds.metaapi_account_id
            raise ValueError(f"No MetaAPI account configured for user {self.user_id[:8]}...")

        # Legacy fallback - but this should not be used anymore
        raise ValueError("MetaApi Account ID not configured. User must complete MetaTrader setup.")

    def _get_api_token(self) -> str:
        """Get MetaApi token from config or database."""
        if self._api_token:
            return self._api_token
        config = self._get_config()
        token = config.get("metaapi_token", "")
        if not token:
            raise ValueError("MetaApi Token not configured. Set it in Admin > System Config.")
        return token

    def _get_settings(self) -> ExecutorSettings:
        """Get executor settings from config or database."""
        if self._settings:
            return self._settings
        return ExecutorSettings.from_system_config()

    def _get_user_tag(self) -> str:
        """Get user tag for logging."""
        return f"[user:{self.user_id[:8]}] " if self.user_id else ""

    async def connect(self):
        """Connect to MetaApi and synchronize."""
        user_tag = self._get_user_tag()
        log.info(f"{user_tag}Connecting to MetaApi...")

        # Get credentials dynamically from config/database
        api_token = self._get_api_token()
        account_id = self._get_account_id()

        self.api = MetaApi(api_token)
        self.account = await self.api.metatrader_account_api.get_account(
            account_id
        )

        # Deploy if needed
        if self.account.state != "DEPLOYED":
            log.info(f"{user_tag}Deploying MetaApi account...")
            await self.account.deploy()

        # Wait for connection
        log.info(f"{user_tag}Waiting for account connection...")
        await self.account.wait_connected()

        # Get RPC connection
        self.connection = self.account.get_rpc_connection()
        await self.connection.connect()
        await self.connection.wait_synchronized()

        log.info(
            f"{user_tag}Connected to MetaApi",
            account_id=self._account_id,
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

        # Smart symbol suffix handling with fallback
        # Try with suffix first, then without if that fails
        executor_settings = self._get_settings()
        symbol_suffix = executor_settings.symbol_suffix
        base_symbol = signal.symbol
        
        # Build list of symbols to try (with suffix first, then without)
        symbols_to_try = []
        if symbol_suffix:
            symbols_to_try.append(base_symbol + symbol_suffix)  # Try with suffix first
            symbols_to_try.append(base_symbol)  # Fallback to no suffix
        else:
            symbols_to_try.append(base_symbol)  # No suffix configured
        
        # Try each symbol variant until one works
        broker_symbol = None
        current_price = None
        last_error_msg = None
        
        for try_symbol in symbols_to_try:
            try:
                price = await self.connection.get_symbol_price(try_symbol)
                if price:
                    broker_symbol = try_symbol
                    current_price = price["ask"] if signal.direction == "BUY" else price["bid"]
                    
                    # Log if we used fallback
                    if try_symbol != symbols_to_try[0]:
                        user_tag = self._get_user_tag()
                        log.info(f"{user_tag}Symbol fallback: '{symbols_to_try[0]}' not found, using '{try_symbol}'")
                    break
            except Exception as e:
                last_error_msg = str(e)
                continue
        
        # If no symbol worked, provide helpful error
        if broker_symbol is None or current_price is None:
            tried_symbols = "', '".join(symbols_to_try)
            
            # Check for weekend (forex/metals only)
            from datetime import datetime
            now_utc = datetime.utcnow()
            weekday = now_utc.weekday()
            is_weekend = weekday == 5 or weekday == 6 or (weekday == 4 and now_utc.hour >= 22)
            
            # Check if likely crypto
            symbol_upper = base_symbol.upper()
            crypto_keywords = ["BTC", "ETH", "XRP", "LTC", "ADA", "DOT", "DOGE", "SOL", "MATIC", "AVAX", "LINK"]
            is_crypto = any(kw in symbol_upper for kw in crypto_keywords)
            
            if is_weekend and not is_crypto:
                friendly_error = (
                    f"Market closed (weekend). Forex/metals markets reopen Sunday 22:00 UTC."
                )
            else:
                friendly_error = (
                    f"Symbol not found. Tried: '{tried_symbols}'. "
                    f"Verify this symbol exists on your broker."
                )
            
            self.last_error = friendly_error
            raise RuntimeError(friendly_error)

        # Determine threshold for pending vs market order
        threshold = self._get_price_threshold(signal.symbol)

        # Use dynamic settings for split TPs
        split_tps = executor_settings.split_tps
        tp_ratios = executor_settings.tp_ratios
        tp_lot_mode = executor_settings.tp_lot_mode

        # Debug logging
        log.info(
            "Trade execution settings",
            split_tps=split_tps,
            split_tps_type=type(split_tps).__name__,
            num_tps=len(signal.take_profits),
            tp_ratios=tp_ratios,
            tp_lot_mode=tp_lot_mode,
            will_split=split_tps and len(signal.take_profits) > 1,
        )

        if split_tps and len(signal.take_profits) > 1:
            # Multiple TP orders
            if tp_lot_mode == "equal":
                # EQUAL MODE: Each TP gets the FULL calculated lot size
                for i, tp in enumerate(signal.take_profits):
                    execution = await self._place_order(
                        signal=signal,
                        broker_symbol=broker_symbol,
                        lot_size=lot_size,  # Full lot for each TP
                        take_profit=tp,
                        tp_index=i + 1,
                        current_price=current_price,
                        threshold=threshold,
                    )
                    if execution:
                        executions.append(execution)
            else:
                # SPLIT MODE (default): Divide lot across TPs using ratios
                ratios = tp_ratios[: len(signal.take_profits)]
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

            # Include user_id in comment for trade tracking (multi-tenant only)
            if self.user_id:
                comment = f"U:{self.user_id[:8]} TP{tp_index}"
            else:
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

            user_tag = self._get_user_tag()
            log.info(
                f"{user_tag}Order placed",
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
            user_tag = self._get_user_tag()
            error_msg = str(e)
            self.last_error = error_msg  # Store error for caller to retrieve
            log.error(
                f"{user_tag}Order failed",
                error=error_msg,
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
            executor_settings = self._get_settings()
            return executor_settings.gold_market_threshold
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

        user_tag = self._get_user_tag()
        try:
            await self.connection.modify_position(
                position_id=position_id,
                stop_loss=new_sl,
            )
            log.info(f"{user_tag}Position SL modified", position_id=position_id, new_sl=new_sl)
        except Exception as e:
            log.error(
                f"{user_tag}Failed to modify position",
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

        user_tag = self._get_user_tag()
        try:
            await self.connection.close_position(position_id=position_id)
            log.info(f"{user_tag}Position closed", position_id=position_id)
        except Exception as e:
            log.error(
                f"{user_tag}Failed to close position",
                error=str(e),
                position_id=position_id,
            )

    async def get_deals_by_position(self, position_id: str) -> List[Dict[str, Any]]:
        """Get deal history for a position to retrieve close price/profit.

        Args:
            position_id: The MetaApi position ID.

        Returns:
            List of deal records with profit, price, time, etc.
        """
        if not self.connection:
            raise RuntimeError("Not connected to MetaApi")

        user_tag = self._get_user_tag()
        try:
            result = await self.connection.get_deals_by_position(position_id)
            # MetaApi returns {'deals': [...], 'synchronizing': bool}
            if isinstance(result, dict):
                return result.get("deals", []) or []
            return result or []
        except Exception as e:
            log.warning(
                f"{user_tag}Failed to get deals for position {position_id}",
                error=str(e),
            )
            return []

    async def disconnect(self):
        """Disconnect from MetaApi."""
        user_tag = self._get_user_tag()
        if self.connection:
            try:
                await self.connection.close()
                log.info(f"{user_tag}Disconnected from MetaApi")
            except Exception as e:
                log.error(f"{user_tag}Error disconnecting", error=str(e))
