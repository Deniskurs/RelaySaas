"""Admin API routes for user management."""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..auth.middleware import require_admin
from ..auth.models import AuthUser
from ..database.supabase import get_supabase
from ..users.manager import user_manager
from ..utils.logger import log


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
        supabase = get_supabase()
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
        supabase = get_supabase()

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
        supabase = get_supabase()

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
        supabase = get_supabase()

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
        supabase = get_supabase()
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
        supabase = get_supabase()

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
        supabase = get_supabase()
        supabase.table("activity_logs").insert({
            "user_id": user_id,
            "action": action,
            "details": details or {},
        }).execute()
    except Exception as e:
        log.error("Error logging activity", error=str(e))
