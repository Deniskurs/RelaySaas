"""Telegram channel listener for trading signals."""
from typing import Callable, List, Optional
from telethon import TelegramClient, events
from telethon.tl.types import Channel, Chat

from .client import create_telegram_client
from ..config import settings
from ..utils.logger import log


class TelegramListener:
    """Listen to Telegram channels for trading signals."""

    def __init__(self):
        self.client: Optional[TelegramClient] = None
        self._on_message: Optional[Callable] = None
        self._channels: List = []

    async def start(self, on_message: Callable):
        """Start the Telegram listener.

        Args:
            on_message: Async callback function for new messages.
                       Called with dict containing: text, channel_name, channel_id, message_id, date
        """
        self._on_message = on_message
        self.client = create_telegram_client()

        # Start client - will prompt for phone verification on first run
        log.info("Starting Telegram client...")
        await self.client.start(phone=settings.telegram_phone)
        log.info("Telegram client connected")

        # Resolve channel IDs
        self._channels = await self._resolve_channels()

        if not self._channels:
            log.error("No valid channels to monitor")
            return

        # Register message handler
        @self.client.on(events.NewMessage(chats=self._channels))
        async def handler(event):
            await self._handle_message(event)

        channel_names = [
            getattr(c, "title", str(c)) for c in self._channels
        ]
        log.info("Listening for signals", channels=channel_names)

        # Keep running
        await self.client.run_until_disconnected()

    async def _resolve_channels(self) -> List:
        """Resolve channel IDs/usernames to entities.

        Returns:
            List of resolved channel entities.
        """
        channels = []

        for channel_id in settings.channel_list:
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
                log.info("Monitoring channel", channel=name, id=channel_id)

            except Exception as e:
                log.error(
                    "Could not resolve channel",
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

        log.debug(
            "New message received",
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
                })
            except Exception as e:
                log.error(
                    "Message handler error",
                    error=str(e),
                    channel=channel_name,
                )

    async def stop(self):
        """Stop the Telegram listener."""
        if self.client:
            log.info("Stopping Telegram listener...")
            await self.client.disconnect()
            self.client = None

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
