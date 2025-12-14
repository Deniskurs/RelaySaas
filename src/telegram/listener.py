"""Telegram channel listener for trading signals."""
import asyncio
from datetime import datetime
from typing import Callable, List, Optional
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from telethon.tl.types import Channel, Chat
from telethon.errors import RPCError

from .client import create_telegram_client, get_telegram_config, TelegramConfigError
from ..utils.logger import log

# Connection stability constants
MAX_RECONNECT_ATTEMPTS = 10
INITIAL_RECONNECT_DELAY = 5  # seconds
MAX_RECONNECT_DELAY = 300   # 5 minutes max backoff
HEALTH_CHECK_INTERVAL = 60  # Check connection health every 60 seconds
STALE_CONNECTION_THRESHOLD = 180  # Force reconnect if no activity for 3 minutes


class TelegramListener:
    """Listen to Telegram channels for trading signals.

    Supports two modes:
    1. Single-user (legacy): Uses global settings from environment
    2. Multi-user: Uses per-user credentials passed at initialization
    """

    def __init__(
        self,
        user_id: Optional[str] = None,
        api_id: Optional[int] = None,
        api_hash: Optional[str] = None,
        phone: Optional[str] = None,
        session_string: Optional[str] = None,
        channel_ids: Optional[List[str]] = None,
    ):
        """Initialize the Telegram listener.

        Args:
            user_id: User UUID for multi-tenant mode (None for legacy single-user).
            api_id: Telegram API ID (None uses global settings).
            api_hash: Telegram API hash (None uses global settings).
            phone: Phone number for verification (None uses global settings).
            session_string: Saved session string for reconnection.
            channel_ids: List of channel IDs/usernames to monitor (None uses global settings).
        """
        self.user_id = user_id
        self._api_id = api_id
        self._api_hash = api_hash
        self._phone = phone
        self._session_string = session_string
        self._channel_ids = channel_ids

        self.client: Optional[TelegramClient] = None
        self._on_message: Optional[Callable] = None
        self._channels: List = []
        self._is_multi_tenant = user_id is not None
        
        # Connection status tracking
        self._is_connected = False
        self._is_reconnecting = False
        self._last_activity: Optional[datetime] = None
        self._last_health_check: Optional[datetime] = None
        self._reconnect_attempts = 0
        self._started_at: Optional[datetime] = None
        self._health_task: Optional[asyncio.Task] = None
        self._should_stop = False  # Flag to stop the reconnect loop

    def _create_client(self) -> TelegramClient:
        """Create Telegram client based on mode."""
        if self._is_multi_tenant:
            # Multi-tenant: use per-user credentials with stability settings
            session = StringSession(self._session_string) if self._session_string else StringSession()
            return TelegramClient(
                session,
                self._api_id,
                self._api_hash,
                connection_retries=10,
                retry_delay=1,
                auto_reconnect=True,
                request_retries=5,
            )
        else:
            # Legacy: use global settings (already has stability settings)
            return create_telegram_client()
    
    def is_connected(self) -> bool:
        """Check if the Telegram client is currently connected."""
        if self.client is None:
            return False
        try:
            return self.client.is_connected() and self._is_connected
        except:
            return False
    
    def get_connection_status(self) -> dict:
        """Get detailed connection status for dashboard display."""
        return {
            "connected": self._is_connected,
            "reconnecting": self._is_reconnecting,
            "last_activity": self._last_activity.isoformat() if self._last_activity else None,
            "last_health_check": self._last_health_check.isoformat() if self._last_health_check else None,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "reconnect_attempts": self._reconnect_attempts,
            "channels_count": len(self._channels),
        }

    def _get_phone(self) -> str:
        """Get phone number based on mode."""
        if self._is_multi_tenant:
            return self._phone
        # Get from database config
        config = get_telegram_config()
        return config["phone"]

    def _get_channel_list(self) -> List[str]:
        """Get channel list based on mode."""
        if self._is_multi_tenant and self._channel_ids:
            return self._channel_ids
        # Get from database config
        config = get_telegram_config()
        return config["channel_ids"]

    async def start(self, on_message: Callable):
        """Start the Telegram listener with auto-reconnect.

        Args:
            on_message: Async callback function for new messages.
                       Called with dict containing: text, channel_name, channel_id, message_id, date, user_id
        """
        self._on_message = on_message
        self._started_at = datetime.utcnow()
        self._should_stop = False
        user_tag = f"[user:{self.user_id[:8]}] " if self.user_id else ""

        # Reconnect loop with exponential backoff
        while not self._should_stop:
            try:
                await self._connect_and_listen(user_tag)
            except Exception as e:
                # Check if we should stop before reconnecting
                if self._should_stop:
                    log.info(f"{user_tag}Telegram listener stopped")
                    break

                self._is_connected = False
                self._is_reconnecting = True
                self._reconnect_attempts += 1

                if self._reconnect_attempts > MAX_RECONNECT_ATTEMPTS:
                    log.error(
                        f"{user_tag}Max reconnection attempts reached",
                        attempts=self._reconnect_attempts,
                        error=str(e),
                    )
                    self._is_reconnecting = False
                    raise

                # Exponential backoff with jitter
                delay = min(
                    INITIAL_RECONNECT_DELAY * (2 ** (self._reconnect_attempts - 1)),
                    MAX_RECONNECT_DELAY
                )
                log.warning(
                    f"{user_tag}Telegram connection lost, reconnecting...",
                    attempt=self._reconnect_attempts,
                    delay=delay,
                    error=str(e),
                )

                await asyncio.sleep(delay)

        log.info(f"{user_tag}Telegram listener loop exited")
    
    async def _connect_and_listen(self, user_tag: str):
        """Internal method to connect and start listening."""
        self.client = self._create_client()
        
        log.info(f"{user_tag}Starting Telegram client...")
        await self.client.start(phone=self._get_phone())
        
        self._is_connected = True
        self._is_reconnecting = False
        self._reconnect_attempts = 0
        self._last_activity = datetime.utcnow()
        log.info(f"{user_tag}Telegram client connected")

        # Save session string for reconnection and persist to database
        if self.client:
            new_session = self.client.session.save()
            if new_session != self._session_string:
                self._session_string = new_session
                # Persist to database so it survives restarts
                await self._persist_session(user_tag)

        # Resolve channel IDs
        self._channels = await self._resolve_channels()

        if not self._channels:
            log.error(f"{user_tag}No valid channels to monitor")
            return

        # Register message handler
        @self.client.on(events.NewMessage(chats=self._channels))
        async def handler(event):
            self._last_activity = datetime.utcnow()
            await self._handle_message(event)

        channel_names = [
            getattr(c, "title", str(c)) for c in self._channels
        ]
        log.info(f"{user_tag}Listening for signals", channels=channel_names)

        # Start health check background task
        self._health_task = asyncio.create_task(self._health_check_loop(user_tag))
        log.debug(f"{user_tag}Started connection health monitor (interval: {HEALTH_CHECK_INTERVAL}s)")

        # Keep running - this blocks until disconnected
        await self.client.run_until_disconnected()

        # If we get here, we were disconnected
        self._is_connected = False

        # Cancel health check task
        if self._health_task and not self._health_task.done():
            self._health_task.cancel()
            try:
                await self._health_task
            except asyncio.CancelledError:
                pass

        log.warning(f"{user_tag}Telegram client disconnected")

    async def _resolve_channels(self) -> List:
        """Resolve channel IDs/usernames to entities.

        Returns:
            List of resolved channel entities.
        """
        channels = []
        channel_list = self._get_channel_list()
        user_tag = f"[user:{self.user_id[:8]}] " if self.user_id else ""

        for channel_id in channel_list:
            try:
                # Handle different formats
                if channel_id.startswith("@"):
                    # Username
                    entity = await self.client.get_entity(channel_id)
                elif channel_id.lstrip("-").isdigit():
                    # Numeric ID
                    entity = await self.client.get_entity(int(channel_id))
                else:
                    # Try as-is
                    entity = await self.client.get_entity(channel_id)

                channels.append(entity)
                name = getattr(entity, "title", channel_id)
                log.info(f"{user_tag}Monitoring channel", channel=name, id=channel_id)

            except Exception as e:
                log.error(
                    f"{user_tag}Could not resolve channel",
                    channel=channel_id,
                    error=str(e),
                )

        return channels

    async def _handle_message(self, event):
        """Handle incoming message event.

        Args:
            event: Telethon message event.
        """
        message = event.message

        # Get channel info
        chat = event.chat
        channel_name = getattr(chat, "title", "Unknown")
        channel_id = str(event.chat_id)

        # Extract text
        text = message.text or ""

        # Skip empty or very short messages
        if not text or len(text.strip()) < 5:
            return

        user_tag = f"[user:{self.user_id[:8]}] " if self.user_id else ""
        log.debug(
            f"{user_tag}New message received",
            channel=channel_name,
            preview=text[:50],
        )

        # Call the message handler
        if self._on_message:
            try:
                await self._on_message({
                    "text": text,
                    "channel_name": channel_name,
                    "channel_id": channel_id,
                    "message_id": message.id,
                    "date": message.date,
                    "user_id": self.user_id,  # Include user context for multi-tenant
                })
            except Exception as e:
                log.error(
                    f"{user_tag}Message handler error",
                    error=str(e),
                    channel=channel_name,
                )

    async def _health_check_loop(self, user_tag: str):
        """Background task to monitor connection health.

        Periodically pings Telegram to verify the connection is actually working,
        not just appearing connected. Forces reconnection if connection is stale.
        """
        while self._is_connected:
            try:
                await asyncio.sleep(HEALTH_CHECK_INTERVAL)

                if not self._is_connected or not self.client:
                    break

                # Check if connection has been idle too long
                now = datetime.utcnow()
                time_since_activity = (now - self._last_activity).total_seconds() if self._last_activity else STALE_CONNECTION_THRESHOLD + 1

                # Always do a ping to verify connection is alive
                try:
                    # Use get_me() as a lightweight ping - this actually talks to Telegram
                    await asyncio.wait_for(self.client.get_me(), timeout=10.0)
                    self._last_health_check = now

                    # Check if session has changed (auth key updates) and persist if so
                    if self.client and self.user_id:
                        current_session = self.client.session.save()
                        if current_session != self._session_string:
                            self._session_string = current_session
                            await self._persist_session(user_tag)
                            log.info(f"{user_tag}Session updated and persisted")

                    # Log health status periodically
                    log.debug(
                        f"{user_tag}Connection health check passed",
                        idle_seconds=int(time_since_activity),
                        channels=len(self._channels),
                    )

                except asyncio.TimeoutError:
                    log.warning(f"{user_tag}Health check timed out - connection may be stale")
                    # Force disconnect to trigger reconnection
                    if self.client:
                        await self.client.disconnect()
                    break

                except Exception as e:
                    log.warning(
                        f"{user_tag}Health check failed",
                        error=str(e),
                    )
                    # Force disconnect to trigger reconnection
                    if self.client:
                        await self.client.disconnect()
                    break

                # If we haven't received any messages in a while, log a warning
                # (This doesn't force reconnect - channels might just be quiet)
                if time_since_activity > STALE_CONNECTION_THRESHOLD:
                    log.info(
                        f"{user_tag}No messages received in {int(time_since_activity)}s - connection verified OK",
                    )

            except asyncio.CancelledError:
                break
            except Exception as e:
                log.error(f"{user_tag}Health check loop error", error=str(e))
                break

        log.debug(f"{user_tag}Health check loop ended")

    async def stop(self):
        """Stop the Telegram listener."""
        user_tag = f"[user:{self.user_id[:8]}] " if self.user_id else ""

        # Signal the reconnect loop to stop
        self._should_stop = True

        # Cancel health check task first
        if self._health_task and not self._health_task.done():
            self._health_task.cancel()
            try:
                await self._health_task
            except asyncio.CancelledError:
                pass

        if self.client:
            log.info(f"{user_tag}Stopping Telegram listener...")
            await self.client.disconnect()
            self.client = None
            self._is_connected = False

    def get_session_string(self) -> Optional[str]:
        """Get the current session string for persistence.

        Returns:
            Session string if connected, None otherwise.
        """
        if self.client and hasattr(self.client.session, 'save'):
            return self.client.session.save()
        return self._session_string

    async def _persist_session(self, user_tag: str = ""):
        """Persist the current session string to the database.

        This ensures the session survives server restarts and auth key updates
        are preserved, preventing unnecessary session expirations.
        """
        if not self.user_id or not self._session_string:
            return

        try:
            from ..users.credentials import update_user_credentials

            success = update_user_credentials(self.user_id, {
                "telegram_session_encrypted": self._session_string,
            })

            if success:
                log.debug(f"{user_tag}Session persisted to database")
            else:
                log.warning(f"{user_tag}Failed to persist session to database")

        except Exception as e:
            log.error(f"{user_tag}Error persisting session", error=str(e))

    async def get_channel_info(self) -> List[dict]:
        """Get information about monitored channels.

        Returns:
            List of channel info dicts.
        """
        info = []
        for channel in self._channels:
            info.append({
                "id": getattr(channel, "id", None),
                "title": getattr(channel, "title", "Unknown"),
                "username": getattr(channel, "username", None),
            })
        return info
