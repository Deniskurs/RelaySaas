"""API routes for user onboarding."""
import os
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError

from ..auth.middleware import get_current_user
from ..auth.models import AuthUser
from ..users.credentials import (
    get_user_credentials,
    update_user_credentials,
    get_user_settings,
    update_user_settings,
)
from ..database.supabase import get_supabase, get_system_config
from ..utils.logger import log


# Per-user Telegram verification state (keyed by user_id)
# Each entry: {"client": TelegramClient, "phone_hash": str, "phone": str}
_user_telegram_verification: Dict[str, Dict[str, Any]] = {}


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


class TelegramSendCodeRequest(BaseModel):
    """Request to send Telegram verification code."""

    api_id: str
    api_hash: str
    phone: str


class TelegramVerifyCodeRequest(BaseModel):
    """Request to verify Telegram code."""

    code: str


class TelegramVerifyPasswordRequest(BaseModel):
    """Request to verify Telegram 2FA password."""

    password: str


class TelegramVerificationResponse(BaseModel):
    """Response for Telegram verification steps."""

    status: str  # "code_sent", "connected", "pending_password", "error"
    message: str
    session_saved: bool = False


class MetaTraderCredentialsRequest(BaseModel):
    """MetaTrader credentials from user."""

    login: str
    password: str  # Password for MetaAPI provisioning - never stored
    server: str
    platform: str = "mt5"
    broker_keywords: Optional[List[str]] = None  # Help find server settings


class MetaTraderCredentialsResponse(BaseModel):
    """Response after saving MetaTrader credentials."""

    success: bool
    message: str
    account_id: Optional[str] = None
    provisioning_status: Optional[str] = None  # CREATED, DEPLOYING, DEPLOYED
    suggested_servers: Optional[List[str]] = None  # If server not found


class MetaTraderStatusResponse(BaseModel):
    """MetaAPI account status response."""

    account_id: str
    state: Optional[str] = None  # UNDEPLOYED, DEPLOYING, DEPLOYED
    connection_status: Optional[str] = None  # DISCONNECTED, CONNECTING, CONNECTED


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


