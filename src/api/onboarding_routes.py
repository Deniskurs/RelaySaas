"""API routes for user onboarding."""
import os
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth.middleware import get_current_user
from ..auth.models import AuthUser
from ..users.credentials import (
    get_user_credentials,
    update_user_credentials,
    get_user_settings,
    update_user_settings,
)
from ..database.supabase import get_supabase
from ..utils.logger import log


router = APIRouter(prefix="/onboarding", tags=["onboarding"])


# Request/Response models
class OnboardingStatusResponse(BaseModel):
    """Current onboarding status."""

    status: str
    step: str
    telegram_configured: bool
    metatrader_configured: bool
    settings_configured: bool


class TelegramCredentialsRequest(BaseModel):
    """Telegram credentials from user."""

    api_id: str
    api_hash: str
    phone: str


class TelegramCredentialsResponse(BaseModel):
    """Response after saving Telegram credentials."""

    success: bool
    message: str
    requires_verification: bool = True


class MetaTraderCredentialsRequest(BaseModel):
    """MetaTrader credentials from user."""

    login: str
    server: str
    platform: str = "mt5"


class MetaTraderCredentialsResponse(BaseModel):
    """Response after saving MetaTrader credentials."""

    success: bool
    message: str
    account_id: Optional[str] = None
    secure_link: Optional[str] = None  # MetaApi secure configuration link


class TradingSettingsRequest(BaseModel):
    """Trading settings from user."""

    max_risk_percent: Optional[float] = None
    max_lot_size: Optional[float] = None
    max_open_trades: Optional[int] = None
    lot_reference_balance: Optional[float] = None
    split_tps: Optional[bool] = None
    enable_breakeven: Optional[bool] = None
    telegram_channel_ids: Optional[List[str]] = None


class OnboardingCompleteResponse(BaseModel):
    """Response after completing onboarding."""

    success: bool
    message: str


@router.get("/status", response_model=OnboardingStatusResponse)
async def get_onboarding_status(
    user: AuthUser = Depends(get_current_user),
):
    """Get current onboarding status."""
    credentials = get_user_credentials(user.id)
    settings = get_user_settings(user.id)

    telegram_configured = False
    metatrader_configured = False
    settings_configured = False

    if credentials:
        telegram_configured = credentials.has_telegram_credentials
        metatrader_configured = credentials.has_metatrader_credentials

    if settings:
        # Consider settings configured if at least one custom value is set
        settings_configured = True

    return OnboardingStatusResponse(
        status=user.status,
        step=user.onboarding_step,
        telegram_configured=telegram_configured,
        metatrader_configured=metatrader_configured,
        settings_configured=settings_configured,
    )


