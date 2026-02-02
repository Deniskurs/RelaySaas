"""User connection manager for multi-tenant signal copier."""
import asyncio
from typing import Dict, Optional, Set, Callable, List
from dataclasses import dataclass, field
from datetime import datetime

from ..utils.logger import log
from ..utils.events import event_bus, Events
from ..database import supabase_crud as crud
from .credentials import (
    get_user_credentials,
    get_user_settings,
    UserCredentials,
    UserSettings,
)
from .mt_accounts import (
    get_user_mt_accounts,
    set_account_connected,
    MTAccount,
)


@dataclass
class AccountExecutor:
    """Represents a connected MT account executor."""

    account_id: str  # user_mt_accounts.id
    metaapi_account_id: str  # MetaAPI UUID
    account_alias: str
    executor: object  # TradeExecutor instance
    is_primary: bool
    is_connected: bool = False


@dataclass
class UserConnection:
    """Represents a user's active connections."""

    user_id: str
    credentials: Optional[UserCredentials] = None
    settings: Optional[UserSettings] = None

    # Connection objects (will be set when connected)
    telegram_listener: Optional[object] = None
    metaapi_executor: Optional[object] = None  # Kept for backward compat (primary)

    # Multiple MT account executors (Phase 2)
    account_executors: Dict[str, AccountExecutor] = field(default_factory=dict)

    # Status
    telegram_connected: bool = False
    metaapi_connected: bool = False
    is_active: bool = False

    # Timestamps
    connected_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None

    # Tasks
    _tasks: Set[asyncio.Task] = field(default_factory=set)

    @property
    def is_fully_connected(self) -> bool:
        """Check if both Telegram and MetaApi are connected."""
        return self.telegram_connected and self.metaapi_connected

    @property
    def connected_account_count(self) -> int:
        """Get count of connected MT accounts."""
        return sum(1 for ae in self.account_executors.values() if ae.is_connected)


