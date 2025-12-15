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
from ..utils.logger import log


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


@router.post("/signals/{signal_id}/dismiss")
async def dismiss_signal(
    signal_id: int,
    user: AuthUser = Depends(get_current_user),
):
    """Dismiss a single signal (hide it from the list).

    The signal will be marked as dismissed and won't appear in future queries.
    """
    result = await crud.dismiss_signal(signal_id, user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Signal not found or unauthorized")
    return {"status": "dismissed", "signal_id": signal_id}


@router.post("/signals/dismiss-completed")
async def dismiss_completed_signals(
    user: AuthUser = Depends(get_current_user),
):
    """Dismiss all completed signals (executed, rejected, failed, skipped).

    This is the "Clear all completed" action from the UI.
    """
    count = await crud.dismiss_signals_bulk(user_id=user.id, completed_only=True)
    return {"status": "dismissed", "count": count}


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
    Today's P&L is fetched from MetaAPI deal history for accuracy
    (includes manual trades, not just signal-based trades).
    """
    from ..users.manager import user_manager

    user_id = user.id if user else None
    stats = await crud.get_stats(user_id=user_id)

    # Try to get today's P&L from MetaAPI for accuracy (includes manual trades)
    if user:
        try:
            conn = user_manager.get_connection(user.id)
            if conn and conn.metaapi_executor and conn.metaapi_executor.connection:
                metaapi_today_pnl = await conn.metaapi_executor.get_today_pnl()
                stats["today_profit"] = round(metaapi_today_pnl, 2)
                log.debug(
                    "Today's P&L from MetaAPI",
                    user_id=user.id[:8],
                    pnl=metaapi_today_pnl,
                )
        except Exception as e:
            # Fall back to database calculation if MetaAPI fails
            log.warning(
                "Failed to get today's P&L from MetaAPI, using DB",
                user_id=user.id[:8] if user else "anon",
                error=str(e),
            )

    return StatsResponse(**stats)


# Account endpoint - now fetches per-user from MetaAPI
# Legacy global cache kept for backward compatibility with main.py update loop
_account_info = {"balance": 0, "equity": 0, "margin": 0, "freeMargin": 0}
_live_positions = []


def set_account_info(info: dict):
    """Update cached account info (legacy - used by main.py update loop)."""
    global _account_info
    _account_info = info


def set_live_positions(positions: list):
    """Update cached live positions from MetaApi (legacy)."""
    global _live_positions
    _live_positions = positions


async def _get_metaapi_region(account_id: str, metaapi_token: str) -> str:
    """Get the region for a MetaAPI account from the provisioning API."""
    import httpx

    api_url = f"https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/{account_id}"
    headers = {"auth-token": metaapi_token}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(api_url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get("region", "london")  # Default to london
    except Exception as e:
        print(f"[API] Error getting MetaAPI region: {e}")

    return "london"  # Default fallback


@router.get("/account")
async def get_account(
    user: AuthUser = Depends(get_current_user),
):
    """Get current user's account information from MetaAPI."""
    import httpx
    from ..users.credentials import get_user_credentials

    # Get user's MetaAPI account ID
    credentials = get_user_credentials(user.id)
    if not credentials or not credentials.metaapi_account_id:
        # Return zeros if no MetaAPI account configured
        return {"balance": 0, "equity": 0, "margin": 0, "freeMargin": 0}

    if not credentials.mt_connected:
        # Account not connected yet
        return {"balance": 0, "equity": 0, "margin": 0, "freeMargin": 0}

    # Get MetaAPI token from system_config
    system_config = supabase_db.get_system_config()
    metaapi_token = system_config.get("metaapi_token")
    if not metaapi_token:
        print("[API] MetaAPI token not configured in system_config")
        return {"balance": 0, "equity": 0, "margin": 0, "freeMargin": 0}

    account_id = credentials.metaapi_account_id

    # Get the account's region for the correct API endpoint
    region = await _get_metaapi_region(account_id, metaapi_token)

    # Fetch account info from MetaAPI using regional endpoint
    api_url = f"https://mt-client-api-v1.{region}.agiliumtrade.ai/users/current/accounts/{account_id}/account-information"

    headers = {
        "auth-token": metaapi_token,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(api_url, headers=headers, timeout=10)

            if response.status_code == 200:
                data = response.json()
                return {
                    "balance": data.get("balance", 0),
                    "equity": data.get("equity", 0),
                    "margin": data.get("margin", 0),
                    "freeMargin": data.get("freeMargin", 0),
                }
            else:
                print(f"[API] MetaAPI account info error: {response.status_code} - {response.text}")
                return {"balance": 0, "equity": 0, "margin": 0, "freeMargin": 0}

    except Exception as e:
        print(f"[API] Error fetching account info: {e}")
        return {"balance": 0, "equity": 0, "margin": 0, "freeMargin": 0}


@router.get("/positions")
async def get_live_positions(
    user: AuthUser = Depends(get_current_user),
):
    """Get current user's live open positions from MetaTrader."""
    import httpx
    from ..users.credentials import get_user_credentials

    # Get user's MetaAPI account ID
    credentials = get_user_credentials(user.id)
    if not credentials or not credentials.metaapi_account_id:
        return []

    if not credentials.mt_connected:
        return []

    # Get MetaAPI token from system_config
    system_config = supabase_db.get_system_config()
    metaapi_token = system_config.get("metaapi_token")
    if not metaapi_token:
        return []

    account_id = credentials.metaapi_account_id

    # Get the account's region for the correct API endpoint
    region = await _get_metaapi_region(account_id, metaapi_token)

    # Fetch positions from MetaAPI using regional endpoint
    api_url = f"https://mt-client-api-v1.{region}.agiliumtrade.ai/users/current/accounts/{account_id}/positions"

    headers = {
        "auth-token": metaapi_token,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(api_url, headers=headers, timeout=10)

            if response.status_code == 200:
                return response.json()
            else:
                print(f"[API] MetaAPI positions error: {response.status_code}")
                return []

    except Exception as e:
        print(f"[API] Error fetching positions: {e}")
        return []


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
        print(f"[API] PUT /settings for user {user_id[:8]}...")
        print(f"[API] Updates received: {updates}")

        # Check if telegram channels are being updated
        channels_changed = "telegram_channel_ids" in updates
        if channels_changed:
            print(f"[API] telegram_channel_ids being saved: {updates['telegram_channel_ids']}")

        updated = supabase_db.update_settings(user_id, updates)
        print(f"[API] Updated settings returned: telegram_channel_ids = {updated.get('telegram_channel_ids')}")

        # Auto-restart Telegram listener if channels changed
        if channels_changed:
            copier = get_copier()
            if copier:
                try:
                    import asyncio
                    asyncio.create_task(copier.restart_telegram())
                    print(f"[API] Telegram listener restart triggered after channel update")
                except Exception as restart_err:
                    print(f"[API] Warning: Could not restart Telegram listener: {restart_err}")

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
    user: AuthUser = Depends(get_current_user),
):
    """Correct a skipped/failed signal's direction and execute it."""
    signal = await crud.get_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    # Verify ownership - user can only correct their own signals
    if signal.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="You can only correct your own signals")

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
    user: AuthUser = Depends(get_current_user),
):
    """Confirm and execute a pending signal with optional lot size override."""
    import os
    from ..users.manager import user_manager

    signal = await crud.get_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    # Verify ownership - user can only confirm their own signals
    if signal.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="You can only confirm your own signals")

    if signal.get("status") != "pending_confirmation":
        raise HTTPException(
            status_code=400,
            detail=f"Signal not pending confirmation, current status: {signal.get('status')}"
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

    # Check if multi-tenant mode
    multi_tenant = os.getenv("MULTI_TENANT_MODE", "false").lower() == "true"

    if multi_tenant:
        # Use user's executor from user_manager
        conn = user_manager.get_connection(user.id)
        if not conn:
            raise HTTPException(
                status_code=503,
                detail="Not connected. Go to Settings and click Refresh to reconnect."
            )

        executor = conn.metaapi_executor
        if not executor or not executor.connection:
            raise HTTPException(
                status_code=503,
                detail="MetaTrader not connected. Go to Settings and click Refresh to reconnect."
            )

        # Execute using signal_router's confirm logic
        from ..signal_router import signal_router
        success = await signal_router.confirm_signal(
            user_id=user.id,
            signal_id=signal_id,
            lot_size_override=confirm_request.lot_size
        )
    else:
        # Legacy single-user mode
        if not _copier:
            raise HTTPException(
                status_code=503,
                detail="Signal copier not initialized"
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
    user: AuthUser = Depends(get_current_user),
):
    """Reject a pending signal."""
    signal = await crud.get_signal(signal_id)
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")

    # Verify ownership - user can only reject their own signals
    if signal.get("user_id") != user.id:
        raise HTTPException(status_code=403, detail="You can only reject your own signals")

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


# Multi-tenant debug endpoint
@router.get("/system/multi-tenant-status")
async def get_multi_tenant_status(
    user: AuthUser = Depends(get_current_user),
):
    """Get multi-tenant system status for debugging.

    Shows connection status for all users (admin only) or current user.
    """
    import os
    from ..users.manager import user_manager

    multi_tenant = os.getenv("MULTI_TENANT_MODE", "false").lower() == "true"

    result = {
        "multi_tenant_mode": multi_tenant,
        "user_manager_running": user_manager._running,
        "active_users": user_manager.active_users,
        "connected_users": user_manager.connected_users,
    }

    # Get current user's connection status
    conn = user_manager.get_connection(user.id)
    if conn:
        result["your_connection"] = {
            "is_active": conn.is_active,
            "telegram_connected": conn.telegram_connected,
            "metaapi_connected": conn.metaapi_connected,
            "has_credentials": conn.credentials is not None,
            "has_settings": conn.settings is not None,
            "connected_at": conn.connected_at.isoformat() if conn.connected_at else None,
            "telegram_listener_exists": conn.telegram_listener is not None,
            "metaapi_executor_exists": conn.metaapi_executor is not None,
        }

        # Get telegram listener status if exists
        if conn.telegram_listener:
            try:
                tg_status = conn.telegram_listener.get_connection_status()
                result["your_telegram_listener"] = tg_status
            except Exception as e:
                result["your_telegram_listener_error"] = str(e)
    else:
        result["your_connection"] = None
        result["reason"] = "User connection not found in user_manager"

    return result


# Reconnection cooldown: minimum seconds between reconnects per user
_RECONNECT_COOLDOWN = 10
_last_reconnect_times: dict = {}  # user_id -> datetime


# Manual connection trigger for multi-tenant mode
@router.post("/system/connect-me")
async def connect_current_user(
    user: AuthUser = Depends(get_current_user),
    force: bool = False,  # If True, disconnect and reconnect even if healthy
):
    """Manually connect/reconnect the current user in multi-tenant mode.

    Use this if:
    - User completed onboarding after server started
    - Connection failed and needs to be retried
    - User wants to reconnect after settings change

    Stability features:
    - If already connected and healthy, returns immediately (use force=true to override)
    - 10-second cooldown between reconnects to prevent tab conflicts
    """
    import os
    import asyncio
    from ..users.manager import user_manager

    multi_tenant = os.getenv("MULTI_TENANT_MODE", "false").lower() == "true"

    if not multi_tenant:
        return {"error": "Not in multi-tenant mode"}

    # IMPORTANT: Ensure message handler is set (might not be if server restarted)
    from ..signal_router import signal_router
    if not user_manager._message_handler:
        user_manager.set_message_handler(signal_router.route_message)
        log.info("Message handler was not set - setting it now")

    # Check if already connected and healthy (skip reconnect unless forced)
    existing = user_manager.get_connection(user.id)
    if existing and not force:
        # Check Telegram health
        telegram_healthy = False
        if existing.telegram_listener:
            try:
                telegram_healthy = existing.telegram_listener.is_connected()
            except Exception:
                pass

        # Check MetaAPI health
        metaapi_healthy = existing.metaapi_connected and existing.metaapi_executor is not None

        # If either is healthy, return current status without disrupting
        if telegram_healthy or metaapi_healthy:
            log.info(f"User {user.id[:8]} already connected, skipping reconnect (use force=true to override)")
            return {
                "status": "already_connected",
                "message": "Already connected. Connection stable.",
                "telegram_connected": telegram_healthy,
                "metaapi_connected": metaapi_healthy,
            }

    # Check cooldown (prevent rapid reconnects from multiple tabs)
    if not force:
        last_time = _last_reconnect_times.get(user.id)
        if last_time:
            seconds_since = (datetime.utcnow() - last_time).total_seconds()
            if seconds_since < _RECONNECT_COOLDOWN:
                remaining = int(_RECONNECT_COOLDOWN - seconds_since)
                log.info(f"User {user.id[:8]} reconnect rate-limited, {remaining}s remaining")
                return {
                    "status": "rate_limited",
                    "message": f"Please wait {remaining} seconds before reconnecting again.",
                    "retry_after": remaining,
                }

    # Record this reconnect attempt
    _last_reconnect_times[user.id] = datetime.utcnow()

    # Disconnect first if already connected
    if existing:
        log.info(f"User {user.id[:8]} disconnecting for fresh reconnect (force={force})")
        await user_manager.disconnect_user(user.id)

    # Small delay to ensure clean disconnect before reconnect
    await asyncio.sleep(1)

    # Connect user with their OWN Telegram listener and MetaAPI
    # Each user uses their own Telegram credentials for their private channels
    success = await user_manager.connect_user(user.id, skip_telegram=False)

    if not success:
        return {
            "status": "failed",
            "error": "Could not connect - check credentials and settings",
        }

    # Wait for connections to establish (up to 10 seconds)
    conn = user_manager.get_connection(user.id)
    if conn:
        for _ in range(20):  # 20 * 0.5s = 10 seconds max
            await asyncio.sleep(0.5)

            # Check if connections are established
            telegram_ok = conn.telegram_connected or not conn.credentials.has_telegram_credentials
            metaapi_ok = conn.metaapi_connected or not conn.credentials.has_metatrader_credentials

            if telegram_ok and metaapi_ok:
                break

            # Also check the listener directly for more accurate status
            if conn.telegram_listener and conn.telegram_listener.is_connected():
                conn.telegram_connected = True
            if conn.metaapi_executor and conn.metaapi_executor.connection:
                conn.metaapi_connected = True

    # Return final status
    conn = user_manager.get_connection(user.id)
    telegram_connected = conn.telegram_connected if conn else False
    metaapi_connected = conn.metaapi_connected if conn else False

    # Determine overall status
    if telegram_connected or metaapi_connected:
        return {
            "status": "connected",
            "telegram_connected": telegram_connected,
            "metaapi_connected": metaapi_connected,
        }
    else:
        return {
            "status": "failed",
            "error": "Connections failed to establish - check logs for details",
            "telegram_connected": False,
            "metaapi_connected": False,
        }


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


# Listener diagnostic endpoint
@router.get("/user/listener-diagnostics")
async def get_listener_diagnostics(
    user: AuthUser = Depends(get_current_user),
):
    """Get detailed diagnostic information about the user's Telegram listener.

    Use this endpoint to debug signal reception issues. It shows:
    - Connection status details
    - Channel resolution status
    - Event handler registration
    - Activity timestamps
    """
    import os
    from ..users.manager import user_manager

    multi_tenant = os.getenv("MULTI_TENANT_MODE", "false").lower() == "true"

    if not multi_tenant:
        return {"error": "Not in multi-tenant mode"}

    conn = user_manager.get_connection(user.id)
    if not conn:
        return {
            "error": "User not connected",
            "hint": "Call /system/connect-me to establish connection",
        }

    if not conn.telegram_listener:
        return {
            "error": "No Telegram listener for user",
            "telegram_connected_flag": conn.telegram_connected,
            "hint": "User may be using shared listener or listener failed to start",
        }

    try:
        diagnostics = await conn.telegram_listener.get_diagnostic_info()

        # Add connection-level info
        diagnostics["connection_manager"] = {
            "is_active": conn.is_active,
            "telegram_connected_flag": conn.telegram_connected,
            "metaapi_connected_flag": conn.metaapi_connected,
            "connected_at": conn.connected_at.isoformat() if conn.connected_at else None,
            "last_activity": conn.last_activity.isoformat() if conn.last_activity else None,
        }

        # Add message handler info
        diagnostics["message_handler"] = {
            "handler_set": user_manager._message_handler is not None,
            "handler_name": user_manager._message_handler.__name__ if user_manager._message_handler else None,
        }

        return diagnostics

    except Exception as e:
        return {
            "error": f"Failed to get diagnostics: {str(e)}",
            "telegram_connected_flag": conn.telegram_connected,
        }


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
async def get_lot_presets(
    symbol: Optional[str] = None,
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Get calculated lot size presets based on current account balance.

    Args:
        symbol: Optional symbol to calculate lots for (GOLD/XAUUSD use 0.04 base, others use 0.01)
    """
    from ..trading.validator import calculate_lot_for_symbol, get_reference_lot_for_symbol
    from ..config import settings

    # In multi-tenant mode, fetch user's actual balance from MetaAPI
    balance = 0
    if user:
        import httpx
        from ..users.credentials import get_user_credentials

        credentials = get_user_credentials(user.id)
        if credentials and credentials.metaapi_account_id and credentials.mt_connected:
            system_config = supabase_db.get_system_config()
            metaapi_token = system_config.get("metaapi_token")
            if metaapi_token:
                account_id = credentials.metaapi_account_id
                region = await _get_metaapi_region(account_id, metaapi_token)
                api_url = f"https://mt-client-api-v1.{region}.agiliumtrade.ai/users/current/accounts/{account_id}/account-information"

                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(api_url, headers={"auth-token": metaapi_token}, timeout=10)
                        if response.status_code == 200:
                            balance = response.json().get("balance", 0)
                except Exception as e:
                    print(f"[API] Error fetching balance for lot presets: {e}")

    # Fallback to global cache for legacy single-user mode
    if balance == 0:
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
    message: Optional[str] = None  # Additional context for the user


@router.get("/telegram/connection-status", response_model=TelegramConnectionStatus)
async def get_telegram_connection_status(
    user: Optional[AuthUser] = Depends(get_optional_user),
):
    """Get Telegram listener connection status for dashboard display.

    In multi-tenant mode, checks per-user connection status.
    In single-user mode, checks global copier.
    """
    import os
    from ..users.manager import user_manager

    multi_tenant = os.getenv("MULTI_TENANT_MODE", "false").lower() == "true"

    if multi_tenant and user:
        # Check user's specific connection status
        conn = user_manager.get_connection(user.id)
        if conn and conn.telegram_listener:
            try:
                listener = conn.telegram_listener
                status = listener.get_connection_status()
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
                pass

        # User not connected yet or no listener
        if not conn:
            return TelegramConnectionStatus(
                connected=False,
                message="No connection found. Click Reconnect to start the Telegram listener."
            )
        elif not conn.telegram_listener:
            return TelegramConnectionStatus(
                connected=False,
                message="Telegram listener not started. Click Reconnect to start receiving signals."
            )
        else:
            return TelegramConnectionStatus(
                connected=False,
                message="Listener exists but not connected. Click Reconnect to retry."
            )

    # Single-user mode or no auth - check global copier
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

