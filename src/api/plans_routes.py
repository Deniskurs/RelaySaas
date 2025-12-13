"""Plans and usage API routes."""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth.middleware import get_current_user
from ..auth.models import AuthUser
from ..database.supabase import get_supabase_admin
from ..utils.logger import log


router = APIRouter(prefix="/plans", tags=["plans"])


# =============================================================================
# Plan Limits Configuration
# =============================================================================

PLAN_LIMITS = {
    "free": {
        "signals_per_day": 5,
        "mt_accounts": 1,
        "telegram_channels": 2,
    },
    "pro": {
        "signals_per_day": None,  # Unlimited
        "mt_accounts": 3,
        "telegram_channels": 5,
    },
    "premium": {
        "signals_per_day": None,  # Unlimited
        "mt_accounts": 10,
        "telegram_channels": None,  # Unlimited
    },
}


# =============================================================================
# Response Models
# =============================================================================

class UsageResponse(BaseModel):
    """Current usage data for the user."""
    signals_today: int
    signals_limit: Optional[int]  # None = unlimited
    accounts_connected: int
    accounts_limit: Optional[int]
    channels_active: int
    channels_limit: Optional[int]
    tier: str
    is_pro_day_active: bool
    effective_tier: str  # Tier including Pro Day boost


class ProDayStatusResponse(BaseModel):
    """Pro Day status for the user."""
    eligible: bool
    active: bool
    activated_at: Optional[str]
    expires_at: Optional[str]
    hours_remaining: float
    consecutive_active_days: int


class ProDayActivateResponse(BaseModel):
    """Response when activating Pro Day."""
    success: bool
    expires_at: str
    message: str


class LimitCheckResponse(BaseModel):
    """Response for limit check."""
    allowed: bool
    current: int
    limit: Optional[int]
    message: Optional[str]


# =============================================================================
# Helper Functions
# =============================================================================

def get_effective_tier(profile: dict) -> str:
    """Get the effective tier, considering Pro Day activation."""
    base_tier = (profile.get("subscription_tier") or "free").lower()

    # Check if Pro Day is active
    pro_day_expires = profile.get("pro_day_expires_at")
    if pro_day_expires:
        try:
            expires = datetime.fromisoformat(pro_day_expires.replace("Z", "+00:00"))
            if expires > datetime.now(expires.tzinfo):
                return "pro"  # Pro Day gives Pro tier access
        except (ValueError, TypeError):
            pass

    return base_tier


def get_limits_for_tier(tier: str) -> dict:
    """Get limits for a given tier."""
    return PLAN_LIMITS.get(tier, PLAN_LIMITS["free"])


async def get_user_usage(user_id: str) -> dict:
    """Get current usage counts for a user."""
    supabase = get_supabase_admin()

    # Get profile with usage data
    result = supabase.table("profiles").select(
        "signals_used_today, subscription_tier, "
        "pro_day_eligible, pro_day_activated_at, pro_day_expires_at, "
        "consecutive_active_days, last_active_date"
    ).eq("id", user_id).single().execute()

    if not result.data:
        return {
            "signals_today": 0,
            "accounts_connected": 0,
            "channels_active": 0,
            "tier": "free",
            "profile": None,
        }

    profile = result.data

    # Count MT accounts (from user_credentials)
    accounts_result = supabase.table("user_credentials").select(
        "id", count="exact"
    ).eq("user_id", user_id).execute()

    # Count active Telegram channels (from user_settings_v2)
    settings_result = supabase.table("user_settings_v2").select(
        "telegram_channel_ids"
    ).eq("user_id", user_id).execute()

    channels_count = 0
    if settings_result.data and settings_result.data[0].get("telegram_channel_ids"):
        channels = settings_result.data[0]["telegram_channel_ids"]
        if isinstance(channels, list):
            channels_count = len(channels)

    return {
        "signals_today": profile.get("signals_used_today") or 0,
        "accounts_connected": accounts_result.count or 0,
        "channels_active": channels_count,
        "tier": (profile.get("subscription_tier") or "free").lower(),
        "profile": profile,
    }