@router.post("/telegram/send-code", response_model=TelegramVerificationResponse)
async def telegram_send_code(
    request: TelegramSendCodeRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Start Telegram verification by sending a code to the user's phone."""
    global _user_telegram_verification

    try:
        # Clean up any existing verification for this user
        if user.id in _user_telegram_verification:
            old_state = _user_telegram_verification[user.id]
            if old_state.get("client"):
                try:
                    await old_state["client"].disconnect()
                except:
                    pass
            del _user_telegram_verification[user.id]

        # Clean phone number
        phone = request.phone.strip()
        if not phone.startswith("+"):
            phone = "+" + phone

        # Validate API ID is numeric
        try:
            api_id = int(request.api_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="API ID must be numeric")

        # Create new client with StringSession (no file storage)
        client = TelegramClient(
            StringSession(),
            api_id,
            request.api_hash,
        )

        # Connect to Telegram
        await client.connect()

        # Send code request
        result = await client.send_code_request(phone)

        # Store verification state for this user
        _user_telegram_verification[user.id] = {
            "client": client,
            "phone_hash": result.phone_code_hash,
            "phone": phone,
            "api_id": request.api_id,
            "api_hash": request.api_hash,
        }

        # Save credentials to user_credentials (not session yet)
        update_user_credentials(user.id, {
            "telegram_api_id": request.api_id,
            "telegram_api_hash": request.api_hash,
            "telegram_phone": phone,
            "telegram_connected": False,
        })

        log.info("Telegram verification code sent", user_id=user.id, phone=phone)

        return TelegramVerificationResponse(
            status="code_sent",
            message=f"Verification code sent to {phone}. Check your Telegram app or SMS.",
        )

    except Exception as e:
        log.error("Error sending Telegram code", user_id=user.id, error=str(e))
        # Clean up on error
        if user.id in _user_telegram_verification:
            old_state = _user_telegram_verification[user.id]
            if old_state.get("client"):
                try:
                    await old_state["client"].disconnect()
                except:
                    pass
            del _user_telegram_verification[user.id]

        return TelegramVerificationResponse(
            status="error",
            message=str(e),
        )


@router.post("/telegram/verify-code", response_model=TelegramVerificationResponse)
async def telegram_verify_code(
    request: TelegramVerifyCodeRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Verify the Telegram code and complete authentication."""
    global _user_telegram_verification

    if user.id not in _user_telegram_verification:
        raise HTTPException(
            status_code=400,
            detail="No pending verification. Please start the verification process first.",
        )

    state = _user_telegram_verification[user.id]
    client = state.get("client")
    phone_hash = state.get("phone_hash")
    phone = state.get("phone")

    if not client or not phone_hash:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification state. Please start over.",
        )

    try:
        # Try to sign in with the code
        await client.sign_in(
            phone=phone,
            code=request.code.strip(),
            phone_code_hash=phone_hash,
        )

        # Success! Save the session string
        session_string = client.session.save()

        # Save session to user_credentials
        update_user_credentials(user.id, {
            "telegram_session_encrypted": session_string,
            "telegram_connected": True,
        })

        # Update onboarding step
        await _update_profile_step(user.id, "metatrader")

        # Clean up
        await client.disconnect()
        del _user_telegram_verification[user.id]

        log.info("Telegram verification successful", user_id=user.id)

        return TelegramVerificationResponse(
            status="connected",
            message="Telegram connected successfully!",
            session_saved=True,
        )

    except SessionPasswordNeededError:
        # 2FA is enabled, need password
        log.info("Telegram 2FA required", user_id=user.id)
        return TelegramVerificationResponse(
            status="pending_password",
            message="Two-factor authentication is enabled. Please enter your Telegram password.",
        )

    except Exception as e:
        log.error("Error verifying Telegram code", user_id=user.id, error=str(e))
        return TelegramVerificationResponse(
            status="error",
            message=str(e),
        )


@router.post("/telegram/verify-password", response_model=TelegramVerificationResponse)
async def telegram_verify_password(
    request: TelegramVerifyPasswordRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Verify 2FA password and complete authentication."""
    global _user_telegram_verification

    if user.id not in _user_telegram_verification:
        raise HTTPException(
            status_code=400,
            detail="No pending verification. Please start the verification process first.",
        )

    state = _user_telegram_verification[user.id]
    client = state.get("client")

    if not client:
        raise HTTPException(
            status_code=400,
            detail="Invalid verification state. Please start over.",
        )

    try:
        # Sign in with password
        await client.sign_in(password=request.password)

        # Success! Save the session string
        session_string = client.session.save()

        # Save session to user_credentials
        update_user_credentials(user.id, {
            "telegram_session_encrypted": session_string,
            "telegram_connected": True,
        })

        # Update onboarding step
        await _update_profile_step(user.id, "metatrader")

        # Clean up
        await client.disconnect()
        del _user_telegram_verification[user.id]

        log.info("Telegram 2FA verification successful", user_id=user.id)

        return TelegramVerificationResponse(
            status="connected",
            message="Telegram connected successfully!",
            session_saved=True,
        )

    except Exception as e:
        log.error("Error verifying Telegram password", user_id=user.id, error=str(e))
        return TelegramVerificationResponse(
            status="error",
            message=str(e),
        )


@router.post("/metatrader", response_model=MetaTraderCredentialsResponse)
async def save_metatrader_credentials(
    request: MetaTraderCredentialsRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Save MetaTrader credentials and provision MetaApi account."""
    # Validate login is numeric
    try:
        int(request.login)
    except ValueError:
        raise HTTPException(status_code=400, detail="Login must be numeric (account number)")

    # Validate password is provided
    if not request.password:
        raise HTTPException(status_code=400, detail="Password is required")

    # Provision MetaApi account with password (password is sent to MetaAPI, never stored)
    result = await _provision_metaapi_account(
        user_id=user.id,
        login=request.login,
        password=request.password,
        server=request.server,
        platform=request.platform,
        broker_keywords=request.broker_keywords,
    )

    if not result["success"]:
        return MetaTraderCredentialsResponse(
            success=False,
            message=result.get("message", "Failed to create account"),
            suggested_servers=result.get("suggested_servers"),
        )

    # Save credentials (without password) and account ID
    success = update_user_credentials(user.id, {
        "mt_login": request.login,
        "mt_server": request.server,
        "mt_platform": request.platform,
        "mt_connected": False,
        "metaapi_account_id": result.get("account_id"),
    })

    if not success:
        raise HTTPException(status_code=500, detail="Failed to save credentials")

    # Update onboarding step
    await _update_profile_step(user.id, "settings")

    log.info(
        "MetaTrader account provisioned",
        user_id=user.id,
        account_id=result.get("account_id"),
        state=result.get("state"),
    )

    return MetaTraderCredentialsResponse(
        success=True,
        message="Account created successfully. Setting up connection...",
        account_id=result.get("account_id"),
        provisioning_status=result.get("state"),
    )


@router.get("/metatrader/status/{account_id}", response_model=MetaTraderStatusResponse)
async def get_metatrader_status(
    account_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Check MetaApi account provisioning/connection status."""
    import httpx

    # Get MetaAPI token from system_config (admin setting)
    system_config = get_system_config()
    metaapi_token = system_config.get("metaapi_token") or os.getenv("METAAPI_TOKEN")
    if not metaapi_token:
        raise HTTPException(status_code=500, detail="MetaAPI not configured")

    api_url = f"https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/{account_id}"

    headers = {
        "auth-token": metaapi_token,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(api_url, headers=headers, timeout=30)

            if response.status_code == 200:
                data = response.json()
                state = data.get("state")
                connection_status = data.get("connectionStatus")

                # Update user credentials if connected
                if state == "DEPLOYED" and connection_status == "CONNECTED":
                    update_user_credentials(user.id, {
                        "mt_connected": True,
                    })

                return MetaTraderStatusResponse(
                    account_id=account_id,
                    state=state,
                    connection_status=connection_status,
                )
            elif response.status_code == 404:
                raise HTTPException(status_code=404, detail="Account not found")
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Error checking account status: {response.text}",
                )

    except httpx.RequestError as e:
        log.error("MetaAPI request error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to connect to MetaAPI")


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
    password: str,
    server: str,
    platform: str,
    broker_keywords: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Provision a MetaApi account for the user with their credentials.

    Password is sent directly to MetaAPI and never stored locally.

    Returns:
        Dict with success, account_id, state, message, and optional suggested_servers
    """
    import httpx

    # Get MetaAPI token from system_config (admin setting)
    system_config = get_system_config()
    metaapi_token = system_config.get("metaapi_token") or os.getenv("METAAPI_TOKEN")
    if not metaapi_token:
        log.warning("metaapi_token not configured in system_config or environment")
        return {
            "success": False,
            "message": "MetaAPI is not configured. Please contact support.",
        }

    # MetaApi API endpoint for creating accounts
    api_url = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts"

    # Generate unique transaction ID for this request
    transaction_id = str(uuid.uuid4()).replace("-", "")

    headers = {
        "auth-token": metaapi_token,
        "Content-Type": "application/json",
        "transaction-id": transaction_id,
    }

    # Account creation payload with password
    payload = {
        "name": f"SignalCopier-{user_id[:8]}",
        "type": "cloud-g2",  # Faster and cheaper
        "login": login,
        "password": password,  # Sent to MetaAPI - never stored locally
        "server": server,
        "platform": platform,
        "magic": 12345,  # Magic number for identifying our trades
        "application": "MetaApi",
        "reliability": "high",
    }

    # Add broker keywords if provided (helps find server settings)
    if broker_keywords:
        payload["keywords"] = broker_keywords

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                api_url,
                json=payload,
                headers=headers,
                timeout=60,  # Account creation can take time
            )

            # Handle 202 - async operation in progress
            if response.status_code == 202:
                data = response.json()
                message = data.get("message", "Account creation in progress")
                retry_after = response.headers.get("Retry-After")

                log.info(
                    "MetaApi account creation pending",
                    user_id=user_id,
                    message=message,
                    retry_after=retry_after,
                )

                # Poll for result using same transaction ID
                return await _poll_account_creation(
                    client, api_url, headers, user_id, transaction_id
                )

            # Handle success
            if response.status_code in [200, 201]:
                data = response.json()
                account_id = data.get("id")
                state = data.get("state", "CREATED")

                log.info(
                    "MetaApi account provisioned",
                    user_id=user_id,
                    account_id=account_id,
                    state=state,
                )

                return {
                    "success": True,
                    "account_id": account_id,
                    "state": state,
                }

            # Handle errors
            if response.status_code == 400:
                data = response.json()
                error_code = data.get("details", {})
                error_message = data.get("message", "")

                # Check for specific error types
                if isinstance(error_code, dict):
                    code = error_code.get("code", "")

                    # Server not found - suggest alternatives
                    if code == "E_SRV_NOT_FOUND":
                        servers_by_broker = error_code.get("serversByBrokers", {})
                        suggested = []
                        for broker, servers in servers_by_broker.items():
                            suggested.extend(servers[:5])  # Limit suggestions

                        return {
                            "success": False,
                            "message": f"Server '{server}' not found. Please check the server name.",
                            "suggested_servers": suggested[:10],
                        }

                    # Authentication error
                    if code == "E_AUTH":
                        return {
                            "success": False,
                            "message": "Invalid login or password. Please verify your credentials and try again.",
                        }

                    # Resource slots error
                    if code == "E_RESOURCE_SLOTS":
                        recommended = error_code.get("recommendedResourceSlots", 2)
                        return {
                            "success": False,
                            "message": f"Your broker requires additional resources. Please contact support.",
                        }

                    # No symbols error
                    if code == "E_NO_SYMBOLS":
                        return {
                            "success": False,
                            "message": "No trading symbols configured for this account. Please check with your broker.",
                        }

                    # OTP required
                    if code == "ERR_OTP_REQUIRED":
                        return {
                            "success": False,
                            "message": "One-time password is required. Please disable OTP in your MT mobile app and try again.",
                        }

                    # Password change required
                    if code == "E_PASSWORD_CHANGE_REQUIRED":
                        return {
                            "success": False,
                            "message": "Your broker requires a password change. Please change your password and try again.",
                        }

                    # Account disabled
                    if code == "E_TRADING_ACCOUNT_DISABLED":
                        return {
                            "success": False,
                            "message": "This trading account is disabled. Please contact your broker.",
                        }

                # Generic validation error
                return {
                    "success": False,
                    "message": error_message or "Invalid account details. Please check and try again.",
                }

            # Other error
            log.error(
                "MetaApi account creation failed",
                user_id=user_id,
                status=response.status_code,
                response=response.text,
            )

            return {
                "success": False,
                "message": "Failed to create account. Please try again later.",
            }

    except httpx.TimeoutException:
        log.error("MetaApi request timeout", user_id=user_id)
        return {
            "success": False,
            "message": "Request timed out. Please try again.",
        }
    except Exception as e:
        log.error("MetaApi API error", user_id=user_id, error=str(e))
        return {
            "success": False,
            "message": f"An error occurred: {str(e)}",
        }


async def _poll_account_creation(
    client,
    api_url: str,
    headers: Dict[str, str],
    user_id: str,
    transaction_id: str,
    max_attempts: int = 10,
) -> Dict[str, Any]:
    """Poll for account creation completion when 202 is received."""
    import asyncio

    for attempt in range(max_attempts):
        await asyncio.sleep(6)  # Wait between polls

        try:
            response = await client.post(
                api_url,
                json={},  # Empty body for polling
                headers=headers,
                timeout=30,
            )

            if response.status_code in [200, 201]:
                data = response.json()
                account_id = data.get("id")
                state = data.get("state", "CREATED")

                log.info(
                    "MetaApi account created after polling",
                    user_id=user_id,
                    account_id=account_id,
                    attempt=attempt + 1,
                )

                return {
                    "success": True,
                    "account_id": account_id,
                    "state": state,
                }

            if response.status_code == 202:
                # Still processing
                continue

            # Error occurred
            data = response.json()
            return {
                "success": False,
                "message": data.get("message", "Account creation failed"),
            }

        except Exception as e:
            log.error("Error polling account creation", error=str(e))
            continue

    return {
        "success": False,
        "message": "Account creation timed out. Please try again.",
    }
