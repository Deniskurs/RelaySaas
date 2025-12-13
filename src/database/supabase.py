"""Supabase client for user settings storage."""
import os
from typing import Optional
from supabase import create_client, Client

from ..config import settings as app_settings

# Initialize Supabase clients
_supabase: Optional[Client] = None
_supabase_admin: Optional[Client] = None

# DEPRECATED: These constants are kept for backward compatibility but should not be used
# in multi-tenant mode. All operations now require explicit user_id.
DEFAULT_USER_ID = "default"

# System user UUID - DEPRECATED, do not use in new code
# This was used in single-user/legacy mode but causes data sharing issues
SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"


def get_default_user_id() -> str:
    """DEPRECATED: Do not use in multi-tenant mode.

    This function is kept for backward compatibility only.
    All new code should require explicit user_id from authentication.
    """
    import warnings
    warnings.warn("get_default_user_id() is deprecated - use authenticated user_id instead", DeprecationWarning)
    return SYSTEM_USER_ID

# Default settings (used when creating new user settings)
DEFAULT_SETTINGS = {
    "user_id": DEFAULT_USER_ID,
    "max_risk_percent": 2.0,
    "max_lot_size": 0.1,
    "max_open_trades": 5,
    "lot_reference_balance": 500.0,
    "lot_reference_size_gold": 0.04,
    "lot_reference_size_default": 0.01,
    "auto_accept_symbols": ["XAUUSD", "GOLD"],
    "gold_market_threshold": 3.0,
    "split_tps": True,
    "tp_split_ratios": [0.5, 0.3, 0.2],
    "tp_lot_mode": "split",  # "split" = divide lot across TPs, "equal" = same lot for each TP
    "enable_breakeven": True,
    "symbol_suffix": "",
    "paused": False,
    "telegram_channel_ids": [],
}


def get_supabase() -> Client:
    """Get or create Supabase client (uses anon key, respects RLS)."""
    global _supabase
    if _supabase is None:
        url = app_settings.supabase_url or os.getenv("SUPABASE_URL")
        key = app_settings.supabase_key or os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        _supabase = create_client(url, key)
    return _supabase


def get_supabase_admin() -> Client:
    """Get or create Supabase admin client (uses service role key, bypasses RLS).

    Use this for backend operations that need to read/write data across all users,
    such as admin operations, profile lookups during auth, etc.
    """
    global _supabase_admin
    if _supabase_admin is None:
        url = app_settings.supabase_url or os.getenv("SUPABASE_URL")
        # Try service role key first, fall back to anon key
        service_key = app_settings.supabase_service_key or os.getenv("SUPABASE_SERVICE_KEY")
        anon_key = app_settings.supabase_key or os.getenv("SUPABASE_KEY")
        key = service_key or anon_key

        if service_key:
            print(f"[Supabase] Using service role key (bypasses RLS)")
        else:
            print(f"[Supabase] WARNING: Using anon key for admin client (RLS will apply)")

        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        _supabase_admin = create_client(url, key)
    return _supabase_admin


def get_settings(user_id: str) -> dict:
    """Get settings for a user, create defaults if not exists.

    Args:
        user_id: Required - the authenticated user's UUID. Must be provided explicitly.

    Raises:
        ValueError: If user_id is None or empty
    """
    if not user_id:
        raise ValueError("user_id is required - authentication required for settings access")

    try:
        # Use admin client to bypass RLS for backend operations
        supabase = get_supabase_admin()

        # Try to get existing settings
        result = supabase.table("user_settings_v2") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()

        if result.data and len(result.data) > 0:
            return _format_settings(result.data[0])

        # Create default settings for new user
        new_settings = {**DEFAULT_SETTINGS, "user_id": user_id}
        result = supabase.table("user_settings_v2") \
            .insert(new_settings) \
            .execute()

        if result.data and len(result.data) > 0:
            return _format_settings(result.data[0])

        # Return defaults if insert failed
        return _get_default_response()

    except Exception as e:
        print(f"[Supabase] Error getting settings: {e}")
        return _get_default_response()


