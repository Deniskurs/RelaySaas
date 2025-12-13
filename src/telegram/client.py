"""Telegram client setup using Telethon."""
from telethon import TelegramClient
from telethon.sessions import StringSession
from ..database.supabase import get_system_config, get_supabase_admin
from ..utils.logger import log


class TelegramConfigError(Exception):
    """Raised when Telegram is not properly configured."""
    pass


def get_telegram_config() -> dict:
    """Get Telegram configuration from database.

    Checks both system_config (legacy) and user_credentials (multi-tenant).
    For session, prefers user_credentials.telegram_session_encrypted.
    For channels, reads from admin user's user_settings_v2.

    Returns:
        Dict with api_id, api_hash, phone, session, and channel_ids.

    Raises:
        TelegramConfigError: If required config is missing.
    """
    # First try system_config (legacy admin settings)
    config = get_system_config()

    api_id = config.get("telegram_api_id", "")
    api_hash = config.get("telegram_api_hash", "")
    phone = config.get("telegram_phone", "")
    session = config.get("telegram_session", "")
    channel_ids = config.get("telegram_channel_ids", "")

    # If no config in system_config, check user_credentials for admin user
    try:
        supabase = get_supabase_admin()

        # Get admin user's credentials
        admin_result = supabase.table("profiles").select("id").eq("role", "admin").limit(1).execute()

        if admin_result.data:
            admin_id = admin_result.data[0]["id"]

            # Get credentials from user_credentials
            creds_result = supabase.table("user_credentials").select("*").eq("user_id", admin_id).execute()
            if creds_result.data:
                creds = creds_result.data[0]

                # Use user_credentials if system_config is empty
                if not api_id and creds.get("telegram_api_id"):
                    api_id = creds["telegram_api_id"]
                if not api_hash and creds.get("telegram_api_hash"):
                    api_hash = creds["telegram_api_hash"]
                if not phone and creds.get("telegram_phone"):
                    phone = creds["telegram_phone"]

                # ALWAYS prefer user_credentials session (it's saved there by onboarding)
                if creds.get("telegram_session_encrypted"):
                    session = creds["telegram_session_encrypted"]
                    log.debug("Using session from user_credentials")

            # Get channel IDs from user_settings_v2
            settings_result = supabase.table("user_settings_v2").select("telegram_channel_ids").eq("user_id", admin_id).execute()
            if settings_result.data and settings_result.data[0].get("telegram_channel_ids"):
                # user_settings_v2 stores as array, not comma-separated string
                channel_ids = settings_result.data[0]["telegram_channel_ids"]
                log.debug(f"Using channels from user_settings_v2: {channel_ids}")

    except Exception as e:
        log.warning(f"Error checking user_credentials for Telegram config: {e}")

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
            "Complete the onboarding flow or use Settings to configure Telegram."
        )

    # Warn if no session (will require interactive verification)
    if not session:
        log.warning("No saved Telegram session found. Use Admin Panel to verify Telegram first.")

    # Parse channel IDs - handle both comma-separated string and array
    if isinstance(channel_ids, list):
        channel_list = [str(c).strip() for c in channel_ids if c]
    else:
        channel_list = [c.strip() for c in str(channel_ids).split(",") if c.strip()]

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
