"""Pydantic models for signal parsing."""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal, Optional, List


class LLMParseResult(BaseModel):
    """Raw result from LLM parsing."""

    is_signal: bool
    signal_type: Literal["OPEN", "CLOSE"] = "OPEN"  # OPEN for new trades, CLOSE for exit signals
    direction: Optional[Literal["BUY", "SELL"]] = None
    original_direction: Optional[Literal["BUY", "SELL"]] = None  # Before auto-correction
    symbol: Optional[str] = None
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profits: Optional[List[float]] = None
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    warnings: List[str] = Field(default_factory=list)
    rejection_reason: Optional[str] = None  # Why it was rejected if is_signal=false
    suggested_correction: Optional[Literal["BUY", "SELL"]] = None  # Suggested direction if fixable


class ParsedSignal(BaseModel):
    """Validated and structured signal data."""

    direction: Literal["BUY", "SELL"]
    symbol: str
    entry_price: float
    stop_loss: float
    take_profits: List[float]
    confidence: float = Field(ge=0, le=1)
    original_message: str
    parsed_at: datetime
    warnings: List[str] = Field(default_factory=list)


class ValidationResult(BaseModel):
    """Result of trade validation."""

    passed: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    adjusted_lot_size: Optional[float] = None


class TradeExecution(BaseModel):
    """Details of an executed trade."""

    order_id: str
    symbol: str
    direction: str
    lot_size: float
    entry_price: float
    stop_loss: float
    take_profit: float
    tp_index: int