@router.post("/telegram", response_model=TelegramCredentialsResponse)
async def save_telegram_credentials(
    request: TelegramCredentialsRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Save Telegram API credentials."""
    # Validate API ID is numeric
    try:
        int(request.api_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="API ID must be numeric")

    # Basic phone validation
    phone = request.phone.strip()
    if not phone.startswith("+"):
        phone = "+" + phone

    success = update_user_credentials(user.id, {
        "telegram_api_id": request.api_id,
        "telegram_api_hash": request.api_hash,
        "telegram_phone": phone,
        "telegram_connected": False,  # Will be true after verification
    })

    if not success:
        raise HTTPException(status_code=500, detail="Failed to save credentials")

    # Update onboarding step
    await _update_profile_step(user.id, "metatrader")

    return TelegramCredentialsResponse(
        success=True,
        message="Telegram credentials saved. Verification will be performed on first connection.",
        requires_verification=True,
    )


@router.post("/metatrader", response_model=MetaTraderCredentialsResponse)
async def save_metatrader_credentials(
    request: MetaTraderCredentialsRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Save MetaTrader credentials and optionally provision MetaApi account."""
    # Validate login is numeric
    try:
        int(request.login)
    except ValueError:
        raise HTTPException(status_code=400, detail="Login must be numeric (account number)")

    # Save credentials
    success = update_user_credentials(user.id, {
        "mt_login": request.login,
        "mt_server": request.server,
        "mt_platform": request.platform,
        "mt_connected": False,
    })

    if not success:
        raise HTTPException(status_code=500, detail="Failed to save credentials")

    # Attempt to provision MetaApi account
    account_id = None
    secure_link = None

    try:
        account_id, secure_link = await _provision_metaapi_account(
            user_id=user.id,
            login=request.login,
            server=request.server,
            platform=request.platform,
        )

        if account_id:
            update_user_credentials(user.id, {
                "metaapi_account_id": account_id,
            })

    except Exception as e:
        log.error("MetaApi provisioning failed", user_id=user.id, error=str(e))
        # Continue anyway - user can configure later

    # Update onboarding step
    await _update_profile_step(user.id, "settings")

    return MetaTraderCredentialsResponse(
        success=True,
        message="MetaTrader credentials saved." + (
            " Use the secure link to complete account setup." if secure_link else ""
        ),
        account_id=account_id,
        secure_link=secure_link,
    )


@router.post("/settings", response_model=OnboardingCompleteResponse)
async def save_trading_settings(
    request: TradingSettingsRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Save trading settings."""
    updates = {}

    if request.max_risk_percent is not None:
        if request.max_risk_percent < 0.1 or request.max_risk_percent > 10:
            raise HTTPException(status_code=400, detail="Risk must be between 0.1% and 10%")
        updates["max_risk_percent"] = request.max_risk_percent

    if request.max_lot_size is not None:
        if request.max_lot_size < 0.01 or request.max_lot_size > 10:
            raise HTTPException(status_code=400, detail="Max lot size must be between 0.01 and 10")
        updates["max_lot_size"] = request.max_lot_size

    if request.max_open_trades is not None:
        if request.max_open_trades < 1 or request.max_open_trades > 50:
            raise HTTPException(status_code=400, detail="Max open trades must be between 1 and 50")
        updates["max_open_trades"] = request.max_open_trades

    if request.lot_reference_balance is not None:
        updates["lot_reference_balance"] = request.lot_reference_balance

    if request.split_tps is not None:
        updates["split_tps"] = request.split_tps

    if request.enable_breakeven is not None:
        updates["enable_breakeven"] = request.enable_breakeven

    if request.telegram_channel_ids is not None:
        updates["telegram_channel_ids"] = request.telegram_channel_ids

    if updates:
        success = update_user_settings(user.id, updates)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save settings")

    return OnboardingCompleteResponse(
        success=True,
        message="Settings saved successfully",
    )


@router.post("/complete", response_model=OnboardingCompleteResponse)
async def complete_onboarding(
    user: AuthUser = Depends(get_current_user),
):
    """Mark onboarding as complete."""
    try:
        supabase = get_supabase()
        result = supabase.table("profiles").update({
            "status": "active",
            "onboarding_step": "complete",
        }).eq("id", user.id).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to update profile")

        log.info("User completed onboarding", user_id=user.id)

        return OnboardingCompleteResponse(
            success=True,
            message="Onboarding complete! Your account is now active.",
        )

    except Exception as e:
        log.error("Error completing onboarding", user_id=user.id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


async def _update_profile_step(user_id: str, step: str):
    """Update the onboarding step in profile."""
    try:
        supabase = get_supabase()
        supabase.table("profiles").update({
            "status": "onboarding",
            "onboarding_step": step,
        }).eq("id", user_id).execute()
    except Exception as e:
        log.error("Error updating profile step", user_id=user_id, error=str(e))


async def _provision_metaapi_account(
    user_id: str,
    login: str,
    server: str,
    platform: str,
) -> tuple:
    """Provision a MetaApi account for the user.

    Returns:
        Tuple of (account_id, secure_config_link) or (None, None) on failure.
    """
    import httpx

    metaapi_token = os.getenv("METAAPI_TOKEN")
    if not metaapi_token:
        log.warning("METAAPI_TOKEN not set, skipping account provisioning")
        return None, None

    # MetaApi API endpoint for creating accounts
    api_url = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts"

    headers = {
        "auth-token": metaapi_token,
        "Content-Type": "application/json",
    }

    # Account creation payload
    payload = {
        "name": f"SignalCopier-{user_id[:8]}",
        "type": "cloud",
        "login": login,
        "server": server,
        "platform": platform,
        "magic": 12345,  # Magic number for identifying our trades
        "application": "MetaApi",
        "connectionStatus": "connected",
        "state": "DEPLOYED",
        # Note: password is NOT included - user will enter via secure link
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, json=payload, headers=headers, timeout=30)

            if response.status_code == 201:
                data = response.json()
                account_id = data.get("id")

                # Get secure configuration link
                secure_link = None
                if account_id:
                    link_url = f"https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/{account_id}/configuration-link"
                    link_response = await client.get(link_url, headers=headers, timeout=30)
                    if link_response.status_code == 200:
                        secure_link = link_response.json().get("configurationLink")

                log.info("MetaApi account provisioned", user_id=user_id, account_id=account_id)
                return account_id, secure_link

            else:
                log.error(
                    "MetaApi account creation failed",
                    user_id=user_id,
                    status=response.status_code,
                    response=response.text,
                )
                return None, None

    except Exception as e:
        log.error("MetaApi API error", user_id=user_id, error=str(e))
        return None, None
