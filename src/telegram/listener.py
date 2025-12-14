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

        # For shared listener (user_id=None), we listen to ALL channels dynamically
        # so empty channel list is OK - filtering happens server-side via subscriber cache
        if not self._channels and self.user_id is not None:
            log.error(f"{user_tag}No valid channels to monitor")
            return
        elif not self._channels:
            log.info(f"{user_tag}Shared listener: will listen to ALL channels dynamically")

        # Register message handler
        # Capture self in closure for logging
        listener_self = self
        listener_user_tag = user_tag
        listener_id = id(self)
        on_message_callback = on_message  # Capture the callback

        # For shared listener (user_id=None), listen to ALL channels and filter server-side
        # This allows dynamic channel additions without restart
        listen_to_all = self.user_id is None
        chat_filter = None if listen_to_all else self._channels

        @self.client.on(events.NewMessage(chats=chat_filter))
        async def handler(event):
            """Event handler for new messages - wrapped with error handling."""
            try:
                # For shared listener, filter to only channels (not private chats/groups)
                if listen_to_all:
                    chat = event.chat
                    # Only process Channel messages (not User, Chat, etc.)
                    if not isinstance(chat, Channel):
                        return

                # Log immediately when event handler fires - before any processing
                log.info(
                    f"{listener_user_tag}⚡ RAW EVENT RECEIVED",
                    listener_id=listener_id,
                    message_id=event.message.id,
                    chat_id=event.chat_id,
                    chat_title=getattr(event.chat, 'title', 'unknown'),
                )
                listener_self._last_activity = datetime.utcnow()

                # Verify the callback is still set
                if listener_self._on_message is None:
                    log.error(f"{listener_user_tag}❌ MESSAGE HANDLER IS NONE - cannot process!")
                    return

                # Process the message
                await listener_self._handle_message(event)

            except Exception as e:
                # Catch ALL exceptions to prevent handler from dying silently
                log.error(
                    f"{listener_user_tag}💥 EVENT HANDLER ERROR",
                    error=str(e),
                    error_type=type(e).__name__,
                    message_id=event.message.id if event and event.message else None,
                    exc_info=True,
                )

        channel_names = [
            getattr(c, "title", str(c)) for c in self._channels
        ]
        log.info(
            f"{user_tag}🎧 LISTENER NOW ACTIVE",
            channels=channel_names,
            listener_id=id(self),
            api_id=self._api_id,
            phone=self._phone[-4:] if self._phone else None,  # Last 4 digits for privacy
        )

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
        failed_channels = []

        log.info(f"{user_tag}📋 Resolving {len(channel_list)} channels: {channel_list}")

        for channel_id in channel_list:
            try:
                channel_id_str = str(channel_id).strip()
                entity = None

                # Try multiple resolution strategies
                if channel_id_str.startswith("@"):
                    # Username format
                    entity = await self.client.get_entity(channel_id_str)
                elif channel_id_str.lstrip("-").isdigit():
                    # Numeric ID - try as-is first
                    numeric_id = int(channel_id_str)
                    try:
                        entity = await self.client.get_entity(numeric_id)
                    except ValueError:
                        # If that fails and it's positive, try with -100 prefix (channel format)
                        if numeric_id > 0:
                            try:
                                entity = await self.client.get_entity(int(f"-100{numeric_id}"))
                            except Exception:
                                pass
                        # If negative without -100, try adding -100
                        elif not str(numeric_id).startswith("-100"):
                            try:
                                entity = await self.client.get_entity(int(f"-100{abs(numeric_id)}"))
                            except Exception:
                                pass
                else:
                    # Try as-is (might be an invite link or other format)
                    entity = await self.client.get_entity(channel_id_str)

                if entity:
                    channels.append(entity)
                    name = getattr(entity, "title", channel_id_str)
                    entity_id = getattr(entity, "id", "unknown")
                    log.info(
                        f"{user_tag}✅ Channel resolved",
                        channel=name,
                        input_id=channel_id_str,
                        resolved_id=entity_id,
                    )
                else:
                    failed_channels.append(channel_id_str)
                    log.error(f"{user_tag}❌ Could not resolve channel", channel=channel_id_str)

            except Exception as e:
                failed_channels.append(str(channel_id))
                log.error(
                    f"{user_tag}❌ Channel resolution error",
                    channel=channel_id,
                    error=str(e),
                    error_type=type(e).__name__,
                )

        # Log summary
        log.info(
            f"{user_tag}📊 Channel resolution complete",
            resolved=len(channels),
            failed=len(failed_channels),
            failed_list=failed_channels if failed_channels else None,
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
        log.info(
            f"{user_tag}📨 TELEGRAM MESSAGE RECEIVED",
            channel=channel_name,
            channel_id=channel_id,
            message_id=message.id,
            preview=text[:80],
            listener_id=id(self),  # Unique ID to identify which listener instance
        )

        # Call the message handler
        if self._on_message:
            try:
                handler_name = getattr(self._on_message, '__name__', 'unknown')
                log.info(
                    f"{user_tag}📤 INVOKING MESSAGE HANDLER",
                    handler=handler_name,
                    message_id=message.id,
                    channel=channel_name,
                )
                await self._on_message({
                    "text": text,
                    "channel_name": channel_name,
                    "channel_id": channel_id,
                    "message_id": message.id,
                    "date": message.date,
                    "user_id": self.user_id,  # Include user context for multi-tenant
                })
                log.info(
                    f"{user_tag}✅ MESSAGE HANDLER COMPLETED",
                    message_id=message.id,
                )
            except Exception as e:
                log.error(
                    f"{user_tag}❌ MESSAGE HANDLER ERROR",
                    error=str(e),
                    error_type=type(e).__name__,
                    channel=channel_name,
                    message_id=message.id,
                    exc_info=True,
                )
        else:
            log.error(f"{user_tag}❌ NO MESSAGE HANDLER SET - message dropped!")

    async def _health_check_loop(self, user_tag: str):
        """Background task to monitor connection health.

        Periodically pings Telegram to verify the connection is actually working,
        not just appearing connected. Forces reconnection if connection is stale.

        IMPORTANT: This checks CONNECTION health, not message reception.
        A connection can be healthy but event handlers might not fire.
        """
        while self._is_connected:
            try:
                await asyncio.sleep(HEALTH_CHECK_INTERVAL)

                if not self._is_connected or not self.client:
                    break

                now = datetime.utcnow()

                # Track time since last MESSAGE (not health check)
                time_since_message = (
                    (now - self._last_activity).total_seconds()
                    if self._last_activity else 999999
                )

                # Track time since last health check
                time_since_health = (
                    (now - self._last_health_check).total_seconds()
                    if self._last_health_check else 999999
                )

                # Ping Telegram to verify connection
                try:
                    await asyncio.wait_for(self.client.get_me(), timeout=10.0)
                    self._last_health_check = now

                    # Check if session has changed (auth key updates) and persist if so
                    if self.client and self.user_id:
                        current_session = self.client.session.save()
                        if current_session != self._session_string:
                            self._session_string = current_session
                            await self._persist_session(user_tag)
                            log.info(f"{user_tag}Session updated and persisted")

                    # Log health status - distinguish between connection and message health
                    log.info(
                        f"{user_tag}💓 HEALTH: connection=OK, last_message={int(time_since_message)}s ago, channels={len(self._channels)}",
                    )

                except asyncio.TimeoutError:
                    log.warning(f"{user_tag}Health check timed out - connection may be stale")
                    if self.client:
                        await self.client.disconnect()
                    break

                except Exception as e:
                    log.warning(f"{user_tag}Health check failed", error=str(e))
                    if self.client:
                        await self.client.disconnect()
                    break

                # IMPORTANT: Don't use "no messages" as a reason to reconnect
                # Channels might just be quiet. Only reconnect on actual connection failures.
                # Log a notice if it's been a while since any message
                if time_since_message > STALE_CONNECTION_THRESHOLD:
                    log.info(
                        f"{user_tag}⚠️ No messages in {int(time_since_message)}s (connection OK, channels may be quiet)",
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

        log.info(
            f"{user_tag}🛑 LISTENER STOPPING",
            listener_id=id(self),
            was_connected=self._is_connected,
        )

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

    async def get_diagnostic_info(self) -> dict:
        """Get comprehensive diagnostic information about this listener.

        Returns:
            Dict with detailed status for debugging.
        """
        now = datetime.utcnow()

        # Basic connection status
        client_connected = False
        client_authorized = False
        me_info = None

        if self.client:
            try:
                client_connected = self.client.is_connected()
                if client_connected:
                    me = await asyncio.wait_for(self.client.get_me(), timeout=5.0)
                    client_authorized = me is not None
                    if me:
                        me_info = {
                            "id": me.id,
                            "username": me.username,
                            "phone": me.phone,
                        }
            except asyncio.TimeoutError:
                client_connected = False
            except Exception as e:
                me_info = {"error": str(e)}

        # Channel info
        configured_channels = self._get_channel_list()
        resolved_channels = await self.get_channel_info()

        # Event handler check - try to verify handlers are registered
        handlers_registered = False
        handler_count = 0
        if self.client and hasattr(self.client, '_event_builders'):
            handler_count = len(self.client._event_builders) if self.client._event_builders else 0
            handlers_registered = handler_count > 0

        # Calculate time since last activity
        time_since_activity = None
        if self._last_activity:
            time_since_activity = (now - self._last_activity).total_seconds()

        time_since_health_check = None
        if self._last_health_check:
            time_since_health_check = (now - self._last_health_check).total_seconds()

        return {
            "user_id": self.user_id[:8] if self.user_id else None,
            "listener_id": id(self),
            "connection": {
                "is_connected_flag": self._is_connected,
                "client_connected": client_connected,
                "client_authorized": client_authorized,
                "is_reconnecting": self._is_reconnecting,
                "reconnect_attempts": self._reconnect_attempts,
                "should_stop": self._should_stop,
            },
            "account": me_info,
            "channels": {
                "configured_count": len(configured_channels),
                "configured_ids": configured_channels,
                "resolved_count": len(resolved_channels),
                "resolved": resolved_channels,
                "missing": len(configured_channels) - len(resolved_channels),
            },
            "event_handlers": {
                "handlers_registered": handlers_registered,
                "handler_count": handler_count,
            },
            "activity": {
                "last_activity": self._last_activity.isoformat() if self._last_activity else None,
                "seconds_since_activity": int(time_since_activity) if time_since_activity else None,
                "last_health_check": self._last_health_check.isoformat() if self._last_health_check else None,
                "seconds_since_health_check": int(time_since_health_check) if time_since_health_check else None,
            },
            "timing": {
                "started_at": self._started_at.isoformat() if self._started_at else None,
                "uptime_seconds": int((now - self._started_at).total_seconds()) if self._started_at else None,
            },
            "health_task_running": self._health_task is not None and not self._health_task.done() if self._health_task else False,
        }