class UserConnectionManager:
    """Manages connections for multiple users."""

    def __init__(self):
        self._connections: Dict[str, UserConnection] = {}
        self._lock = asyncio.Lock()
        self._running = False
        self._message_handler: Optional[Callable] = None

    def set_message_handler(self, handler: Callable):
        """Set the callback for handling incoming messages from all users.

        Args:
            handler: Async function that accepts message dict with user_id.
        """
        self._message_handler = handler

    @property
    def active_users(self) -> int:
        """Get count of active user connections."""
        return sum(1 for c in self._connections.values() if c.is_active)

    @property
    def connected_users(self) -> int:
        """Get count of fully connected users."""
        return sum(1 for c in self._connections.values() if c.is_fully_connected)

    async def start(self):
        """Start the connection manager."""
        self._running = True
        log.info("User connection manager started")

        # Start connection watchdog
        asyncio.create_task(self._connection_watchdog())

        # Start trade sync loop (detects closed positions for win rate calculation)
        asyncio.create_task(self._trade_sync_loop())

    async def stop(self):
        """Stop all user connections."""
        self._running = False

        async with self._lock:
            for user_id in list(self._connections.keys()):
                await self._disconnect_user(user_id)

        log.info("User connection manager stopped")

    async def connect_user(self, user_id: str, skip_telegram: bool = False) -> bool:
        """Start connections for a user.

        Args:
            user_id: User UUID.
            skip_telegram: If True, don't start individual Telegram listener.
                          Use this when running in shared listener mode.

        Returns:
            True if connections started successfully.
        """
        async with self._lock:
            if user_id in self._connections and self._connections[user_id].is_active:
                log.debug("User already connected", user_id=user_id)
                return True

            # Load user credentials and settings
            credentials = get_user_credentials(user_id)
            settings = get_user_settings(user_id)

            if not credentials:
                log.warning("No credentials found for user", user_id=user_id)
                return False

            if not settings:
                log.warning("No settings found for user", user_id=user_id)
                return False

            # Create connection object
            conn = UserConnection(
                user_id=user_id,
                credentials=credentials,
                settings=settings,
                connected_at=datetime.utcnow(),
                is_active=True,
            )

            self._connections[user_id] = conn

            log.info("User connection created", user_id=user_id, skip_telegram=skip_telegram)

            # Start connections in background tasks
            # In shared listener mode, we skip individual Telegram listeners
            if credentials.has_telegram_credentials and not skip_telegram:
                task = asyncio.create_task(self._connect_telegram(user_id))
                conn._tasks.add(task)
            elif skip_telegram:
                # Mark telegram as "connected" since shared listener handles it
                conn.telegram_connected = True
                log.info(f"User {user_id[:8]} using shared Telegram listener")

            if credentials.has_metatrader_credentials:
                task = asyncio.create_task(self._connect_metaapi(user_id))
                conn._tasks.add(task)

            return True

    async def disconnect_user(self, user_id: str) -> bool:
        """Stop connections for a user.

        Args:
            user_id: User UUID.

        Returns:
            True if disconnected successfully.
        """
        async with self._lock:
            return await self._disconnect_user(user_id)

    async def _disconnect_user(self, user_id: str) -> bool:
        """Internal disconnect (must be called with lock held)."""
        conn = self._connections.get(user_id)
        if not conn:
            return True

        log.info(
            f"🔌 DISCONNECTING USER {user_id[:8]}",
            other_active_connections=[uid[:8] for uid in self._connections.keys() if uid != user_id],
            connected_accounts=conn.connected_account_count,
        )

        conn.is_active = False

        # Cancel all tasks
        for task in conn._tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        # Disconnect Telegram
        if conn.telegram_listener:
            try:
                await conn.telegram_listener.stop()
            except Exception as e:
                log.error("Error stopping Telegram listener", user_id=user_id, error=str(e))

        # Disconnect ALL MT account executors
        for account_id, account_executor in conn.account_executors.items():
            if account_executor.executor:
                try:
                    await account_executor.executor.disconnect()
                    set_account_connected(account_id, False)
                except Exception as e:
                    log.error(
                        f"Error disconnecting account '{account_executor.account_alias}'",
                        user_id=user_id,
                        error=str(e),
                    )

        conn.account_executors.clear()
        conn.metaapi_executor = None

        del self._connections[user_id]
        log.info("User disconnected", user_id=user_id)
        return True

    async def _connect_telegram(self, user_id: str):
        """Connect Telegram listener for user.

        Args:
            user_id: User UUID.
        """
        conn = self._connections.get(user_id)
        if not conn or not conn.credentials:
            return

        try:
            # Import here to avoid circular imports
            from ..telegram.listener import TelegramListener

            # Get channel IDs from user settings
            channel_ids = []
            if conn.settings and conn.settings.telegram_channel_ids:
                channel_ids = conn.settings.telegram_channel_ids

            # Create user-specific listener
            listener = TelegramListener(
                user_id=user_id,
                api_id=int(conn.credentials.telegram_api_id),
                api_hash=conn.credentials.telegram_api_hash,
                phone=conn.credentials.telegram_phone,
                session_string=conn.credentials.telegram_session_encrypted,
                channel_ids=channel_ids,
            )

            conn.telegram_listener = listener
            # Don't set telegram_connected yet - wait for actual connection

            log.info("Telegram listener created for user", user_id=user_id[:8])

            # Start listening in background task with auto-recovery
            # Messages will be routed through the global message handler
            async def run_listener_with_recovery():
                restart_count = 0
                max_restarts = 5  # Max restarts before giving up completely

                while conn.is_active and restart_count < max_restarts:
                    try:
                        log.info(f"Starting Telegram listener for user {user_id[:8]} (attempt {restart_count + 1})...")
                        await listener.start(self._on_user_message)
                    except Exception as e:
                        log.error(f"Telegram listener error for user {user_id[:8]}", error=str(e), exc_info=True)

                    # If we get here, listener stopped for some reason
                    conn.telegram_connected = False

                    if not conn.is_active:
                        log.info(f"User {user_id[:8]} disconnected, not restarting listener")
                        break

                    restart_count += 1
                    if restart_count < max_restarts:
                        wait_time = min(30 * restart_count, 120)  # Progressive backoff, max 2 min
                        log.warning(f"Listener for {user_id[:8]} stopped, restarting in {wait_time}s...")
                        await asyncio.sleep(wait_time)

                        # Reset the listener's internal state for fresh start
                        listener._reconnect_attempts = 0
                        listener._should_stop = False
                    else:
                        log.error(f"Max restarts reached for user {user_id[:8]}, listener permanently stopped")

                conn.telegram_connected = False
                log.info(f"Telegram listener ended for user {user_id[:8]}")

            task = asyncio.create_task(run_listener_with_recovery())
            conn._tasks.add(task)

            # Wait a moment for initial connection to establish
            await asyncio.sleep(2)
            conn.telegram_connected = listener.is_connected()

        except Exception as e:
            log.error("Failed to connect Telegram for user", user_id=user_id[:8], error=str(e))
            conn.telegram_connected = False

    async def _on_user_message(self, message: dict):
        """Handle incoming message from any user's Telegram listener.

        Args:
            message: Dict with text, channel_name, channel_id, message_id, date, user_id.
        """
        user_id = message.get("user_id", "unknown")
        log.info(
            f"[user:{user_id[:8] if len(user_id) > 8 else user_id}] 📬 MESSAGE HANDLER INVOKED",
            channel=message.get("channel_name"),
            message_id=message.get("message_id"),
            total_connections=len(self._connections),
        )
        if self._message_handler:
            await self._message_handler(message)
        else:
            log.warning("No message handler set, message dropped")

    async def _connect_metaapi(self, user_id: str):
        """Connect MetaApi executors for all active MT accounts.

        Connects ALL active accounts from user_mt_accounts table,
        stores them in account_executors dict, and sets primary
        as metaapi_executor for backward compatibility.

        Args:
            user_id: User UUID.
        """
        conn = self._connections.get(user_id)
        if not conn:
            log.warning("No connection for MetaApi", user_id=user_id[:8])
            return

        # Get all active MT accounts for this user
        mt_accounts = get_user_mt_accounts(user_id, active_only=True)

        if not mt_accounts:
            log.warning("No active MT accounts for user", user_id=user_id[:8])
            return

        log.info(
            f"Connecting {len(mt_accounts)} MT account(s) for user {user_id[:8]}",
            accounts=[acc.account_alias for acc in mt_accounts],
        )

        # Connect each account in parallel
        async def connect_account(acc: MTAccount):
            return await self._connect_single_account(user_id, acc)

        tasks = [connect_account(acc) for acc in mt_accounts if acc.metaapi_account_id]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Log any connection errors
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                acc = mt_accounts[i]
                log.error(
                    f"Failed to connect account '{acc.account_alias}'",
                    user_id=user_id[:8],
                    error=str(result),
                )

        # Set backward-compat primary executor
        primary = next(
            (ae for ae in conn.account_executors.values() if ae.is_primary and ae.is_connected),
            None,
        )
        if primary:
            conn.metaapi_executor = primary.executor
            conn.metaapi_connected = True
        else:
            # Fall back to any connected executor
            any_connected = next(
                (ae for ae in conn.account_executors.values() if ae.is_connected),
                None,
            )
            if any_connected:
                conn.metaapi_executor = any_connected.executor
                conn.metaapi_connected = True
            else:
                conn.metaapi_connected = False

        connected_count = conn.connected_account_count
        log.info(
            f"MetaApi connection complete for user {user_id[:8]}",
            connected=connected_count,
            total=len(mt_accounts),
        )

    async def _connect_single_account(self, user_id: str, mt_account: MTAccount):
        """Connect a single MT account and store in account_executors.

        Args:
            user_id: User UUID.
            mt_account: MTAccount to connect.
        """
        conn = self._connections.get(user_id)
        if not conn:
            return

        if not mt_account.metaapi_account_id:
            log.warning(
                f"No MetaAPI ID for account '{mt_account.account_alias}'",
                user_id=user_id[:8],
            )
            return

        try:
            # Import here to avoid circular imports
            from ..trading.executor import TradeExecutor, ExecutorSettings

            # Build executor settings from user settings
            executor_settings = ExecutorSettings()
            if conn.settings:
                executor_settings = ExecutorSettings(
                    symbol_suffix=conn.settings.symbol_suffix or "",
                    split_tps=conn.settings.split_tps if conn.settings.split_tps is not None else True,
                    tp_ratios=conn.settings.tp_split_ratios or [0.5, 0.3, 0.2],
                    tp_lot_mode=conn.settings.tp_lot_mode or "split",
                    gold_market_threshold=conn.settings.gold_market_threshold or 3.0,
                    max_lot_size=conn.settings.max_lot_size or 0.1,
                    default_lot_size=conn.settings.lot_reference_size_default or 0.01,
                )

            # Create executor for this account
            executor = TradeExecutor(
                user_id=user_id,
                account_id=mt_account.metaapi_account_id,
                api_token=None,  # Uses owner's token from settings
                executor_settings=executor_settings,
            )

            log.info(
                f"Connecting account '{mt_account.account_alias}'",
                user_id=user_id[:8],
                metaapi_id=mt_account.metaapi_account_id[:8],
            )

            await executor.connect()

            # Store in account_executors dict
            account_executor = AccountExecutor(
                account_id=mt_account.id,
                metaapi_account_id=mt_account.metaapi_account_id,
                account_alias=mt_account.account_alias,
                executor=executor,
                is_primary=mt_account.is_primary,
                is_connected=True,
            )
            conn.account_executors[mt_account.id] = account_executor

            # Update connection status in database
            set_account_connected(mt_account.id, True)

            log.info(
                f"Account '{mt_account.account_alias}' connected",
                user_id=user_id[:8],
                is_primary=mt_account.is_primary,
            )

        except Exception as e:
            log.error(
                f"Failed to connect account '{mt_account.account_alias}'",
                user_id=user_id[:8],
                error=str(e),
            )
            # Update connection status in database
            set_account_connected(mt_account.id, False)

    def get_connection(self, user_id: str) -> Optional[UserConnection]:
        """Get user connection object.

        Args:
            user_id: User UUID.

        Returns:
            UserConnection object or None.
        """
        return self._connections.get(user_id)

    def get_executor(self, user_id: str) -> Optional[object]:
        """Get primary MetaApi executor for user.

        Kept for backward compatibility - returns the primary account's executor.

        Args:
            user_id: User UUID.

        Returns:
            TradeExecutor object or None.
        """
        conn = self._connections.get(user_id)
        return conn.metaapi_executor if conn else None

    def get_all_executors(self, user_id: str) -> List[AccountExecutor]:
        """Get all connected MT account executors for a user.

        Returns executors for all active, connected MT accounts.
        Used for multi-account trade execution.

        Args:
            user_id: User UUID.

        Returns:
            List of AccountExecutor objects.
        """
        conn = self._connections.get(user_id)
        if not conn:
            return []

        return [
            ae for ae in conn.account_executors.values()
            if ae.is_connected
        ]

    def get_telegram_listener(self, user_id: str) -> Optional[object]:
        """Get Telegram listener for user.

        Args:
            user_id: User UUID.

        Returns:
            TelegramListener object or None.
        """
        conn = self._connections.get(user_id)
        return conn.telegram_listener if conn else None

    async def reload_user_settings(self, user_id: str) -> bool:
        """Reload settings for a connected user.

        Also updates the settings on ALL connected MT account executors
        so changes take effect immediately without requiring reconnection.

        Args:
            user_id: User UUID.

        Returns:
            True if settings reloaded successfully.
        """
        conn = self._connections.get(user_id)
        if not conn:
            return False

        settings = get_user_settings(user_id)
        if settings:
            conn.settings = settings

            # Build updated executor settings
            from ..trading.executor import ExecutorSettings
            new_executor_settings = ExecutorSettings(
                symbol_suffix=settings.symbol_suffix or "",
                split_tps=settings.split_tps if settings.split_tps is not None else True,
                tp_ratios=settings.tp_split_ratios or [0.5, 0.3, 0.2],
                tp_lot_mode=settings.tp_lot_mode or "split",
                gold_market_threshold=settings.gold_market_threshold or 3.0,
                max_lot_size=settings.max_lot_size or 0.1,
                default_lot_size=settings.lot_reference_size_default or 0.01,
            )

            # Update settings on ALL connected executors
            updated_count = 0
            for account_executor in conn.account_executors.values():
                if account_executor.executor and account_executor.executor._settings:
                    account_executor.executor._settings = new_executor_settings
                    updated_count += 1

            log.info(
                "User settings reloaded",
                user_id=user_id[:8],
                executors_updated=updated_count,
            )
            return True

        return False

    def get_all_active_users(self) -> list:
        """Get list of all active user IDs."""
        return [uid for uid, conn in self._connections.items() if conn.is_active]

    async def check_user_status(self, user_id: str) -> dict:
        """Get detailed status for a user connection.

        Args:
            user_id: User UUID.

        Returns:
            Status dict.
        """
        conn = self._connections.get(user_id)
        if not conn:
            return {
                "connected": False,
                "telegram_connected": False,
                "metaapi_connected": False,
            }

        return {
            "connected": conn.is_active,
            "telegram_connected": conn.telegram_connected,
            "metaapi_connected": conn.metaapi_connected,
            "connected_at": conn.connected_at.isoformat() if conn.connected_at else None,
            "last_activity": conn.last_activity.isoformat() if conn.last_activity else None,
        }

    async def _connection_watchdog(self):
        """Periodically monitor all connections and verify they're actually working.

        This helps detect "zombie" connections that appear connected but aren't
        actually receiving messages.
        """
        WATCHDOG_INTERVAL = 30  # Check every 30 seconds

        while self._running:
            try:
                await asyncio.sleep(WATCHDOG_INTERVAL)

                if not self._connections:
                    continue

                # Log status of all connections
                healthy = 0
                unhealthy = 0

                for user_id, conn in list(self._connections.items()):
                    if not conn.is_active:
                        continue

                    # Check Telegram listener health
                    telegram_healthy = False
                    if conn.telegram_listener:
                        try:
                            # Check if listener thinks it's connected
                            listener_connected = conn.telegram_listener.is_connected()
                            # Also check if client is actually connected
                            client_connected = (
                                conn.telegram_listener.client and
                                conn.telegram_listener.client.is_connected()
                            )
                            telegram_healthy = listener_connected and client_connected

                            # Update connection status if mismatched
                            if conn.telegram_connected != telegram_healthy:
                                log.warning(
                                    f"🔄 Connection status mismatch for {user_id[:8]}",
                                    stored=conn.telegram_connected,
                                    actual=telegram_healthy,
                                )
                                conn.telegram_connected = telegram_healthy

                        except Exception as e:
                            log.error(f"Watchdog check failed for {user_id[:8]}", error=str(e))
                            telegram_healthy = False

                    if telegram_healthy:
                        healthy += 1
                    else:
                        unhealthy += 1

                # Log summary
                if unhealthy > 0:
                    log.warning(
                        f"👀 WATCHDOG: {healthy} healthy, {unhealthy} unhealthy connections",
                        total=len(self._connections),
                    )
                else:
                    log.debug(
                        f"👀 WATCHDOG: All {healthy} connections healthy",
                    )

            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error("Watchdog error", error=str(e))

        log.info("Connection watchdog stopped")

    async def _trade_sync_loop(self):
        """Periodically sync closed trades for all connected users.

        This detects when positions have closed on MetaAPI and updates
        the database with profit/loss data for accurate win rate calculation.
        Syncs across ALL connected MT accounts per user.
        """
        SYNC_INTERVAL = 30  # Sync every 30 seconds

        while self._running:
            try:
                await asyncio.sleep(SYNC_INTERVAL)

                if not self._connections:
                    continue

                # Sync trades for all active users with any connected MT accounts
                for user_id, conn in list(self._connections.items()):
                    if not conn.is_active:
                        continue

                    # Check if any accounts are connected
                    if conn.connected_account_count == 0:
                        continue

                    try:
                        await self._sync_closed_trades_for_user(user_id, conn)
                    except Exception as e:
                        log.error(
                            f"Trade sync failed for user {user_id[:8]}",
                            error=str(e),
                        )

            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error("Trade sync loop error", error=str(e))

        log.info("Trade sync loop stopped")

    async def _sync_closed_trades_for_user(self, user_id: str, conn: UserConnection):
        """Sync closed trades for a specific user across all MT accounts.

        Iterates over all connected account executors and compares
        database trades with live MetaAPI positions, marking trades
        as closed when their positions no longer exist.

        Args:
            user_id: User UUID.
            conn: User's connection object.
        """
        # Sync each connected account
        for account_id, account_executor in conn.account_executors.items():
            if not account_executor.is_connected or not account_executor.executor:
                continue

            try:
                await self._sync_closed_trades_for_account(
                    user_id=user_id,
                    account_id=account_id,
                    account_alias=account_executor.account_alias,
                    executor=account_executor.executor,
                )
            except Exception as e:
                log.error(
                    f"Trade sync failed for account '{account_executor.account_alias}'",
                    user_id=user_id[:8],
                    error=str(e),
                )

    async def _sync_closed_trades_for_account(
        self, user_id: str, account_id: str, account_alias: str, executor
    ):
        """Sync closed trades for a specific MT account.

        Args:
            user_id: User UUID.
            account_id: MT account UUID (user_mt_accounts.id).
            account_alias: Account display name for logging.
            executor: TradeExecutor for this account.
        """
        try:
            # Get current live positions from MetaAPI
            account_info = await executor.get_account_info()
            live_positions = account_info.get("positions", [])

            # Build set of currently open position IDs
            live_position_ids = set()
            for pos in live_positions:
                pos_id = str(pos.get("id") or pos.get("positionId", ""))
                if pos_id:
                    live_position_ids.add(pos_id)

            # Get trades for this specific account
            db_trades = await crud.get_open_trades_for_sync(
                user_id=user_id,
                mt_account_id=account_id,
            )

            if not db_trades:
                return

            closed_count = 0
            for trade in db_trades:
                order_id = str(trade.get("order_id", ""))
                trade_id = trade["id"]

                # Check if this trade's order_id matches any live position
                if order_id and order_id not in live_position_ids:
                    # Position has closed - fetch deal history and update DB
                    await self._process_closed_trade(user_id, trade_id, order_id, executor)
                    closed_count += 1

            if closed_count > 0:
                log.info(
                    f"Synced {closed_count} closed trades for account '{account_alias}'",
                    user_id=user_id[:8],
                    account_id=account_id[:8],
                )

        except Exception as e:
            log.error(
                f"Failed to sync trades for account '{account_alias}'",
                user_id=user_id[:8],
                error=str(e),
            )

    async def _process_closed_trade(
        self, user_id: str, trade_id: int, position_id: str, executor
    ):
        """Process a trade that appears to have closed.

        Fetches deal history to get close price and profit, then updates DB.

        Args:
            user_id: User UUID.
            trade_id: Database trade ID.
            position_id: MetaAPI position/order ID.
            executor: User's MetaAPI executor.
        """
        try:
            # Fetch deal history from MetaAPI
            deals = await executor.get_deals_by_position(position_id)

            if not deals:
                log.warning(
                    f"No deals found for position {position_id}, marking as closed with unknown P&L",
                    user_id=user_id[:8],
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
                f"Trade closed for user {user_id[:8]}",
                trade_id=trade_id,
                position_id=position_id,
                profit=total_profit,
                close_price=close_price,
            )

            # Emit event for WebSocket clients
            await event_bus.emit(
                Events.TRADE_CLOSED,
                {
                    "user_id": user_id,
                    "trade_id": trade_id,
                    "position_id": position_id,
                    "profit": total_profit,
                    "close_price": close_price,
                },
            )

        except Exception as e:
            log.error(
                f"Failed to process closed trade {trade_id} for user {user_id[:8]}",
                error=str(e),
            )


# Global instance
user_manager = UserConnectionManager()
