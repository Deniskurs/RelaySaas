"""User credentials management with Supabase."""
from typing import Optional, Dict, Any
from dataclasses import dataclass

from ..database.supabase import get_supabase_admin
from ..utils.logger import log


@dataclass
class UserCredentials:
    """User credentials for Telegram and MetaTrader."""

    user_id: str

    # Telegram
    telegram_api_id: Optional[str] = None
    telegram_api_hash: Optional[str] = None
    telegram_phone: Optional[str] = None
    telegram_session_encrypted: Optional[str] = None
    telegram_connected: bool = False

    # MetaTrader
    mt_login: Optional[str] = None
    mt_server: Optional[str] = None
    mt_platform: str = "mt5"
    metaapi_account_id: Optional[str] = None
    mt_connected: bool = False

    @property
    def has_telegram_credentials(self) -> bool:
        """Check if Telegram credentials are configured."""
        return bool(self.telegram_api_id and self.telegram_api_hash and self.telegram_phone)

    @property
    def has_metatrader_credentials(self) -> bool:
        """Check if MetaTrader credentials are configured."""
        return bool(self.mt_login and self.mt_server)


@dataclass
class UserSettings:
    """User trading settings."""

    user_id: str

    # Risk Management
    max_risk_percent: float = 2.0
    max_lot_size: float = 0.1
    max_open_trades: int = 5

    # Lot Sizing
    lot_reference_balance: float = 500.0
    lot_reference_size_gold: float = 0.04
    lot_reference_size_default: float = 0.01

    # Execution
    auto_accept_symbols: list = None
    gold_market_threshold: float = 3.0
    split_tps: bool = True
    tp_split_ratios: list = None
    enable_breakeven: bool = True

    # Broker
    symbol_suffix: str = ""

    # Telegram Channels
    telegram_channel_ids: list = None

    # System
    paused: bool = False

    def __post_init__(self):
        if self.auto_accept_symbols is None:
            self.auto_accept_symbols = ["XAUUSD", "GOLD"]
        if self.tp_split_ratios is None:
            self.tp_split_ratios = [0.5, 0.3, 0.2]
        if self.telegram_channel_ids is None:
            self.telegram_channel_ids = []


def get_user_credentials(user_id: str) -> Optional[UserCredentials]:
    """Get user credentials from Supabase.

    Args:
        user_id: User UUID.

    Returns:
        UserCredentials object or None if not found.
    """
    try:
        supabase = get_supabase_admin()
        result = supabase.table("user_credentials").select("*").eq("user_id", user_id).execute()

        if result.data and len(result.data) > 0:
            data = result.data[0]
            return UserCredentials(
                user_id=user_id,
                telegram_api_id=data.get("telegram_api_id"),
                telegram_api_hash=data.get("telegram_api_hash"),
                telegram_phone=data.get("telegram_phone"),
                telegram_session_encrypted=data.get("telegram_session_encrypted"),
                telegram_connected=data.get("telegram_connected", False),
                mt_login=data.get("mt_login"),
                mt_server=data.get("mt_server"),
                mt_platform=data.get("mt_platform", "mt5"),
                metaapi_account_id=data.get("metaapi_account_id"),
                mt_connected=data.get("mt_connected", False),
            )
        return None
    except Exception as e:
        log.error("Error getting user credentials", user_id=user_id, error=str(e))
        return None


def update_user_credentials(user_id: str, updates: Dict[str, Any]) -> bool:
    """Update user credentials in Supabase.

    Args:
        user_id: User UUID.
        updates: Dict of fields to update.

    Returns:
        True if successful, False otherwise.
    """
    try:
        supabase = get_supabase_admin()

        # Filter out None values
        filtered_updates = {k: v for k, v in updates.items() if v is not None}

        if not filtered_updates:
            return True

        result = supabase.table("user_credentials").update(filtered_updates).eq("user_id", user_id).execute()

        return bool(result.data)
    except Exception as e:
        log.error("Error updating user credentials", user_id=user_id, error=str(e))
        return False


def get_user_settings(user_id: str) -> Optional[UserSettings]:
    """Get user trading settings from Supabase.

    Args:
        user_id: User UUID.

    Returns:
        UserSettings object or None if not found.
    """
    try:
        supabase = get_supabase_admin()
        result = supabase.table("user_settings_v2").select("*").eq("user_id", user_id).execute()

        if result.data and len(result.data) > 0:
            data = result.data[0]
            return UserSettings(
                user_id=user_id,
                max_risk_percent=float(data.get("max_risk_percent") or 2.0),
                max_lot_size=float(data.get("max_lot_size") or 0.1),
                max_open_trades=int(data.get("max_open_trades") or 5),
                lot_reference_balance=float(data.get("lot_reference_balance") or 500.0),
                lot_reference_size_gold=float(data.get("lot_reference_size_gold") or 0.04),
                lot_reference_size_default=float(data.get("lot_reference_size_default") or 0.01),
                auto_accept_symbols=data.get("auto_accept_symbols") or ["XAUUSD", "GOLD"],
                gold_market_threshold=float(data.get("gold_market_threshold") or 3.0),
                split_tps=bool(data.get("split_tps")) if data.get("split_tps") is not None else True,
                tp_split_ratios=data.get("tp_split_ratios") or [0.5, 0.3, 0.2],
                enable_breakeven=bool(data.get("enable_breakeven")) if data.get("enable_breakeven") is not None else True,
                symbol_suffix=str(data.get("symbol_suffix") or ""),
                telegram_channel_ids=data.get("telegram_channel_ids") or [],
                paused=bool(data.get("paused")) if data.get("paused") is not None else False,
            )
        return None
    except Exception as e:
        log.error("Error getting user settings", user_id=user_id, error=str(e))
        return None


def update_user_settings(user_id: str, updates: Dict[str, Any]) -> bool:
    """Update user trading settings in Supabase.

    Args:
        user_id: User UUID.
        updates: Dict of fields to update.

    Returns:
        True if successful, False otherwise.
    """
    try:
        supabase = get_supabase_admin()

        # Filter out None values
        filtered_updates = {k: v for k, v in updates.items() if v is not None}

        if not filtered_updates:
            return True

        result = supabase.table("user_settings_v2").update(filtered_updates).eq("user_id", user_id).execute()

        return bool(result.data)
    except Exception as e:
        log.error("Error updating user settings", user_id=user_id, error=str(e))
        return False