def update_settings(user_id: str, settings: dict) -> dict:
    """Update settings for a user."""
    # Use admin client to bypass RLS for backend operations
    supabase = get_supabase_admin()

    print(f"[Supabase] update_settings called for user {user_id[:8]}...")
    print(f"[Supabase] Input settings: {settings}")

    # Filter out None values and internal fields
    updates = {k: v for k, v in settings.items()
               if v is not None and k not in ["id", "user_id", "created_at", "updated_at"]}

    print(f"[Supabase] Filtered updates: {updates}")

    if not updates:
        print(f"[Supabase] No updates to apply, returning current settings")
        return get_settings(user_id)

    # Helper function to attempt the update
    def try_update(update_dict: dict):
        """Try to update settings, returns (success, result_or_error)."""
        try:
            # Ensure user exists first
            existing = supabase.table("user_settings_v2") \
                .select("id") \
                .eq("user_id", user_id) \
                .execute()

            if not existing.data:
                # Create with provided settings
                print(f"[Supabase] Creating new settings for user {user_id[:8]}...")
                # Remove tp_lot_mode from DEFAULT_SETTINGS for new inserts (column may not exist)
                safe_defaults = {k: v for k, v in DEFAULT_SETTINGS.items() if k != "tp_lot_mode"}
                safe_updates = {k: v for k, v in update_dict.items() if k != "tp_lot_mode"}
                new_settings = {**safe_defaults, **safe_updates, "user_id": user_id}
                result = supabase.table("user_settings_v2") \
                    .insert(new_settings) \
                    .execute()
            else:
                # Update existing
                print(f"[Supabase] Updating existing settings for user {user_id[:8]}...")
                print(f"[Supabase] Updates to apply: {update_dict}")
                result = supabase.table("user_settings_v2") \
                    .update(update_dict) \
                    .eq("user_id", user_id) \
                    .execute()
                print(f"[Supabase] Update result.data: {result.data}")
            return True, result
        except Exception as e:
            return False, e

    # First attempt with all fields
    success, result_or_error = try_update(updates)

    if not success:
        error = result_or_error
        error_str = str(error)
        print(f"[Supabase] First update attempt failed: {error_str}")

        # Check if it's a missing column error
        if "tp_lot_mode" in error_str and ("column" in error_str.lower() or "PGRST204" in error_str):
            print(f"[Supabase] Retrying without tp_lot_mode column...")
            # Retry without tp_lot_mode
            filtered_updates = {k: v for k, v in updates.items() if k != "tp_lot_mode"}
            if filtered_updates:
                success, result_or_error = try_update(filtered_updates)

        if not success:
            print(f"[Supabase] Error updating settings: {result_or_error}")
            # Return current settings instead of defaults to preserve data
            return get_settings(user_id)

    result = result_or_error
    if result.data and len(result.data) > 0:
        print(f"[Supabase] Success! telegram_channel_ids in result: {result.data[0].get('telegram_channel_ids')}")
        return _format_settings(result.data[0])

    print(f"[Supabase] WARNING: No data returned from update, fetching current settings")
    return get_settings(user_id)


def _get_default_response() -> dict:
    """Return default settings response (without user_id)."""
    return {
        "max_risk_percent": 2.0,
        "max_lot_size": 0.1,
        "max_open_trades": 5,
        "lot_reference_balance": 500.0,
        "lot_reference_size_gold": 0.04,
        "lot_reference_size_default": 0.01,
        "auto_accept_symbols": ["XAUUSD", "GOLD"],
        "gold_market_threshold": 3.0,
        "split_tps": True,
        "tp_split_ratios": [0.5, 0.3, 0.2],
        "tp_lot_mode": "split",
        "enable_breakeven": True,
        "symbol_suffix": "",
        "paused": False,
        "telegram_channel_ids": [],
    }


