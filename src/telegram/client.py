"""Telegram client setup using Telethon."""
from telethon import TelegramClient
from ..config import settings
from ..utils.logger import log


def create_telegram_client() -> TelegramClient:
    """Create a configured Telegram client.

    Returns:
        Configured TelegramClient instance.
    """
    client = TelegramClient(
        "signal_session",
        settings.telegram_api_id,
        settings.telegram_api_hash,
    )
    log.debug("Telegram client created")
    return client
