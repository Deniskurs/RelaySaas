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
        # NOTE: Don't reset telegram_connected here - the old session might still be valid
        # Only update telegram_connected to True after successful verification
        update_user_credentials(user.id, {
            "telegram_api_id": request.api_id,
            "telegram_api_hash": request.api_hash,
            "telegram_phone": phone,
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

    # FAILSAFE: Check if user already has a MetaAPI account to prevent duplicates
    existing_credentials = get_user_credentials(user.id)
    if existing_credentials and existing_credentials.metaapi_account_id:
        # User already has an account - check if it matches the login
        if existing_credentials.mt_login == request.login:
            log.info(
                "User already has MetaAPI account for this login",
                user_id=user.id,
                account_id=existing_credentials.metaapi_account_id,
                login=request.login,
            )
            # Return existing account info
            return MetaTraderCredentialsResponse(
                success=True,
                message="Account already configured. Checking connection status...",
                account_id=existing_credentials.metaapi_account_id,
                provisioning_status="DEPLOYED",
            )
        else:
            # Different login - warn but allow (user may be switching accounts)
            log.warning(
                "User switching MT account - old account may become orphaned in MetaAPI",
                user_id=user.id,
                old_login=existing_credentials.mt_login,
                new_login=request.login,
                old_account_id=existing_credentials.metaapi_account_id,
            )

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
                    log.info(
                        "MT account connected, updating credentials",
                        user_id=user.id,
                        account_id=account_id,
                    )
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

        # Auto-connect user in multi-tenant mode
        import os
        multi_tenant = os.getenv("MULTI_TENANT_MODE", "false").lower() == "true"
        if multi_tenant:
            try:
                from ..users.manager import user_manager
                success = await user_manager.connect_user(user.id)
                if success:
                    log.info("User auto-connected after onboarding", user_id=user.id[:8])
                else:
                    log.warning("Failed to auto-connect user after onboarding", user_id=user.id[:8])
            except Exception as conn_err:
                log.error("Error auto-connecting user", user_id=user.id[:8], error=str(conn_err))

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
    Includes proper deployment and wait logic based on MetaAPI best practices.

    Returns:
        Dict with success, account_id, state, message, and optional suggested_servers
    """
    import asyncio
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

    # MetaApi API base URL
    base_url = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai"
    api_url = f"{base_url}/users/current/accounts"

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

    log.info(
        "Provisioning MetaAPI account during onboarding",
        user_id=user_id[:8],
        login=login,
        server=server,
        transaction_id=transaction_id[:8],
    )

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            # Step 1: Create the account
            response = await client.post(api_url, json=payload, headers=headers)

            # Handle 202 - async operation in progress
            if response.status_code == 202:
                log.info("MetaAPI returned 202, polling for completion...")
                result = await _poll_account_creation(
                    client, base_url, headers, transaction_id, user_id
                )
                if not result["success"]:
                    return result
                account_id = result["account_id"]
            elif response.status_code in [200, 201]:
                data = response.json()
                account_id = data.get("id")
                log.info(f"Account created: {account_id}")
            else:
                return _handle_provisioning_error(response, server)

            if not account_id:
                return {"success": False, "message": "No account ID returned from MetaAPI"}

            # Step 2: Deploy the account (start the API server)
            log.info(f"Deploying account {account_id[:8]}...")
            deploy_url = f"{base_url}/users/current/accounts/{account_id}/deploy"
            deploy_response = await client.post(deploy_url, headers=headers)

            if deploy_response.status_code not in [200, 204]:
                log.warning(
                    f"Deploy returned {deploy_response.status_code}, continuing anyway"
                )

            # Step 3: Wait for DEPLOYED state (poll with exponential backoff)
            log.info(f"Waiting for account to reach DEPLOYED state...")
            deployed = await _wait_for_deployed_state(
                client, base_url, headers, account_id, max_wait_seconds=120
            )

            if not deployed:
                log.warning(
                    "Account not fully deployed yet, but creation succeeded. "
                    "Connection will be established when the account is ready."
                )

            return {
                "success": True,
                "account_id": account_id,
                "state": "DEPLOYED" if deployed else "DEPLOYING",
            }

    except httpx.TimeoutException as e:
        log.error("MetaAPI timeout during onboarding provisioning", error=str(e))
        return {
            "success": False,
            "message": "Connection to MetaAPI timed out. The broker may be slow to respond. Please try again.",
        }
    except httpx.RequestError as e:
        log.error("MetaAPI request error during onboarding", error=str(e))
        return {"success": False, "message": f"Network error: {str(e)}"}
    except Exception as e:
        log.error("MetaAPI unexpected error during onboarding", error=str(e), exc_info=True)
        return {"success": False, "message": str(e)}


def _handle_provisioning_error(response, server: str) -> Dict[str, Any]:
    """Handle MetaAPI provisioning error responses with user-friendly messages."""
    try:
        data = response.json()
    except Exception:
        return {
            "success": False,
            "message": f"MetaAPI error (HTTP {response.status_code})",
        }

    error_details = data.get("details", {})
    error_message = data.get("message", "")

    if isinstance(error_details, dict):
        code = error_details.get("code", "")

        # Server not found - suggest alternatives
        if code == "E_SRV_NOT_FOUND":
            servers_by_broker = error_details.get("serversByBrokers", {})
            suggested = []
            for broker, servers in servers_by_broker.items():
                suggested.extend(servers[:5])
            return {
                "success": False,
                "message": f"Server '{server}' not found. Please check the server name.",
                "suggested_servers": suggested[:10],
            }

        # Authentication failed
        if code == "E_AUTH":
            return {
                "success": False,
                "message": "Invalid login or password. Please verify your credentials.",
            }

        # Broker settings detection in progress
        if code == "E_SERVER_TIMEZONE":
            return {
                "success": False,
                "message": "Broker settings detection in progress. Please try again in 60 seconds.",
            }

        # Resource slots issue
        if code == "E_RESOURCE_SLOTS":
            return {
                "success": False,
                "message": "This broker requires additional resources. Please contact support.",
            }

        # OTP required
        if code == "ERR_OTP_REQUIRED":
            return {
                "success": False,
                "message": "Your broker requires one-time password (OTP). Please disable OTP in your broker settings.",
            }

        # Password change required
        if code == "E_PASSWORD_CHANGE_REQUIRED":
            return {
                "success": False,
                "message": "Your broker requires a password change. Please update your password via the broker portal.",
            }

        # Account disabled
        if code == "E_TRADING_ACCOUNT_DISABLED":
            return {
                "success": False,
                "message": "This trading account has been disabled by your broker. Please contact your broker.",
            }

        # No symbols configured
        if code == "E_NO_SYMBOLS":
            return {
                "success": False,
                "message": "No trading symbols configured for this account. Please check account settings with your broker.",
            }

    log.warning(
        "Unhandled MetaAPI error during onboarding",
        status=response.status_code,
        message=error_message,
        details=error_details,
    )

    return {
        "success": False,
        "message": error_message or "Failed to create account. Please check your details and try again.",
    }


async def _poll_account_creation(
    client,
    base_url: str,
    headers: Dict[str, str],
    transaction_id: str,
    user_id: str,
    max_attempts: int = 20,
) -> Dict[str, Any]:
    """Poll for account creation completion when MetaAPI returns 202.

    Uses GET requests to check account status instead of POST with empty body.
    """
    import asyncio

    # Remove transaction-id from headers for GET requests
    get_headers = {k: v for k, v in headers.items() if k != "transaction-id"}
    accounts_url = f"{base_url}/users/current/accounts"

    for attempt in range(max_attempts):
        # Exponential backoff: 3s, 3s, 6s, 6s, 9s, 9s, 12s...
        wait_time = min(3 + (attempt // 2) * 3, 15)
        await asyncio.sleep(wait_time)

        try:
            # Query accounts to find the one we just created
            response = await client.get(
                accounts_url,
                headers=get_headers,
                params={"query": f"SignalCopier-{user_id[:8]}"},
                timeout=30,
            )

            if response.status_code == 200:
                accounts = response.json()
                # Find the most recently created account matching our prefix
                for acc in accounts:
                    if acc.get("name", "").startswith(f"SignalCopier-{user_id[:8]}"):
                        account_id = acc.get("_id") or acc.get("id")
                        if account_id:
                            log.info(f"Found created account: {account_id}")
                            return {
                                "success": True,
                                "account_id": account_id,
                                "state": acc.get("state", "CREATED"),
                            }

            log.debug(f"Polling attempt {attempt + 1}/{max_attempts}...")

        except Exception as e:
            log.warning(f"Polling attempt {attempt + 1} failed: {e}")

    return {
        "success": False,
        "message": "Account creation is taking longer than expected. Please check the Accounts page in a few minutes.",
    }


async def _wait_for_deployed_state(
    client,
    base_url: str,
    headers: Dict[str, str],
    account_id: str,
    max_wait_seconds: int = 120,
) -> bool:
    """Wait for an account to reach DEPLOYED state.

    Returns True if deployed successfully, False if timeout.
    """
    import asyncio

    account_url = f"{base_url}/users/current/accounts/{account_id}"
    get_headers = {k: v for k, v in headers.items() if k != "transaction-id"}

    start_time = asyncio.get_event_loop().time()
    poll_interval = 5  # Check every 5 seconds

    while (asyncio.get_event_loop().time() - start_time) < max_wait_seconds:
        try:
            response = await client.get(account_url, headers=get_headers, timeout=30)

            if response.status_code == 200:
                data = response.json()
                state = data.get("state")
                connection_status = data.get("connectionStatus")

                log.debug(
                    f"Account state: {state}, connection: {connection_status}"
                )

                if state == "DEPLOYED":
                    return True

                if state in ["DEPLOY_FAILED", "DELETE_FAILED"]:
                    log.error(f"Account deployment failed with state: {state}")
                    return False

        except Exception as e:
            log.warning(f"Error checking account state: {e}")

        await asyncio.sleep(poll_interval)

    return False
