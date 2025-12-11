"""User connection manager for multi-tenant signal copier."""
import asyncio
from typing import Dict, Optional, Set, Callable
from dataclasses import dataclass, field
from datetime import datetime

from ..utils.logger import log
from .credentials import (
    get_user_credentials,
    get_user_settings,
    UserCredentials,
    UserSettings,
)


@dataclass
class UserConnection:
    """Represents a user's active connections."""

    user_id: str
    credentials: Optional[UserCredentials] = None
    settings: Optional[UserSettings] = None

    # Connection objects (will be set when connected)
    telegram_listener: Optional[object] = None
    metaapi_executor: Optional[object] = None

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

    async def stop(self):
        """Stop all user connections."""
        self._running = False

        async with self._lock:
            for user_id in list(self._connections.keys()):
                await self._disconnect_user(user_id)

        log.info("User connection manager stopped")

    async def connect_user(self, user_id: str) -> bool:
        """Start connections for a user.

        Args:
            user_id: User UUID.

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

            log.info("User connection created", user_id=user_id)

            # Start connections in background tasks
            if credentials.has_telegram_credentials:
                task = asyncio.create_task(self._connect_telegram(user_id))
                conn._tasks.add(task)

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

        # Disconnect MetaApi
        if conn.metaapi_executor:
            try:
                await conn.metaapi_executor.disconnect()
            except Exception as e:
                log.error("Error disconnecting MetaApi", user_id=user_id, error=str(e))

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
            conn.telegram_connected = True

            log.info("Telegram listener created for user", user_id=user_id[:8])

            # Start listening in background task
            # Messages will be routed through the global message handler
            async def run_listener():
                try:
                    await listener.start(self._on_user_message)
                except Exception as e:
                    log.error(f"Telegram listener error for user {user_id[:8]}", error=str(e))
                    conn.telegram_connected = False

            task = asyncio.create_task(run_listener())
            conn._tasks.add(task)

        except Exception as e:
            log.error("Failed to connect Telegram for user", user_id=user_id[:8], error=str(e))
            conn.telegram_connected = False

    async def _on_user_message(self, message: dict):
        """Handle incoming message from any user's Telegram listener.

        Args:
            message: Dict with text, channel_name, channel_id, message_id, date, user_id.
        """
        if self._message_handler:
            await self._message_handler(message)
        else:
            log.warning("No message handler set, message dropped")

    async def _connect_metaapi(self, user_id: str):
        """Connect MetaApi executor for user.

        Args:
            user_id: User UUID.
        """
        conn = self._connections.get(user_id)
        if not conn or not conn.credentials:
            return

        # Check if we have a MetaApi account ID
        if not conn.credentials.metaapi_account_id:
            log.warning("No MetaApi account ID for user", user_id=user_id[:8])
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
                    gold_market_threshold=conn.settings.gold_market_threshold or 3.0,
                    max_lot_size=conn.settings.max_lot_size or 0.1,
                    default_lot_size=conn.settings.lot_reference_size_default or 0.01,
                )

            # Create user-specific executor
            # Uses owner's MetaApi token by default (passed as None)
            executor = TradeExecutor(
                user_id=user_id,
                account_id=conn.credentials.metaapi_account_id,
                api_token=None,  # Uses owner's token from settings
                executor_settings=executor_settings,
            )

            await executor.connect()
            conn.metaapi_executor = executor
            conn.metaapi_connected = True

            log.info("MetaApi connected for user", user_id=user_id[:8])

        except Exception as e:
            log.error("Failed to connect MetaApi for user", user_id=user_id[:8], error=str(e))
            conn.metaapi_connected = False

    def get_connection(self, user_id: str) -> Optional[UserConnection]:
        """Get user connection object.

        Args:
            user_id: User UUID.

        Returns:
            UserConnection object or None.
        """
        return self._connections.get(user_id)

    def get_executor(self, user_id: str) -> Optional[object]:
        """Get MetaApi executor for user.

        Args:
            user_id: User UUID.

        Returns:
            TradeExecutor object or None.
        """
        conn = self._connections.get(user_id)
        return conn.metaapi_executor if conn else None

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
            log.info("User settings reloaded", user_id=user_id)
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


# Global instance
user_manager = UserConnectionManager()
