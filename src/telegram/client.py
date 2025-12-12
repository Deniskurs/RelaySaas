"""Telegram client setup using Telethon."""
from telethon import TelegramClient
from telethon.sessions import StringSession
from ..database.supabase import get_system_config
from ..utils.logger import log


class TelegramConfigError(Exception):
    """Raised when Telegram is not properly configured."""
    pass


def get_telegram_config() -> dict:
    """Get Telegram configuration from database.

    Returns:
        Dict with api_id, api_hash, phone, session, and channel_ids.

    Raises:
        TelegramConfigError: If required config is missing.
    """
    config = get_system_config()

    api_id = config.get("telegram_api_id", "")
    api_hash = config.get("telegram_api_hash", "")
    phone = config.get("telegram_phone", "")
    session = config.get("telegram_session", "")
    channel_ids = config.get("telegram_channel_ids", "")

    missing = []
    if not api_id:
        missing.append("Telegram API ID")
    if not api_hash:
        missing.append("Telegram API Hash")
    if not phone:
        missing.append("Telegram Phone")

    if missing:
        raise TelegramConfigError(
            f"Telegram not configured. Missing: {', '.join(missing)}. "
            "Go to Admin > System Config to set up Telegram credentials."
        )

    # Warn if no session (will require interactive verification)
    if not session:
        log.warning("No saved Telegram session found. Use Admin Panel to verify Telegram first.")

    # Parse channel IDs from comma-separated string
    channel_list = [c.strip() for c in channel_ids.split(",") if c.strip()]

    return {
        "api_id": int(api_id),
        "api_hash": api_hash,
        "phone": phone,
        "session": session,
        "channel_ids": channel_list,
    }


def create_telegram_client() -> TelegramClient:
    """Create a configured Telegram client using database config.

    Uses saved session string if available (no interactive verification needed).
    Falls back to file-based session if no saved session.

    Returns:
        Configured TelegramClient instance.

    Raises:
        TelegramConfigError: If Telegram is not configured in database.
    """
    config = get_telegram_config()

    # Use StringSession if we have a saved session, otherwise file-based
    if config.get("session"):
        session = StringSession(config["session"])
        log.debug("Using saved Telegram session string")
    else:
        # Fall back to file-based session (will require interactive verification)
        session = "signal_session"
        log.debug("Using file-based Telegram session (may require verification)")

    client = TelegramClient(
        session,
        config["api_id"],
        config["api_hash"],
        # Connection stability settings
        connection_retries=10,       # Retry connection up to 10 times
        retry_delay=1,               # Start with 1 second delay between retries
        auto_reconnect=True,         # Automatically reconnect on disconnect
        request_retries=5,           # Retry failed requests
    )
    log.debug("Telegram client created with auto-reconnect enabled")
    return client