async def increment_signal_count(user_id: str) -> bool:
    """Increment the daily signal count for a user.

    Returns True if successful, False if limit reached.
    """
    supabase = get_supabase_admin()

    try:
        # Get current profile
        result = supabase.table("profiles").select(
            "signals_used_today, subscription_tier, pro_day_expires_at"
        ).eq("id", user_id).single().execute()

        if not result.data:
            log.warning(f"Profile not found for user {user_id}")
            return True  # Allow if profile not found (shouldn't happen)

        profile = result.data
        effective_tier = get_effective_tier(profile)
        limits = get_limits_for_tier(effective_tier)

        current_count = profile.get("signals_used_today") or 0
        signal_limit = limits.get("signals_per_day")

        # Check if limit would be exceeded (for non-unlimited tiers)
        if signal_limit is not None and current_count >= signal_limit:
            log.info(f"Signal limit reached for user {user_id}: {current_count}/{signal_limit}")
            return False

        # Increment the count
        supabase.table("profiles").update({
            "signals_used_today": current_count + 1
        }).eq("id", user_id).execute()

        log.debug(f"Signal count incremented for user {user_id}: {current_count + 1}")
        return True

    except Exception as e:
        log.error(f"Failed to increment signal count: {e}")
        return True  # Allow on error to not block trading


async def check_signal_limit(user_id: str) -> dict:
    """Check if user can execute another signal.

    Returns dict with allowed, current, limit, and message.
    """
    supabase = get_supabase_admin()

    try:
        result = supabase.table("profiles").select(
            "signals_used_today, subscription_tier, pro_day_expires_at"
        ).eq("id", user_id).single().execute()

        if not result.data:
            return {"allowed": True, "current": 0, "limit": None, "message": None}

        profile = result.data
        effective_tier = get_effective_tier(profile)
        limits = get_limits_for_tier(effective_tier)

        current_count = profile.get("signals_used_today") or 0
        signal_limit = limits.get("signals_per_day")

        if signal_limit is None:
            return {
                "allowed": True,
                "current": current_count,
                "limit": None,
                "message": None,
            }

        if current_count >= signal_limit:
            return {
                "allowed": False,
                "current": current_count,
                "limit": signal_limit,
                "message": f"Daily signal limit reached ({current_count}/{signal_limit}). Upgrade to Pro for unlimited signals.",
            }

        return {
            "allowed": True,
            "current": current_count,
            "limit": signal_limit,
            "message": None,
        }

    except Exception as e:
        log.error(f"Failed to check signal limit: {e}")
        return {"allowed": True, "current": 0, "limit": None, "message": None}


# =============================================================================
# API Endpoints
# =============================================================================

@router.get("/usage", response_model=UsageResponse)
async def get_usage(user: AuthUser = Depends(get_current_user)):
    """Get current usage data for the authenticated user."""
    usage = await get_user_usage(user.id)
    profile = usage.get("profile") or {}

    effective_tier = get_effective_tier(profile) if profile else usage["tier"]
    limits = get_limits_for_tier(effective_tier)

    # Check if Pro Day is active
    is_pro_day_active = False
    pro_day_expires = profile.get("pro_day_expires_at") if profile else None
    if pro_day_expires:
        try:
            expires = datetime.fromisoformat(pro_day_expires.replace("Z", "+00:00"))
            is_pro_day_active = expires > datetime.now(expires.tzinfo)
        except (ValueError, TypeError):
            pass

    return UsageResponse(
        signals_today=usage["signals_today"],
        signals_limit=limits.get("signals_per_day"),
        accounts_connected=usage["accounts_connected"],
        accounts_limit=limits.get("mt_accounts"),
        channels_active=usage["channels_active"],
        channels_limit=limits.get("telegram_channels"),
        tier=usage["tier"],
        is_pro_day_active=is_pro_day_active,
        effective_tier=effective_tier,
    )


@router.get("/limits/check", response_model=LimitCheckResponse)
async def check_limits(
    limit_type: str = "signals",
    user: AuthUser = Depends(get_current_user),
):
    """Check if a specific limit allows the action.

    Args:
        limit_type: Type of limit to check (signals, accounts, channels)
    """
    if limit_type == "signals":
        result = await check_signal_limit(user.id)
        return LimitCheckResponse(**result)

    # For other types, do a general usage check
    usage = await get_user_usage(user.id)
    profile = usage.get("profile") or {}
    effective_tier = get_effective_tier(profile) if profile else usage["tier"]
    limits = get_limits_for_tier(effective_tier)

    if limit_type == "accounts":
        current = usage["accounts_connected"]
        limit = limits.get("mt_accounts")
        allowed = limit is None or current < limit
        message = None if allowed else f"MT account limit reached ({current}/{limit}). Upgrade to add more accounts."
    elif limit_type == "channels":
        current = usage["channels_active"]
        limit = limits.get("telegram_channels")
        allowed = limit is None or current < limit
        message = None if allowed else f"Channel limit reached ({current}/{limit}). Upgrade to add more channels."
    else:
        raise HTTPException(status_code=400, detail=f"Unknown limit type: {limit_type}")

    return LimitCheckResponse(
        allowed=allowed,
        current=current,
        limit=limit,
        message=message,
    )


