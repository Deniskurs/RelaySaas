"""Admin API routes for user management and system configuration."""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError

from ..auth.middleware import require_admin
from ..auth.models import AuthUser
from ..database.supabase import (
    get_supabase_admin,
    get_system_config,
    update_system_config,
    update_settings,
    SYSTEM_CONFIG_KEYS,
    SYSTEM_USER_ID,
)
from ..users.manager import user_manager
from ..utils.logger import log
from .routes import get_copier


# Global state for Telegram verification flow
_telegram_verification_client: Optional[TelegramClient] = None
_telegram_verification_phone_hash: Optional[str] = None


router = APIRouter(prefix="/admin", tags=["admin"])


# Response models
class UserProfile(BaseModel):
    """User profile for admin view."""

    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    status: str
    onboarding_step: str
    subscription_tier: str
    subscription_status: Optional[str] = None
    created_at: Optional[str] = None
    last_seen_at: Optional[str] = None


class UserListResponse(BaseModel):
    """Paginated user list response."""

    users: List[UserProfile]
    total: int
    page: int
    page_size: int


class UserDetailResponse(BaseModel):
    """Detailed user info for admin."""

    profile: UserProfile
    telegram_configured: bool
    metatrader_configured: bool
    is_connected: bool
    signals_count: int = 0
    trades_count: int = 0


class SystemOverviewResponse(BaseModel):
    """System-wide statistics."""

    total_users: int
    active_users: int
    pending_users: int
    suspended_users: int
    connected_users: int
    total_signals_today: int
    total_trades_today: int


class ActivityLogEntry(BaseModel):
    """Activity log entry."""

    id: int
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    details: dict
    created_at: str


class StatusResponse(BaseModel):
    """Simple status response."""

    status: str
    message: str = ""


