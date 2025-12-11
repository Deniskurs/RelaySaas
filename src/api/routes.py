"""FastAPI REST API routes."""
from datetime import datetime
from typing import Optional, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database.database import get_session
from ..database import crud
from ..database.models import Signal, Trade


router = APIRouter()


# Response models
class SignalResponse(BaseModel):
    """Signal response model."""

    id: int
    raw_message: str
    channel_name: str
    channel_id: Optional[str]
    direction: Optional[str]
    symbol: Optional[str]
    entry_price: Optional[float]
    stop_loss: Optional[float]
    take_profits: list
    confidence: Optional[float]
    warnings: list
    status: str
    failure_reason: Optional[str]
    received_at: datetime
    parsed_at: Optional[datetime]

    class Config:
        from_attributes = True


class TradeResponse(BaseModel):
    """Trade response model."""

    id: int
    signal_id: int
    order_id: str
    symbol: str
    direction: str
    lot_size: float
    entry_price: float
    stop_loss: float
    take_profit: float
    tp_index: int
    status: str
    open_price: Optional[float]
    close_price: Optional[float]
    profit: Optional[float]
    opened_at: Optional[datetime]
    closed_at: Optional[datetime]

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    """Trading statistics response model."""

    total_signals: int
    signals_today: int
    total_trades: int
    open_trades: int
    closed_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_profit: float
    today_profit: float


class SettingsResponse(BaseModel):
    """Settings response model - all configurable settings."""

    # Risk Management
    max_risk_percent: float
    max_lot_size: float
    max_open_trades: int

    # Lot Sizing
    lot_reference_balance: float
    lot_reference_size_gold: float
    lot_reference_size_default: float

    # Execution
    auto_accept_symbols: List[str]
    gold_market_threshold: float
    split_tps: bool
    tp_split_ratios: List[float]
    enable_breakeven: bool

    # Broker
    symbol_suffix: str

    # System
    paused: bool

    # Telegram
    telegram_channel_ids: List[str]


class SettingsUpdate(BaseModel):
    """Settings update model - all fields optional."""

    # Risk Management
    max_risk_percent: Optional[float] = None
    max_lot_size: Optional[float] = None
    max_open_trades: Optional[int] = None

    # Lot Sizing
    lot_reference_balance: Optional[float] = None
    lot_reference_size_gold: Optional[float] = None
    lot_reference_size_default: Optional[float] = None

    # Execution
    auto_accept_symbols: Optional[List[str]] = None
    gold_market_threshold: Optional[float] = None
    split_tps: Optional[bool] = None
    tp_split_ratios: Optional[List[float]] = None
    enable_breakeven: Optional[bool] = None

    # Broker
    symbol_suffix: Optional[str] = None

    # System
    paused: Optional[bool] = None

    # Telegram
    telegram_channel_ids: Optional[List[str]] = None


class StatusResponse(BaseModel):
    """Status response model."""

    status: str