@router.get("/pro-day/status", response_model=ProDayStatusResponse)
async def get_pro_day_status(user: AuthUser = Depends(get_current_user)):
    """Get Pro Day status for the authenticated user."""
    supabase = get_supabase_admin()

    result = supabase.table("profiles").select(
        "pro_day_eligible, pro_day_activated_at, pro_day_expires_at, consecutive_active_days"
    ).eq("id", user.id).single().execute()

    if not result.data:
        return ProDayStatusResponse(
            eligible=False,
            active=False,
            activated_at=None,
            expires_at=None,
            hours_remaining=0,
            consecutive_active_days=0,
        )

    profile = result.data
    expires_at = profile.get("pro_day_expires_at")

    # Calculate if active and hours remaining
    is_active = False
    hours_remaining = 0

    if expires_at:
        try:
            expires = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            now = datetime.now(expires.tzinfo)
            if expires > now:
                is_active = True
                hours_remaining = (expires - now).total_seconds() / 3600
        except (ValueError, TypeError):
            pass

    return ProDayStatusResponse(
        eligible=profile.get("pro_day_eligible") or False,
        active=is_active,
        activated_at=profile.get("pro_day_activated_at"),
        expires_at=expires_at,
        hours_remaining=round(hours_remaining, 1),
        consecutive_active_days=profile.get("consecutive_active_days") or 0,
    )


@router.post("/pro-day/activate", response_model=ProDayActivateResponse)
async def activate_pro_day(user: AuthUser = Depends(get_current_user)):
    """Activate 24-hour Pro Day trial for eligible users."""
    supabase = get_supabase_admin()

    # Get current profile
    result = supabase.table("profiles").select(
        "pro_day_eligible, pro_day_activated_at, subscription_tier"
    ).eq("id", user.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = result.data

    # Check if user is already on a paid plan
    tier = (profile.get("subscription_tier") or "free").lower()
    if tier in ["pro", "premium"]:
        raise HTTPException(
            status_code=400,
            detail="You're already on a paid plan. No need for Pro Day!"
        )

    # Check eligibility
    if not profile.get("pro_day_eligible"):
        raise HTTPException(
            status_code=400,
            detail="Not eligible for Pro Day yet. Keep using Relay for 7 consecutive days to unlock!"
        )

    # Check if already used
    if profile.get("pro_day_activated_at"):
        raise HTTPException(
            status_code=400,
            detail="Pro Day has already been used. Upgrade to Pro for unlimited access!"
        )

    # Activate Pro Day (24 hours)
    now = datetime.utcnow()
    expires = now + timedelta(hours=24)

    supabase.table("profiles").update({
        "pro_day_activated_at": now.isoformat(),
        "pro_day_expires_at": expires.isoformat(),
        "pro_day_eligible": False,  # Mark as used
    }).eq("id", user.id).execute()

    log.info(f"Pro Day activated for user {user.id}, expires at {expires.isoformat()}")

    return ProDayActivateResponse(
        success=True,
        expires_at=expires.isoformat(),
        message="🎉 Pro Day activated! You have 24 hours of Pro access. Enjoy unlimited signals!",
    )


@router.post("/activity/track")
async def track_activity(user: AuthUser = Depends(get_current_user)):
    """Track user activity for Pro Day eligibility.

    Should be called when user performs significant actions in the app.
    Updates last_seen_at which triggers the activity streak tracking.
    """
    supabase = get_supabase_admin()

    try:
        # Update last_seen_at to trigger the activity streak trigger
        supabase.table("profiles").update({
            "last_seen_at": datetime.utcnow().isoformat(),
        }).eq("id", user.id).execute()

        return {"status": "ok"}
    except Exception as e:
        log.error(f"Failed to track activity: {e}")
        return {"status": "error", "message": str(e)}
