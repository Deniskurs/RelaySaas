"""FastAPI REST API routes."""
from datetime import datetime
from typing import Optional, List, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..database import supabase_crud as crud
from ..database import supabase as supabase_db
# SYSTEM_USER_ID import removed - no longer needed in multi-tenant mode
from ..auth.middleware import get_optional_user, get_current_user
from ..auth.models import AuthUser
from ..users.credentials import get_user_credentials


router = APIRouter()


# Response models
class SignalResponse(BaseModel):
    """Signal response model."""

    id: int
    raw_message: str
    channel_name: str
    channel_id: Optional[str] = None
    direction: Optional[str] = None
    symbol: Optional[str] = None
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profits: list = []
    confidence: Optional[float] = None
    warnings: list = []
    status: str
    failure_reason: Optional[str] = None
    received_at: datetime
    parsed_at: Optional[datetime] = None


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
    open_price: Optional[float] = None
    close_price: Optional[float] = None
    profit: Optional[float] = None
    created_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


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
    tp_lot_mode: str  # "split" or "equal"
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
    tp_lot_mode: Optional[str] = None  # "split" or "equal"
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
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Get list of signals with optional filtering.

    When authenticated, returns signals for the current user only.
    When unauthenticated (single-user mode), returns all signals.
    """
    user_id = user.id if user else None
    signals = await crud.get_signals(limit=limit, offset=offset, status=status, user_id=user_id)
    return signals


@router.get("/signals/{signal_id}", response_model=SignalResponse)
async def get_signal(signal_id: int):
    """Get a specific signal by ID."""
    signal = await crud.get_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    return signal


# Trade endpoints
@router.get("/trades", response_model=List[TradeResponse])
async def get_trades(
    limit: int = Query(50, le=200),
    offset: int = 0,
    status: Optional[str] = None,
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Get list of trades with optional filtering.

    When authenticated, returns trades for the current user only.
    """
    user_id = user.id if user else None
    trades = await crud.get_trades(limit=limit, offset=offset, status=status, user_id=user_id)
    return trades


