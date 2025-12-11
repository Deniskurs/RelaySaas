"""Telegram channel listener for trading signals."""
from typing import Callable, List, Optional
from telethon import TelegramClient, events
from telethon.sessions import StringSession
from telethon.tl.types import Channel, Chat

from .client import create_telegram_client, get_telegram_config, TelegramConfigError
from ..utils.logger import log


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

    def _create_client(self) -> TelegramClient:
        """Create Telegram client based on mode."""
        if self._is_multi_tenant:
            # Multi-tenant: use per-user credentials
            session = StringSession(self._session_string) if self._session_string else StringSession()
            return TelegramClient(
                session,
                self._api_id,
                self._api_hash,
            )
        else:
            # Legacy: use global settings
            return create_telegram_client()

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
        """Start the Telegram listener.

        Args:
            on_message: Async callback function for new messages.
                       Called with dict containing: text, channel_name, channel_id, message_id, date, user_id
        """
        self._on_message = on_message
        self.client = self._create_client()

        # Start client - will prompt for phone verification on first run
        user_tag = f"[user:{self.user_id[:8]}] " if self.user_id else ""
        log.info(f"{user_tag}Starting Telegram client...")
        await self.client.start(phone=self._get_phone())
        log.info(f"{user_tag}Telegram client connected")

        # Save session string for reconnection (multi-tenant only)
        if self._is_multi_tenant and not self._session_string:
            self._session_string = self.client.session.save()
            # Note: The session should be saved to Supabase here via a callback

        # Resolve channel IDs
        self._channels = await self._resolve_channels()

        if not self._channels:
            log.error(f"{user_tag}No valid channels to monitor")
            return

        # Register message handler
        @self.client.on(events.NewMessage(chats=self._channels))
        async def handler(event):
            await self._handle_message(event)

        channel_names = [
            getattr(c, "title", str(c)) for c in self._channels
        ]
        log.info(f"{user_tag}Listening for signals", channels=channel_names)

        # Keep running
        await self.client.run_until_disconnected()

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

    async def stop(self):
        """Stop the Telegram listener."""
        if self.client:
            user_tag = f"[user:{self.user_id[:8]}] " if self.user_id else ""
            log.info(f"{user_tag}Stopping Telegram listener...")
            await self.client.disconnect()
            self.client = None

    def get_session_string(self) -> Optional[str]:
        """Get the current session string for persistence.

        Returns:
            Session string if connected, None otherwise.
        """
        if self.client and hasattr(self.client.session, 'save'):
            return self.client.session.save()
        return self._session_string

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
