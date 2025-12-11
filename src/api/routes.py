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
    """Settings response model."""

    paused: bool
    default_lot_size: float
    max_risk_percent: float


class SettingsUpdate(BaseModel):
    """Settings update model."""

    paused: Optional[bool] = None
    default_lot_size: Optional[float] = None
    max_risk_percent: Optional[float] = None


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
async def get_settings(
    session: AsyncSession = Depends(get_session),
):
    """Get application settings."""
    paused = await crud.get_app_state(session, "paused")
    lot_size = await crud.get_app_state(session, "default_lot_size")
    risk_percent = await crud.get_app_state(session, "max_risk_percent")

    return SettingsResponse(
        paused=(paused == "true") if paused else False,
        default_lot_size=float(lot_size) if lot_size else 0.01,
        max_risk_percent=float(risk_percent) if risk_percent else 2.0,
    )


@router.post("/settings", response_model=StatusResponse)
async def update_settings(
    settings: SettingsUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update application settings."""
    updates = settings.model_dump(exclude_none=True)
    for key, value in updates.items():
        await crud.set_app_state(session, key, str(value).lower())
    return StatusResponse(status="updated")


# Control endpoints
@router.post("/control/pause", response_model=StatusResponse)
async def pause_processing(
    session: AsyncSession = Depends(get_session),
):
    """Pause signal processing."""
    await crud.set_app_state(session, "paused", "true")
    return StatusResponse(status="paused")


@router.post("/control/resume", response_model=StatusResponse)
async def resume_processing(
    session: AsyncSession = Depends(get_session),
):
    """Resume signal processing."""
    await crud.set_app_state(session, "paused", "false")
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


# Health check
@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}
