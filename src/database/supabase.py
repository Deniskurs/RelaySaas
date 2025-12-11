"""Supabase client for user settings storage."""
import os
from typing import Optional
from supabase import create_client, Client

# Initialize Supabase client
_supabase: Optional[Client] = None

DEFAULT_USER_ID = "default"

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
    "enable_breakeven": True,
    "symbol_suffix": "",
    "paused": False,
    "telegram_channel_ids": [],
}


def get_supabase() -> Client:
    """Get or create Supabase client."""
    global _supabase
    if _supabase is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        _supabase = create_client(url, key)
    return _supabase


def get_settings(user_id: str = DEFAULT_USER_ID) -> dict:
    """Get settings for a user, create defaults if not exists."""
    try:
        supabase = get_supabase()

        # Try to get existing settings
        result = supabase.table("user_settings") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()

        if result.data and len(result.data) > 0:
            return _format_settings(result.data[0])

        # Create default settings for new user
        new_settings = {**DEFAULT_SETTINGS, "user_id": user_id}
        result = supabase.table("user_settings") \
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
    try:
        supabase = get_supabase()

        # Filter out None values and internal fields
        updates = {k: v for k, v in settings.items()
                   if v is not None and k not in ["id", "user_id", "created_at", "updated_at"]}

        if not updates:
            return get_settings(user_id)

        # Ensure user exists first
        existing = supabase.table("user_settings") \
            .select("id") \
            .eq("user_id", user_id) \
            .execute()

        if not existing.data:
            # Create with provided settings
            new_settings = {**DEFAULT_SETTINGS, **updates, "user_id": user_id}
            result = supabase.table("user_settings") \
                .insert(new_settings) \
                .execute()
        else:
            # Update existing
            result = supabase.table("user_settings") \
                .update(updates) \
                .eq("user_id", user_id) \
                .execute()

        if result.data and len(result.data) > 0:
            return _format_settings(result.data[0])

        return get_settings(user_id)

    except Exception as e:
        print(f"[Supabase] Error updating settings: {e}")
        return _get_default_response()


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
        "enable_breakeven": bool(data.get("enable_breakeven")) if data.get("enable_breakeven") is not None else True,
        "symbol_suffix": str(data.get("symbol_suffix") or ""),
        "paused": bool(data.get("paused")) if data.get("paused") is not None else False,
        "telegram_channel_ids": data.get("telegram_channel_ids") or [],
    }
