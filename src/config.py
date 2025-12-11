"""Configuration management using Pydantic settings."""
from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Telegram
    telegram_api_id: int
    telegram_api_hash: str
    telegram_phone: str
    channel_ids: str = ""  # Comma-separated

    # Anthropic
    anthropic_api_key: str
    llm_model: str = "claude-haiku-4-5-20251001"

    # MetaApi
    metaapi_token: str
    metaapi_account_id: str

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

    # Database
    database_url: str = "sqlite:///data/signals.db"

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
    return Settings()


settings = get_settings()
