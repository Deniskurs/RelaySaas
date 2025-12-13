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
from ..users.credentials import update_user_credentials
from ..telegram.client import get_telegram_config, TelegramConfigError
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
    """System configuration response - ONLY global admin settings.

    User-specific settings (telegram, metatrader, trading) are in:
    - user_credentials: telegram config, metaapi_account_id
    - user_settings_v2: trading settings
    """

    # LLM - shared API key for signal parsing
    anthropic_api_key: str = ""
    llm_model: str = "claude-haiku-4-5-20251001"
    # MetaApi - shared platform token
    metaapi_token: str = ""


class SystemConfigUpdate(BaseModel):
    """System configuration update request - ONLY global admin settings."""

    # LLM
    anthropic_api_key: Optional[str] = None
    llm_model: Optional[str] = None
    # MetaApi
    metaapi_token: Optional[str] = None


class MaskedSystemConfigResponse(BaseModel):
    """System configuration with sensitive values masked."""

    # LLM
    anthropic_api_key_set: bool = False
    anthropic_api_key_preview: str = ""
    llm_model: str = "claude-haiku-4-5-20251001"
    # MetaApi
    metaapi_token_set: bool = False
    metaapi_token_preview: str = ""


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
    """Get system configuration (only global admin settings).

    User-specific settings (telegram, metatrader, trading) are managed through:
    - Onboarding flow
    - Settings page
    """
    try:
        config = get_system_config()

        # Mask sensitive values
        anthropic_set, anthropic_preview = _mask_api_key(config.get("anthropic_api_key", ""))
        metaapi_set, metaapi_preview = _mask_api_key(config.get("metaapi_token", ""))

        return MaskedSystemConfigResponse(
            # LLM
            anthropic_api_key_set=anthropic_set,
            anthropic_api_key_preview=anthropic_preview,
            llm_model=config.get("llm_model", "claude-haiku-4-5-20251001"),
            # MetaApi
            metaapi_token_set=metaapi_set,
            metaapi_token_preview=metaapi_preview,
        )

    except Exception as e:
        log.error("Error getting system config", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config", response_model=MaskedSystemConfigResponse)
async def update_system_config_endpoint(
    config_update: SystemConfigUpdate,
    admin: AuthUser = Depends(require_admin),
):
    """Update system configuration (only global admin settings).

    Only anthropic_api_key, llm_model, and metaapi_token can be set here.
    User-specific settings are managed through onboarding/settings page.
    """
    try:
        # Build updates dict, excluding None values
        updates = {k: v for k, v in config_update.model_dump().items() if v is not None}

        if not updates:
            # No updates, just return current config
            return await get_system_config_endpoint(admin)

        # Update config
        updated_config = update_system_config(updates)

        # Log activity
        await _log_activity(
            admin.id,
            "system.config.updated",
            {"keys_updated": list(updates.keys())}
        )

        log.info("System config updated", admin_id=admin.id, keys=list(updates.keys()))

        # Return masked response
        anthropic_set, anthropic_preview = _mask_api_key(updated_config.get("anthropic_api_key", ""))
        metaapi_set, metaapi_preview = _mask_api_key(updated_config.get("metaapi_token", ""))

        return MaskedSystemConfigResponse(
            # LLM
            anthropic_api_key_set=anthropic_set,
            anthropic_api_key_preview=anthropic_preview,
            llm_model=updated_config.get("llm_model", "claude-haiku-4-5-20251001"),
            # MetaApi
            metaapi_token_set=metaapi_set,
            metaapi_token_preview=metaapi_preview,
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

        # Success! Save the session string to BOTH locations
        session_string = _telegram_verification_client.session.save()
        update_system_config({
            "telegram_session": session_string,
        })
        # Also save to user_credentials (where get_telegram_config prefers to read from)
        update_user_credentials(admin.id, {
            "telegram_session_encrypted": session_string,
            "telegram_connected": True,
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

        # Success! Save the session string to BOTH locations
        session_string = _telegram_verification_client.session.save()
        update_system_config({
            "telegram_session": session_string,
        })
        # Also save to user_credentials (where get_telegram_config prefers to read from)
        update_user_credentials(admin.id, {
            "telegram_session_encrypted": session_string,
            "telegram_connected": True,
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

    # Use unified config getter that checks both system_config AND user_credentials
    try:
        config = get_telegram_config()
        session_string = config.get("session", "")
        api_id = config.get("api_id")
        api_hash = config.get("api_hash", "")

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
    except TelegramConfigError:
        # Telegram not configured at all - that's fine
        pass

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

    # Clear saved session from BOTH system_config and user_credentials
    update_system_config({
        "telegram_session": "",
    })

    # Also clear from user_credentials (where onboarding saves it)
    update_user_credentials(admin.id, {
        "telegram_session_encrypted": None,
        "telegram_connected": False,
    })

    log.info("Telegram disconnected", admin_id=admin.id)

    return TelegramStatusResponse(
        status="not_configured",
        message="Telegram disconnected. Session has been cleared.",
    )