def _format_settings(data: dict) -> dict:
    """Format settings from database to expected types."""
    return {
        "max_risk_percent": float(data.get("max_risk_percent") or 2.0),
        "max_lot_size": float(data.get("max_lot_size") or 0.1),
        "max_open_trades": int(data.get("max_open_trades") or 5),
        "lot_reference_balance": float(data.get("lot_reference_balance") or 500.0),
        "lot_reference_size_gold": float(data.get("lot_reference_size_gold") or 0.04),
        "lot_reference_size_default": float(data.get("lot_reference_size_default") or 0.01),
        "auto_accept_symbols": data.get("auto_accept_symbols") or ["XAUUSD", "GOLD"],
        "gold_market_threshold": float(data.get("gold_market_threshold") or 3.0),
        "split_tps": bool(data.get("split_tps")) if data.get("split_tps") is not None else True,
        "tp_split_ratios": data.get("tp_split_ratios") or [0.5, 0.3, 0.2],
        "tp_lot_mode": str(data.get("tp_lot_mode") or "split"),  # "split" or "equal"
        "enable_breakeven": bool(data.get("enable_breakeven")) if data.get("enable_breakeven") is not None else True,
        "symbol_suffix": str(data.get("symbol_suffix") or ""),
        "paused": bool(data.get("paused")) if data.get("paused") is not None else False,
        "telegram_channel_ids": data.get("telegram_channel_ids") or [],
    }


# =============================================================================
# System Configuration (Admin-only settings stored in Supabase)
# =============================================================================

# Config keys that can be stored in system_config table
SYSTEM_CONFIG_KEYS = [
    # LLM
    "anthropic_api_key",
    "llm_model",
    # MetaApi
    "metaapi_token",
    "metaapi_account_id",
    # Telegram
    "telegram_api_id",
    "telegram_api_hash",
    "telegram_phone",
    "telegram_channel_ids",
    "telegram_session",  # Saved session string for auto-reconnect
    # Trading defaults
    "default_lot_size",
    "max_lot_size",
    "max_open_trades",
    "max_risk_percent",
    "symbol_suffix",
    "split_tps",
    "tp_split_ratios",
    "enable_breakeven",
]


def get_system_config() -> dict:
    """Get all system configuration from Supabase ONLY.

    Does NOT fall back to environment variables - config must be set in database via admin panel.
    Returns empty strings for unconfigured values.
    """
    # Default values (no env var fallback)
    defaults = {
        # LLM
        "anthropic_api_key": "",
        "llm_model": "claude-haiku-4-5-20251001",
        # MetaApi
        "metaapi_token": "",
        "metaapi_account_id": "",
        # Telegram
        "telegram_api_id": "",
        "telegram_api_hash": "",
        "telegram_phone": "",
        "telegram_channel_ids": "",
        # Trading defaults
        "default_lot_size": "0.01",
        "max_lot_size": "0.1",
        "max_open_trades": "5",
        "max_risk_percent": "2.0",
        "symbol_suffix": "",
        "split_tps": "true",
        "tp_split_ratios": "0.5,0.3,0.2",
        "enable_breakeven": "true",
    }

    try:
        supabase = get_supabase_admin()
        result = supabase.table("system_config").select("*").execute()

        # Build config dict from database
        config = dict(defaults)  # Start with defaults
        for row in (result.data or []):
            key = row.get("key")
            value = row.get("value")
            if key and value:  # Only override if value is not empty
                config[key] = value

        return config

    except Exception as e:
        print(f"[Supabase] Error getting system config: {e}")
        return defaults


def get_system_config_value(key: str, default: str = "") -> str:
    """Get a single system configuration value from database ONLY.

    Does NOT fall back to environment variables.
    """
    try:
        supabase = get_supabase_admin()

        result = supabase.table("system_config").select("value").eq("key", key).execute()

        if result.data and len(result.data) > 0 and result.data[0].get("value"):
            return result.data[0]["value"]

        return default

    except Exception as e:
        print(f"[Supabase] Error getting config key {key}: {e}")
        return default


def update_system_config(updates: dict) -> dict:
    """Update system configuration values.

    Uses upsert to create or update each key.
    """
    try:
        supabase = get_supabase_admin()

        for key, value in updates.items():
            if key not in SYSTEM_CONFIG_KEYS:
                continue

            # Upsert the config value
            supabase.table("system_config").upsert({
                "key": key,
                "value": str(value) if value is not None else "",
            }, on_conflict="key").execute()

        return get_system_config()

    except Exception as e:
        print(f"[Supabase] Error updating system config: {e}")
        raise e


def delete_system_config_key(key: str) -> bool:
    """Delete a system configuration key (will fall back to env var)."""
    try:
        supabase = get_supabase_admin()
        supabase.table("system_config").delete().eq("key", key).execute()
        return True
    except Exception as e:
        print(f"[Supabase] Error deleting config key {key}: {e}")
        return False
