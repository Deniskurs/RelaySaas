"""Configuration management using Pydantic settings."""
from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache
import os
import sys

# Early debug - print immediately on module load
print("=== STARTUP DEBUG ===", file=sys.stderr)
print(f"SUPABASE_URL in env: {'SUPABASE_URL' in os.environ}", file=sys.stderr)
print(f"SUPABASE_KEY in env: {'SUPABASE_KEY' in os.environ}", file=sys.stderr)
print(f"Total env vars: {len(os.environ)}", file=sys.stderr)
print("=====================", file=sys.stderr)


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Only Supabase credentials are required at startup.
    All other settings are loaded from Supabase tables at runtime.
    """

    # Telegram (optional - loaded from user_credentials table)
    telegram_api_id: int = 0
    telegram_api_hash: str = ""
    telegram_phone: str = ""
    channel_ids: str = ""  # Comma-separated

    # Anthropic (optional - loaded from system_config table)
    anthropic_api_key: str = ""
    llm_model: str = "claude-haiku-4-5-20251001"

    # MetaApi (optional - loaded from user_credentials table)
    metaapi_token: str = ""
    metaapi_account_id: str = ""

    # Trading
    default_lot_size: float = 0.01
    max_lot_size: float = 0.1
    max_open_trades: int = 5
    max_risk_percent: float = 2.0
    allowed_symbols: str = ""  # Comma-separated, empty = all
    symbol_suffix: str = ""  # Broker-specific suffix (e.g., ".raw", "m", "!")
    auto_accept_symbols: str = "XAUUSD,GOLD"  # Symbols that execute immediately without confirmation

    # Lot size scaling (reference balance: £500)
    lot_reference_balance: float = 500.0  # Reference balance for lot calculation
    lot_reference_size: float = 0.04  # Lot size at reference balance for GOLD/XAUUSD
    lot_reference_size_default: float = 0.01  # Lot size at reference balance for other symbols

    # Smart execution: GOLD threshold for market orders (in dollars)
    gold_market_threshold: float = 3.0  # Execute at market if price within $3 of entry

    # Execution
    split_tps: bool = True
    tp_split_ratios: str = "0.5,0.3,0.2"  # Comma-separated
    enable_breakeven: bool = True

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Supabase (required for bootstrap) - read directly from os.environ as fallback
    supabase_url: str = os.environ.get("SUPABASE_URL", "")
    supabase_key: str = os.environ.get("SUPABASE_KEY", "")
    supabase_service_key: str = os.environ.get("SUPABASE_SERVICE_KEY", "")
    supabase_jwt_secret: str = os.environ.get("SUPABASE_JWT_SECRET", "")

    @property
    def channel_list(self) -> List[str]:
        """Parse comma-separated channel IDs into a list."""
        return [c.strip() for c in self.channel_ids.split(",") if c.strip()]

    @property
    def symbol_whitelist(self) -> List[str]:
        """Parse comma-separated symbols into a list."""
        return [s.strip().upper() for s in self.allowed_symbols.split(",") if s.strip()]

    @property
    def auto_accept_list(self) -> List[str]:
        """Parse comma-separated auto-accept symbols into a list."""
        return [s.strip().upper() for s in self.auto_accept_symbols.split(",") if s.strip()]

    @property
    def tp_ratios(self) -> List[float]:
        """Parse comma-separated TP ratios into a list of floats."""
        return [float(r.strip()) for r in self.tp_split_ratios.split(",") if r.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    s = Settings()

    # Validate required Supabase credentials
    if not s.supabase_url or not s.supabase_key:
        import sys
        print("=" * 50, file=sys.stderr)
        print("FATAL: Missing required Supabase credentials!", file=sys.stderr)
        print(f"  SUPABASE_URL set: {bool(s.supabase_url)}", file=sys.stderr)
        print(f"  SUPABASE_KEY set: {bool(s.supabase_key)}", file=sys.stderr)
        print(f"  ENV keys available: {list(os.environ.keys())}", file=sys.stderr)
        print("=" * 50, file=sys.stderr)
        sys.exit(1)

    return s


settings = get_settings()