@router.get("/trades/open", response_model=List[TradeResponse])
async def get_open_trades(
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Get all open trades.

    When authenticated, returns open trades for the current user only.
    """
    user_id = user.id if user else None
    trades = await crud.get_open_trades(user_id=user_id)
    return trades


# Statistics endpoint
@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Get trading statistics.

    When authenticated, returns stats for the current user only.
    """
    user_id = user.id if user else None
    stats = await crud.get_stats(user_id=user_id)
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
async def get_settings_endpoint(
    user: AuthUser = Depends(get_current_user),  # REQUIRED auth - no more optional
):
    """Get all application settings from Supabase.

    Requires authentication. Returns settings for the current user only.
    """
    try:
        # User is guaranteed to exist due to get_current_user dependency
        user_id = user.id
        settings = supabase_db.get_settings(user_id=user_id)
        print(f"[API] Settings from user_settings_v2 for user {user_id[:8]}...: telegram_channel_ids = {settings.get('telegram_channel_ids')}")

        # NO FALLBACK to system_config - each user has their own isolated settings
        # If user has no channels, they get an empty list (not another user's data)

        return SettingsResponse(**settings)
    except Exception as e:
        print(f"[API] Error getting settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings", response_model=SettingsResponse)
async def update_settings_endpoint(
    settings: SettingsUpdate,
    user: AuthUser = Depends(get_current_user),  # REQUIRED auth - no more optional
):
    """Update application settings in Supabase.

    Requires authentication. Updates settings for the current user only.
    """
    try:
        # User is guaranteed to exist due to get_current_user dependency
        user_id = user.id
        updates = settings.model_dump(exclude_none=True)
        updated = supabase_db.update_settings(user_id, updates)
        return SettingsResponse(**updated)
    except Exception as e:
        print(f"[API] Error updating settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Control endpoints
@router.post("/control/pause", response_model=StatusResponse)
async def pause_processing(
    user: AuthUser = Depends(get_current_user),  # REQUIRED auth
):
    """Pause signal processing for the current user."""
    user_id = user.id
    supabase_db.update_settings(user_id, {"paused": True})
    return StatusResponse(status="paused")


@router.post("/control/resume", response_model=StatusResponse)
async def resume_processing(
    user: AuthUser = Depends(get_current_user),  # REQUIRED auth
):
    """Resume signal processing for the current user."""
    user_id = user.id
    supabase_db.update_settings(user_id, {"paused": False})
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


def get_copier():
    """Get the copier instance."""
    return _copier


@router.post("/signals/{signal_id}/correct", response_model=SignalCorrectionResponse)
async def correct_signal(
    signal_id: int,
    correction: SignalCorrectionRequest,
):
    """Correct a skipped/failed signal's direction and execute it."""
    signal = await crud.get_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if signal.get("status") not in ["skipped", "failed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Can only correct skipped or failed signals, current status: {signal.get('status')}"
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
        updated_signal = await crud.get_signal(signal_id)
        failure_reason = updated_signal.get("failure_reason") if updated_signal else "Unknown error"
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
):
    """Confirm and execute a pending signal with optional lot size override."""
    signal = await crud.get_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if signal.get("status") != "pending_confirmation":
        raise HTTPException(
            status_code=400,
            detail=f"Signal not pending confirmation, current status: {signal.get('status')}"
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
        updated_signal = await crud.get_signal(signal_id)
        failure_reason = updated_signal.get("failure_reason") if updated_signal else "Unknown error"
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
):
    """Reject a pending signal."""
    signal = await crud.get_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    if signal.get("status") != "pending_confirmation":
        raise HTTPException(
            status_code=400,
            detail=f"Signal not pending confirmation, current status: {signal.get('status')}"
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


# System status endpoint
class SystemStatusResponse(BaseModel):
    """System configuration status."""
    is_configured: bool
    missing_config: List[str] = []
    warnings: List[str] = []


@router.get("/system/status", response_model=SystemStatusResponse)
async def get_system_status():
    """Check if ADMIN infrastructure is properly configured.

    This only checks system_config (admin-level settings).
    For per-user setup status, use /user/setup-status instead.
    """
    from ..database.supabase import get_system_config

    config = get_system_config()
    missing = []
    warnings = []

    # Check required ADMIN configuration only
    # (Telegram credentials and MetaAPI account IDs are now per-user in user_credentials)
    if not config.get("anthropic_api_key"):
        missing.append("Anthropic API Key")
    if not config.get("metaapi_token"):
        missing.append("MetaApi Token")
    # Note: metaapi_account_id is per-user now, not in system_config

    return SystemStatusResponse(
        is_configured=len(missing) == 0,
        missing_config=missing,
        warnings=warnings,
    )


# User setup status endpoint
class UserSetupStatusResponse(BaseModel):
    """User's personal setup status."""
    is_setup_complete: bool
    telegram_connected: bool
    mt_connected: bool
    channels_configured: bool
    missing_steps: List[str] = []


@router.get("/user/setup-status", response_model=UserSetupStatusResponse)
async def get_user_setup_status(
    user: AuthUser = Depends(get_current_user),
):
    """Check if the current user has completed their personal setup.

    Returns status of Telegram, MetaTrader, and channel configuration.
    """
    # Get user credentials
    credentials = get_user_credentials(user.id)

    # Get user settings for channel config
    settings = supabase_db.get_settings(user.id)

    missing = []

    # Check Telegram setup
    telegram_connected = False
    if credentials:
        telegram_connected = credentials.telegram_connected or False
    if not telegram_connected:
        missing.append("Connect Telegram")

    # Check MT setup
    mt_connected = False
    if credentials:
        mt_connected = credentials.mt_connected or False
    if not mt_connected:
        missing.append("Connect MetaTrader")

    # Check channel configuration
    channels = settings.get("telegram_channel_ids", [])
    channels_configured = bool(channels and len(channels) > 0)
    if not channels_configured:
        missing.append("Add Signal Channels")

    return UserSetupStatusResponse(
        is_setup_complete=len(missing) == 0,
        telegram_connected=telegram_connected,
        mt_connected=mt_connected,
        channels_configured=channels_configured,
        missing_steps=missing,
    )


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
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Get the lot size of the most recently executed trade."""
    user_id = user.id if user else None
    trade = await crud.get_last_trade(user_id=user_id)

    if trade:
        return LastTradeLotResponse(
            lot_size=trade.get("lot_size"),
            symbol=trade.get("symbol"),
            direction=trade.get("direction"),
            timestamp=trade.get("opened_at") or trade.get("created_at"),
        )

    return LastTradeLotResponse()


# Telegram connection status endpoint (for dashboard indicator)
class TelegramConnectionStatus(BaseModel):
    """Telegram connection status for dashboard display."""
    connected: bool = False
    reconnecting: bool = False
    last_activity: Optional[str] = None
    last_health_check: Optional[str] = None
    started_at: Optional[str] = None
    reconnect_attempts: int = 0
    channels_count: int = 0


@router.get("/telegram/connection-status", response_model=TelegramConnectionStatus)
async def get_telegram_connection_status():
    """Get Telegram listener connection status for dashboard display.
    
    This is a lightweight endpoint that returns the current connection state
    without requiring admin authentication.
    """
    if not _copier or not hasattr(_copier, 'telegram'):
        return TelegramConnectionStatus()
    
    try:
        status = _copier.telegram.get_connection_status()
        return TelegramConnectionStatus(
            connected=status.get("connected", False),
            reconnecting=status.get("reconnecting", False),
            last_activity=status.get("last_activity"),
            last_health_check=status.get("last_health_check"),
            started_at=status.get("started_at"),
            reconnect_attempts=status.get("reconnect_attempts", 0),
            channels_count=status.get("channels_count", 0),
        )
    except Exception:
        return TelegramConnectionStatus()


# User credentials endpoint (for multi-tenant mode)
class UserCredentialsResponse(BaseModel):
    """User credentials for Settings page."""

    # Telegram
    telegram_api_id: Optional[str] = None
    telegram_api_hash: Optional[str] = None
    telegram_api_hash_set: bool = False  # Flag instead of exposing hash
    telegram_phone: Optional[str] = None
    telegram_connected: bool = False

    # MetaTrader
    mt_login: Optional[str] = None
    mt_server: Optional[str] = None
    mt_platform: str = "mt5"
    metaapi_account_id: Optional[str] = None
    mt_connected: bool = False


@router.get("/user/credentials", response_model=UserCredentialsResponse)
async def get_user_credentials_endpoint(
    user: AuthUser = Depends(get_current_user),
):
    """Get current user's credentials for Settings page.

    Returns Telegram and MetaTrader credentials configured during onboarding.
    Note: Sensitive fields like telegram_api_hash are returned for editing,
    but should not be displayed in full (use telegram_api_hash_set flag for UI).
    """
    credentials = get_user_credentials(user.id)

    if not credentials:
        return UserCredentialsResponse()

    return UserCredentialsResponse(
        telegram_api_id=credentials.telegram_api_id,
        telegram_api_hash=credentials.telegram_api_hash,
        telegram_api_hash_set=bool(credentials.telegram_api_hash),
        telegram_phone=credentials.telegram_phone,
        telegram_connected=credentials.telegram_connected,
        mt_login=credentials.mt_login,
        mt_server=credentials.mt_server,
        mt_platform=credentials.mt_platform,
        metaapi_account_id=credentials.metaapi_account_id,
        mt_connected=credentials.mt_connected,
    )