# Signal endpoints
@router.get("/signals", response_model=List[SignalResponse])
async def get_signals(
    limit: int = Query(50, le=200),
    offset: int = 0,
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    """Get list of signals with optional filtering."""
    signals = await crud.get_signals(session, limit=limit, offset=offset, status=status)
    return signals


@router.get("/signals/{signal_id}", response_model=SignalResponse)
async def get_signal(
    signal_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Get a specific signal by ID."""
    signal = await crud.get_signal(session, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    return signal


# Trade endpoints
@router.get("/trades", response_model=List[TradeResponse])
async def get_trades(
    limit: int = Query(50, le=200),
    offset: int = 0,
    status: Optional[str] = None,
    session: AsyncSession = Depends(get_session),
):
    """Get list of trades with optional filtering."""
    trades = await crud.get_trades(session, limit=limit, offset=offset, status=status)
    return trades


@router.get("/trades/open", response_model=List[TradeResponse])
async def get_open_trades(
    session: AsyncSession = Depends(get_session),
):
    """Get all open trades."""
    trades = await crud.get_open_trades(session)
    return trades


# Statistics endpoint
@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    session: AsyncSession = Depends(get_session),
):
    """Get trading statistics."""
    stats = await crud.get_stats(session)
    return StatsResponse(**stats)


# Account endpoint (populated by main app with live data)
# This is a placeholder - actual data comes from the executor
_account_info = {"balance": 0, "equity": 0, "margin": 0, "freeMargin": 0}
_live_positions = []


def set_account_info(info: dict):
    """Update cached account info."""
    global _account_info
    _account_info = info


def set_live_positions(positions: list):
    """Update cached live positions from MetaApi."""
    global _live_positions
    _live_positions = positions


@router.get("/account")
async def get_account():
    """Get current account information."""
    return _account_info


@router.get("/positions")
async def get_live_positions():
    """Get live open positions from MetaTrader."""
    return _live_positions


# Settings endpoints
@router.get("/settings", response_model=SettingsResponse)
async def get_settings_endpoint():
    """Get all application settings from Supabase."""
    try:
        from ..database import supabase as supabase_db
        settings = supabase_db.get_settings()
        return SettingsResponse(**settings)
    except Exception as e:
        print(f"[API] Error getting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings", response_model=SettingsResponse)
async def update_settings_endpoint(
    settings: SettingsUpdate,
):
    """Update application settings in Supabase."""
    try:
        from ..database import supabase as supabase_db
        updates = settings.model_dump(exclude_none=True)
        updated = supabase_db.update_settings("default", updates)
        return SettingsResponse(**updated)
    except Exception as e:
        print(f"[API] Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Control endpoints
@router.post("/control/pause", response_model=StatusResponse)
async def pause_processing():
    """Pause signal processing."""
    from ..database import supabase as supabase_db
    supabase_db.update_settings("default", {"paused": True})
    return StatusResponse(status="paused")


@router.post("/control/resume", response_model=StatusResponse)
async def resume_processing():
    """Resume signal processing."""
    from ..database import supabase as supabase_db
    supabase_db.update_settings("default", {"paused": False})
    return StatusResponse(status="resumed")


# Signal correction endpoint
class SignalCorrectionRequest(BaseModel):
    """Request to correct and retry a signal."""
    new_direction: Literal["BUY", "SELL"]


class SignalCorrectionResponse(BaseModel):
    """Response for signal correction."""
    status: str
    message: str = ""
    executed: bool = False


# Reference to the copier instance (set by main.py)
_copier = None


def set_copier(copier):
    """Set the copier instance for signal corrections."""
    global _copier
    _copier = copier


@router.post("/signals/{signal_id}/correct", response_model=SignalCorrectionResponse)
async def correct_signal(
    signal_id: int,
    correction: SignalCorrectionRequest,
    session: AsyncSession = Depends(get_session),
):
    """Correct a skipped/failed signal's direction and execute it."""
    signal = await crud.get_signal(session, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if signal.status not in ["skipped", "failed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Can only correct skipped or failed signals, current status: {signal.status}"
        )

    if not _copier:
        raise HTTPException(
            status_code=503,
            detail="Signal copier not initialized"
        )

    # Execute the corrected signal
    success = await _copier.execute_corrected_signal(signal_id, correction.new_direction)

    if success:
        return SignalCorrectionResponse(
            status="executed",
            message=f"Signal corrected to {correction.new_direction} and executed",
            executed=True,
        )
    else:
        # Get updated signal to see what went wrong
        updated_signal = await crud.get_signal(session, signal_id)
        failure_reason = updated_signal.failure_reason if updated_signal else "Unknown error"
        return SignalCorrectionResponse(
            status="failed",
            message=f"Correction failed: {failure_reason}",
            executed=False,
        )


class SignalConfirmRequest(BaseModel):
    """Request to confirm a signal with optional lot size."""
    lot_size: Optional[float] = None


# Signal confirmation endpoints
@router.post("/signals/{signal_id}/confirm", response_model=SignalCorrectionResponse)
async def confirm_signal(
    signal_id: int,
    confirm_request: SignalConfirmRequest = SignalConfirmRequest(),
    session: AsyncSession = Depends(get_session),
):
    """Confirm and execute a pending signal with optional lot size override."""
    signal = await crud.get_signal(session, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if signal.status != "pending_confirmation":
        raise HTTPException(
            status_code=400,
            detail=f"Signal not pending confirmation, current status: {signal.status}"
        )

    if not _copier:
        raise HTTPException(
            status_code=503,
            detail="Signal copier not initialized"
        )

    # Validate lot size if provided
    from ..config import settings
    if confirm_request.lot_size is not None:
        if confirm_request.lot_size < 0.01:
            raise HTTPException(
                status_code=400,
                detail="Lot size must be at least 0.01"
            )
        if confirm_request.lot_size > settings.max_lot_size:
            raise HTTPException(
                status_code=400,
                detail=f"Lot size cannot exceed {settings.max_lot_size}"
            )

    success = await _copier.confirm_signal(signal_id, lot_size_override=confirm_request.lot_size)

    if success:
        return SignalCorrectionResponse(
            status="executed",
            message=f"Signal confirmed and executed",
            executed=True,
        )
    else:
        updated_signal = await crud.get_signal(session, signal_id)
        failure_reason = updated_signal.failure_reason if updated_signal else "Unknown error"
        return SignalCorrectionResponse(
            status="failed",
            message=f"Execution failed: {failure_reason}",
            executed=False,
        )


class SignalRejectRequest(BaseModel):
    """Request to reject a signal."""
    reason: str = "Manually rejected"


@router.post("/signals/{signal_id}/reject", response_model=StatusResponse)
async def reject_signal(
    signal_id: int,
    rejection: SignalRejectRequest = SignalRejectRequest(),
    session: AsyncSession = Depends(get_session),
):
    """Reject a pending signal."""
    signal = await crud.get_signal(session, signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if signal.status != "pending_confirmation":
        raise HTTPException(
            status_code=400,
            detail=f"Signal not pending confirmation, current status: {signal.status}"
        )

    if not _copier:
        raise HTTPException(
            status_code=503,
            detail="Signal copier not initialized"
        )

    success = await _copier.reject_signal(signal_id, rejection.reason)

    if success:
        return StatusResponse(status="rejected")
    else:
        raise HTTPException(status_code=500, detail="Failed to reject signal")


# Health check
@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


# Lot size preset endpoints
class LotPresetsResponse(BaseModel):
    """Lot size presets based on current account balance."""
    base_lot: float
    low_lot: float      # 0.5x base
    medium_lot: float   # 1x base
    high_lot: float     # 2x base
    balance: float
    reference_balance: float
    reference_lot: float


@router.get("/account/lot-presets", response_model=LotPresetsResponse)
async def get_lot_presets(symbol: Optional[str] = None):
    """Get calculated lot size presets based on current account balance.

    Args:
        symbol: Optional symbol to calculate lots for (GOLD/XAUUSD use 0.04 base, others use 0.01)
    """
    from ..trading.validator import calculate_lot_for_symbol, get_reference_lot_for_symbol
    from ..config import settings

    balance = _account_info.get("balance", 0)

    # Use symbol-specific reference lot (GOLD=0.04, others=0.01 on £500)
    symbol_for_calc = symbol or "DEFAULT"
    reference_lot = get_reference_lot_for_symbol(symbol_for_calc)

    base_lot = calculate_lot_for_symbol(
        symbol=symbol_for_calc,
        account_balance=balance,
        min_lot=0.01,
        max_lot=settings.max_lot_size,
    )

    return LotPresetsResponse(
        base_lot=round(base_lot, 2),
        low_lot=round(max(0.01, base_lot * 0.5), 2),
        medium_lot=round(base_lot, 2),
        high_lot=round(min(base_lot * 2, settings.max_lot_size), 2),
        balance=balance,
        reference_balance=settings.lot_reference_balance,
        reference_lot=reference_lot,
    )


class LastTradeLotResponse(BaseModel):
    """Last executed trade lot size."""
    lot_size: Optional[float] = None
    symbol: Optional[str] = None
    direction: Optional[str] = None
    timestamp: Optional[datetime] = None


@router.get("/account/last-trade-lot", response_model=LastTradeLotResponse)
async def get_last_trade_lot(
    session: AsyncSession = Depends(get_session),
):
    """Get the lot size of the most recently executed trade."""
    from sqlalchemy import select, desc
    from ..database.models import Trade

    result = await session.execute(
        select(Trade)
        .order_by(desc(Trade.opened_at))
        .limit(1)
    )
    trade = result.scalar_one_or_none()

    if trade:
        return LastTradeLotResponse(
            lot_size=trade.lot_size,
            symbol=trade.symbol,
            direction=trade.direction,
            timestamp=trade.opened_at,
        )

    return LastTradeLotResponse()