@router.get("/users", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    admin: AuthUser = Depends(require_admin),
):
    """List all users with pagination."""
    try:
        supabase = get_supabase_admin()
        offset = (page - 1) * page_size

        # Build query
        query = supabase.table("profiles").select("*", count="exact")

        if status:
            query = query.eq("status", status)

        if search:
            # Search by email or name
            query = query.or_(f"email.ilike.%{search}%,full_name.ilike.%{search}%")

        # Get total count first
        count_result = supabase.table("profiles").select("id", count="exact")
        if status:
            count_result = count_result.eq("status", status)
        if search:
            count_result = count_result.or_(f"email.ilike.%{search}%,full_name.ilike.%{search}%")
        count_result = count_result.execute()
        total = count_result.count or 0

        # Get paginated results
        result = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()

        users = [
            UserProfile(
                id=u["id"],
                email=u.get("email", ""),
                full_name=u.get("full_name"),
                avatar_url=u.get("avatar_url"),
                role=u.get("role", "user"),
                status=u.get("status", "pending"),
                onboarding_step=u.get("onboarding_step", "telegram"),
                subscription_tier=u.get("subscription_tier", "free"),
                subscription_status=u.get("subscription_status"),
                created_at=u.get("created_at"),
                last_seen_at=u.get("last_seen_at"),
            )
            for u in (result.data or [])
        ]

        return UserListResponse(
            users=users,
            total=total,
            page=page,
            page_size=page_size,
        )

    except Exception as e:
        log.error("Error listing users", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user_detail(
    user_id: str,
    admin: AuthUser = Depends(require_admin),
):
    """Get detailed user information."""
    try:
        supabase = get_supabase_admin()

        # Get profile
        profile_result = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User not found")

        profile_data = profile_result.data[0]

        # Get credentials status
        creds_result = supabase.table("user_credentials").select("*").eq("user_id", user_id).execute()
        creds = creds_result.data[0] if creds_result.data else {}

        # Get connection status from manager
        conn_status = await user_manager.check_user_status(user_id)

        # Get counts
        signals_result = supabase.table("signals_v2").select("id", count="exact").eq("user_id", user_id).execute()
        trades_result = supabase.table("trades_v2").select("id", count="exact").eq("user_id", user_id).execute()

        profile = UserProfile(
            id=profile_data["id"],
            email=profile_data.get("email", ""),
            full_name=profile_data.get("full_name"),
            avatar_url=profile_data.get("avatar_url"),
            role=profile_data.get("role", "user"),
            status=profile_data.get("status", "pending"),
            onboarding_step=profile_data.get("onboarding_step", "telegram"),
            subscription_tier=profile_data.get("subscription_tier", "free"),
            subscription_status=profile_data.get("subscription_status"),
            created_at=profile_data.get("created_at"),
            last_seen_at=profile_data.get("last_seen_at"),
        )

        return UserDetailResponse(
            profile=profile,
            telegram_configured=bool(creds.get("telegram_api_id")),
            metatrader_configured=bool(creds.get("metaapi_account_id")),
            is_connected=conn_status.get("connected", False),
            signals_count=signals_result.count or 0,
            trades_count=trades_result.count or 0,
        )

    except HTTPException:
        raise
    except Exception as e:
        log.error("Error getting user detail", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/suspend", response_model=StatusResponse)
async def suspend_user(
    user_id: str,
    admin: AuthUser = Depends(require_admin),
):
    """Suspend a user account."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot suspend yourself")

    try:
        supabase = get_supabase_admin()

        # Update profile status
        result = supabase.table("profiles").update({
            "status": "suspended",
        }).eq("id", user_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")

        # Disconnect user if connected
        await user_manager.disconnect_user(user_id)

        # Log activity
        await _log_activity(admin.id, "user.suspended", {"target_user_id": user_id})

        log.info("User suspended", user_id=user_id, admin_id=admin.id)

        return StatusResponse(status="suspended", message="User account suspended")

    except HTTPException:
        raise
    except Exception as e:
        log.error("Error suspending user", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/{user_id}/activate", response_model=StatusResponse)
async def activate_user(
    user_id: str,
    admin: AuthUser = Depends(require_admin),
):
    """Activate a suspended user account."""
    try:
        supabase = get_supabase_admin()

        # Update profile status
        result = supabase.table("profiles").update({
            "status": "active",
        }).eq("id", user_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")

        # Log activity
        await _log_activity(admin.id, "user.activated", {"target_user_id": user_id})

        log.info("User activated", user_id=user_id, admin_id=admin.id)

        return StatusResponse(status="active", message="User account activated")

    except HTTPException:
        raise
    except Exception as e:
        log.error("Error activating user", user_id=user_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/overview", response_model=SystemOverviewResponse)
async def get_system_overview(
    admin: AuthUser = Depends(require_admin),
):
    """Get system-wide statistics."""
    try:
        supabase = get_supabase_admin()
        today = datetime.utcnow().date().isoformat()

        # Get user counts by status
        total_result = supabase.table("profiles").select("id", count="exact").execute()
        active_result = supabase.table("profiles").select("id", count="exact").eq("status", "active").execute()
        pending_result = supabase.table("profiles").select("id", count="exact").in_("status", ["pending", "onboarding"]).execute()
        suspended_result = supabase.table("profiles").select("id", count="exact").eq("status", "suspended").execute()

        # Get signals and trades today
        signals_today = supabase.table("signals_v2").select("id", count="exact").gte("received_at", today).execute()
        trades_today = supabase.table("trades_v2").select("id", count="exact").gte("created_at", today).execute()

        return SystemOverviewResponse(
            total_users=total_result.count or 0,
            active_users=active_result.count or 0,
            pending_users=pending_result.count or 0,
            suspended_users=suspended_result.count or 0,
            connected_users=user_manager.connected_users,
            total_signals_today=signals_today.count or 0,
            total_trades_today=trades_today.count or 0,
        )

    except Exception as e:
        log.error("Error getting system overview", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/activity", response_model=List[ActivityLogEntry])
async def get_activity_logs(
    limit: int = Query(50, le=200),
    offset: int = 0,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    admin: AuthUser = Depends(require_admin),
):
    """Get activity logs."""
    try:
        supabase = get_supabase_admin()

        query = supabase.table("activity_logs").select("*")

        if user_id:
            query = query.eq("user_id", user_id)

        if action:
            query = query.eq("action", action)

        result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        # Get user emails for display
        user_ids = list(set(log.get("user_id") for log in (result.data or []) if log.get("user_id")))
        emails = {}
        if user_ids:
            email_result = supabase.table("profiles").select("id, email").in_("id", user_ids).execute()
            emails = {u["id"]: u["email"] for u in (email_result.data or [])}

        return [
            ActivityLogEntry(
                id=log["id"],
                user_id=log.get("user_id"),
                user_email=emails.get(log.get("user_id")),
                action=log["action"],
                details=log.get("details") or {},
                created_at=log["created_at"],
            )
            for log in (result.data or [])
        ]

    except Exception as e:
        log.error("Error getting activity logs", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def _log_activity(user_id: str, action: str, details: dict = None):
    """Log an activity."""
    try:
        supabase = get_supabase_admin()
        supabase.table("activity_logs").insert({
            "user_id": user_id,
            "action": action,
            "details": details or {},
        }).execute()
    except Exception as e:
        log.error("Error logging activity", error=str(e))


# =============================================================================
# System Configuration Endpoints
# =============================================================================

class SystemConfigResponse(BaseModel):
    """System configuration response."""

    # LLM
    anthropic_api_key: str = ""
    llm_model: str = "claude-haiku-4-5-20251001"
    # MetaApi
    metaapi_token: str = ""
    metaapi_account_id: str = ""
    # Telegram
    telegram_api_id: str = ""
    telegram_api_hash: str = ""
    telegram_phone: str = ""
    telegram_channel_ids: str = ""
    # Trading defaults
    default_lot_size: str = "0.01"
    max_lot_size: str = "0.1"
    max_open_trades: str = "5"
    max_risk_percent: str = "2.0"
    symbol_suffix: str = ""
    split_tps: str = "true"
    tp_split_ratios: str = "0.5,0.3,0.2"
    enable_breakeven: str = "true"


class SystemConfigUpdate(BaseModel):
    """System configuration update request."""

    # LLM
    anthropic_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    # MetaApi
    metaapi_token: Optional[str] = None
    metaapi_account_id: Optional[str] = None
    # Telegram
    telegram_api_id: Optional[str] = None
    telegram_api_hash: Optional[str] = None
    telegram_phone: Optional[str] = None
    telegram_channel_ids: Optional[str] = None
    # Trading defaults
    default_lot_size: Optional[str] = None
    max_lot_size: Optional[str] = None
    max_open_trades: Optional[str] = None
    max_risk_percent: Optional[str] = None
    symbol_suffix: Optional[str] = None
    split_tps: Optional[str] = None
    tp_split_ratios: Optional[str] = None
    enable_breakeven: Optional[str] = None


class MaskedSystemConfigResponse(BaseModel):
    """System configuration with sensitive values masked."""

    # LLM
    anthropic_api_key_set: bool = False
    anthropic_api_key_preview: str = ""
    llm_model: str = "claude-haiku-4-5-20251001"
    # MetaApi
    metaapi_token_set: bool = False
    metaapi_token_preview: str = ""
    metaapi_account_id: str = ""
    # Telegram - return actual values for admin to see/edit
    telegram_api_id: str = ""
    telegram_api_hash: str = ""  # Actual value for admin editing
    telegram_api_hash_set: bool = False
    telegram_api_hash_preview: str = ""
    telegram_phone: str = ""
    telegram_channel_ids: str = ""
    # Trading defaults
    default_lot_size: str = "0.01"
    max_lot_size: str = "0.1"
    max_open_trades: str = "5"
    max_risk_percent: str = "2.0"
    symbol_suffix: str = ""
    split_tps: str = "true"
    tp_split_ratios: str = "0.5,0.3,0.2"
    enable_breakeven: str = "true"


def _mask_api_key(key: str) -> tuple[bool, str]:
    """Mask an API key, returning (is_set, preview)."""
    if not key:
        return False, ""
    if len(key) <= 8:
        return True, "****"
    return True, f"{key[:4]}...{key[-4:]}"


@router.get("/config", response_model=MaskedSystemConfigResponse)
async def get_system_config_endpoint(
    admin: AuthUser = Depends(require_admin),
):
    """Get system configuration (with sensitive values masked)."""
    try:
        config = get_system_config()

        # Mask sensitive values
        anthropic_set, anthropic_preview = _mask_api_key(config.get("anthropic_api_key", ""))
        metaapi_set, metaapi_preview = _mask_api_key(config.get("metaapi_token", ""))
        telegram_hash_set, telegram_hash_preview = _mask_api_key(config.get("telegram_api_hash", ""))

        return MaskedSystemConfigResponse(
            # LLM
            anthropic_api_key_set=anthropic_set,
            anthropic_api_key_preview=anthropic_preview,
            llm_model=config.get("llm_model", "claude-haiku-4-5-20251001"),
            # MetaApi
            metaapi_token_set=metaapi_set,
            metaapi_token_preview=metaapi_preview,
            metaapi_account_id=config.get("metaapi_account_id", ""),
            # Telegram - return actual hash for admin editing
            telegram_api_id=config.get("telegram_api_id", ""),
            telegram_api_hash=config.get("telegram_api_hash", ""),
            telegram_api_hash_set=telegram_hash_set,
            telegram_api_hash_preview=telegram_hash_preview,
            telegram_phone=config.get("telegram_phone", ""),
            telegram_channel_ids=config.get("telegram_channel_ids", ""),
            # Trading defaults
            default_lot_size=config.get("default_lot_size", "0.01"),
            max_lot_size=config.get("max_lot_size", "0.1"),
            max_open_trades=config.get("max_open_trades", "5"),
            max_risk_percent=config.get("max_risk_percent", "2.0"),
            symbol_suffix=config.get("symbol_suffix", ""),
            split_tps=config.get("split_tps", "true"),
            tp_split_ratios=config.get("tp_split_ratios", "0.5,0.3,0.2"),
            enable_breakeven=config.get("enable_breakeven", "true"),
        )

    except Exception as e:
        log.error("Error getting system config", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config", response_model=MaskedSystemConfigResponse)
async def update_system_config_endpoint(
    config_update: SystemConfigUpdate,
    admin: AuthUser = Depends(require_admin),
):
    """Update system configuration."""
    try:
        # Build updates dict, excluding None values
        updates = {k: v for k, v in config_update.model_dump().items() if v is not None}

        if not updates:
            # No updates, just return current config
            return await get_system_config_endpoint(admin)

        # Update config
        updated_config = update_system_config(updates)

        # SYNC trading settings to user_settings_v2 (executor reads from there!)
        trading_settings_sync = {}
        if "split_tps" in updates:
            trading_settings_sync["split_tps"] = updates["split_tps"] == "true"
        if "tp_split_ratios" in updates:
            # Convert comma-separated string to list of floats
            ratios_str = updates["tp_split_ratios"]
            trading_settings_sync["tp_split_ratios"] = [
                float(r.strip()) for r in ratios_str.split(",") if r.strip()
            ]
        if "max_lot_size" in updates:
            trading_settings_sync["max_lot_size"] = float(updates["max_lot_size"])
        if "max_open_trades" in updates:
            trading_settings_sync["max_open_trades"] = int(updates["max_open_trades"])
        if "max_risk_percent" in updates:
            trading_settings_sync["max_risk_percent"] = float(updates["max_risk_percent"])
        if "symbol_suffix" in updates:
            trading_settings_sync["symbol_suffix"] = updates["symbol_suffix"]
        if "enable_breakeven" in updates:
            trading_settings_sync["enable_breakeven"] = updates["enable_breakeven"] == "true"
        if "tp_lot_mode" in updates:
            trading_settings_sync["tp_lot_mode"] = updates["tp_lot_mode"]

        if trading_settings_sync:
            update_settings(SYSTEM_USER_ID, trading_settings_sync)
            log.info("Synced trading settings to user_settings_v2", keys=list(trading_settings_sync.keys()))

        # Log activity
        # Don't include actual values in log for security
        await _log_activity(
            admin.id,
            "system.config.updated",
            {"keys_updated": list(updates.keys())}
        )

        log.info("System config updated", admin_id=admin.id, keys=list(updates.keys()))

        # Return masked response
        anthropic_set, anthropic_preview = _mask_api_key(updated_config.get("anthropic_api_key", ""))
        metaapi_set, metaapi_preview = _mask_api_key(updated_config.get("metaapi_token", ""))
        telegram_hash_set, telegram_hash_preview = _mask_api_key(updated_config.get("telegram_api_hash", ""))

        return MaskedSystemConfigResponse(
            # LLM
            anthropic_api_key_set=anthropic_set,
            anthropic_api_key_preview=anthropic_preview,
            llm_model=updated_config.get("llm_model", "claude-haiku-4-5-20251001"),
            # MetaApi
            metaapi_token_set=metaapi_set,
            metaapi_token_preview=metaapi_preview,
            metaapi_account_id=updated_config.get("metaapi_account_id", ""),
            # Telegram - return actual hash for admin editing
            telegram_api_id=updated_config.get("telegram_api_id", ""),
            telegram_api_hash=updated_config.get("telegram_api_hash", ""),
            telegram_api_hash_set=telegram_hash_set,
            telegram_api_hash_preview=telegram_hash_preview,
            telegram_phone=updated_config.get("telegram_phone", ""),
            telegram_channel_ids=updated_config.get("telegram_channel_ids", ""),
            # Trading defaults
            default_lot_size=updated_config.get("default_lot_size", "0.01"),
            max_lot_size=updated_config.get("max_lot_size", "0.1"),
            max_open_trades=updated_config.get("max_open_trades", "5"),
            max_risk_percent=updated_config.get("max_risk_percent", "2.0"),
            symbol_suffix=updated_config.get("symbol_suffix", ""),
            split_tps=updated_config.get("split_tps", "true"),
            tp_split_ratios=updated_config.get("tp_split_ratios", "0.5,0.3,0.2"),
            enable_breakeven=updated_config.get("enable_breakeven", "true"),
        )

    except Exception as e:
        log.error("Error updating system config", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Telegram Verification Endpoints
# =============================================================================

class TelegramVerificationRequest(BaseModel):
    """Request to start Telegram verification."""
    api_id: str
    api_hash: str
    phone: str


class TelegramCodeRequest(BaseModel):
    """Request to verify Telegram code."""
    code: str


class TelegramPasswordRequest(BaseModel):
    """Request to provide 2FA password."""
    password: str


class TelegramStatusResponse(BaseModel):
    """Telegram verification status response."""
    status: str  # 'not_configured', 'pending_code', 'pending_password', 'connected'
    message: str = ""
    session_saved: bool = False


@router.post("/telegram/send-code", response_model=TelegramStatusResponse)
async def telegram_send_code(
    request: TelegramVerificationRequest,
    admin: AuthUser = Depends(require_admin),
):
    """Start Telegram verification by sending a code to the phone."""
    global _telegram_verification_client, _telegram_verification_phone_hash

    try:
        # Clean up any existing client
        if _telegram_verification_client:
            try:
                await _telegram_verification_client.disconnect()
            except:
                pass
            _telegram_verification_client = None
            _telegram_verification_phone_hash = None

        # Create new client with StringSession (no file storage)
        _telegram_verification_client = TelegramClient(
            StringSession(),
            int(request.api_id),
            request.api_hash,
        )

        # Connect to Telegram
        await _telegram_verification_client.connect()

        # Send code request
        result = await _telegram_verification_client.send_code_request(request.phone)
        _telegram_verification_phone_hash = result.phone_code_hash

        # Save credentials to config (but not session yet)
        update_system_config({
            "telegram_api_id": request.api_id,
            "telegram_api_hash": request.api_hash,
            "telegram_phone": request.phone,
        })

        log.info("Telegram verification code sent", phone=request.phone, admin_id=admin.id)

        return TelegramStatusResponse(
            status="pending_code",
            message=f"Verification code sent to {request.phone}. Check your Telegram app or SMS.",
        )

    except Exception as e:
        log.error("Error sending Telegram code", error=str(e))
        # Clean up on error
        if _telegram_verification_client:
            try:
                await _telegram_verification_client.disconnect()
            except:
                pass
            _telegram_verification_client = None
            _telegram_verification_phone_hash = None
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/telegram/verify-code", response_model=TelegramStatusResponse)
async def telegram_verify_code(
    request: TelegramCodeRequest,
    admin: AuthUser = Depends(require_admin),
):
    """Verify the Telegram code and complete authentication."""
    global _telegram_verification_client, _telegram_verification_phone_hash

    if not _telegram_verification_client or not _telegram_verification_phone_hash:
        raise HTTPException(
            status_code=400,
            detail="No pending verification. Please start the verification process first.",
        )

    try:
        config = get_system_config()
        phone = config.get("telegram_phone", "")

        # Try to sign in with the code
        await _telegram_verification_client.sign_in(
            phone=phone,
            code=request.code,
            phone_code_hash=_telegram_verification_phone_hash,
        )

        # Success! Save the session string
        session_string = _telegram_verification_client.session.save()
        update_system_config({
            "telegram_session": session_string,
        })

        # Clean up
        await _telegram_verification_client.disconnect()
        _telegram_verification_client = None
        _telegram_verification_phone_hash = None

        log.info("Telegram verification successful", admin_id=admin.id)

        # Auto-restart the Telegram listener to pick up the new session
        copier = get_copier()
        if copier:
            try:
                await copier.restart_telegram()
                log.info("Telegram listener restarted after verification")
            except Exception as e:
                log.warning("Could not auto-restart Telegram listener", error=str(e))

        return TelegramStatusResponse(
            status="connected",
            message="Telegram connected successfully! The listener has been restarted.",
            session_saved=True,
        )

    except SessionPasswordNeededError:
        # 2FA is enabled, need password
        log.info("Telegram 2FA required", admin_id=admin.id)
        return TelegramStatusResponse(
            status="pending_password",
            message="Two-factor authentication is enabled. Please enter your Telegram password.",
        )

    except Exception as e:
        log.error("Error verifying Telegram code", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/telegram/verify-password", response_model=TelegramStatusResponse)
async def telegram_verify_password(
    request: TelegramPasswordRequest,
    admin: AuthUser = Depends(require_admin),
):
    """Verify 2FA password and complete authentication."""
    global _telegram_verification_client, _telegram_verification_phone_hash

    if not _telegram_verification_client:
        raise HTTPException(
            status_code=400,
            detail="No pending verification. Please start the verification process first.",
        )

    try:
        # Sign in with password
        await _telegram_verification_client.sign_in(password=request.password)

        # Success! Save the session string
        session_string = _telegram_verification_client.session.save()
        update_system_config({
            "telegram_session": session_string,
        })

        # Clean up
        await _telegram_verification_client.disconnect()
        _telegram_verification_client = None
        _telegram_verification_phone_hash = None

        log.info("Telegram 2FA verification successful", admin_id=admin.id)

        # Auto-restart the Telegram listener to pick up the new session
        copier = get_copier()
        if copier:
            try:
                await copier.restart_telegram()
                log.info("Telegram listener restarted after 2FA verification")
            except Exception as e:
                log.warning("Could not auto-restart Telegram listener", error=str(e))

        return TelegramStatusResponse(
            status="connected",
            message="Telegram connected successfully! The listener has been restarted.",
            session_saved=True,
        )

    except Exception as e:
        log.error("Error verifying Telegram password", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/telegram/reconnect", response_model=TelegramStatusResponse)
async def telegram_reconnect(
    admin: AuthUser = Depends(require_admin),
):
    """Manually reconnect the Telegram listener using saved session."""
    copier = get_copier()
    if not copier:
        raise HTTPException(
            status_code=500,
            detail="Signal copier not initialized",
        )

    try:
        await copier.restart_telegram()
        return TelegramStatusResponse(
            status="connected",
            message="Telegram listener reconnected successfully.",
            session_saved=True,
        )
    except Exception as e:
        log.error("Error reconnecting Telegram", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/telegram/status", response_model=TelegramStatusResponse)
async def telegram_get_status(
    admin: AuthUser = Depends(require_admin),
):
    """Get current Telegram connection status."""
    global _telegram_verification_client, _telegram_verification_phone_hash

    config = get_system_config()

    # Check if there's a saved session
    session_string = config.get("telegram_session", "")
    api_id = config.get("telegram_api_id", "")
    api_hash = config.get("telegram_api_hash", "")

    if session_string and api_id and api_hash:
        # Try to verify the session is still valid
        try:
            client = TelegramClient(
                StringSession(session_string),
                int(api_id),
                api_hash,
            )
            await client.connect()
            is_authorized = await client.is_user_authorized()
            await client.disconnect()

            if is_authorized:
                return TelegramStatusResponse(
                    status="connected",
                    message="Telegram is connected and authorized.",
                    session_saved=True,
                )
            else:
                return TelegramStatusResponse(
                    status="not_configured",
                    message="Saved session is no longer valid. Please re-authenticate.",
                )
        except Exception as e:
            log.warning("Error checking Telegram session", error=str(e))
            return TelegramStatusResponse(
                status="not_configured",
                message=f"Error checking session: {str(e)}",
            )

    # Check if verification is in progress
    if _telegram_verification_client and _telegram_verification_phone_hash:
        return TelegramStatusResponse(
            status="pending_code",
            message="Verification in progress. Enter the code sent to your phone.",
        )

    return TelegramStatusResponse(
        status="not_configured",
        message="Telegram is not configured. Enter your API credentials to get started.",
    )


@router.post("/telegram/disconnect", response_model=TelegramStatusResponse)
async def telegram_disconnect(
    admin: AuthUser = Depends(require_admin),
):
    """Disconnect Telegram and clear saved session."""
    global _telegram_verification_client, _telegram_verification_phone_hash

    # Clean up any in-progress verification
    if _telegram_verification_client:
        try:
            await _telegram_verification_client.disconnect()
        except:
            pass
        _telegram_verification_client = None
        _telegram_verification_phone_hash = None

    # Clear saved session from config
    update_system_config({
        "telegram_session": "",
    })

    log.info("Telegram disconnected", admin_id=admin.id)

    return TelegramStatusResponse(
        status="not_configured",
        message="Telegram disconnected. Session has been cleared.",
    )
