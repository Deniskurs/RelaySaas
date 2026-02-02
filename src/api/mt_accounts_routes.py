"""API routes for multi-account MetaTrader management."""
import os
import uuid
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..auth.middleware import get_current_user
from ..auth.models import AuthUser
from ..users.mt_accounts import (
    MTAccount,
    get_user_mt_accounts,
    get_mt_account,
    get_primary_mt_account,
    create_mt_account,
    update_mt_account,
    delete_mt_account,
    set_primary_account,
    set_account_connected,
    set_account_metaapi_id,
)
from ..database.supabase import get_system_config
from ..utils.logger import log


router = APIRouter(prefix="/mt-accounts", tags=["mt-accounts"])


# Request/Response models
class MTAccountResponse(BaseModel):
    """MT account response model."""

    id: str
    user_id: str
    account_alias: str
    mt_login: str
    mt_server: str
    mt_platform: str
    metaapi_account_id: Optional[str] = None
    is_active: bool
    is_connected: bool
    is_primary: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class MTAccountListResponse(BaseModel):
    """List of MT accounts response."""

    accounts: List[MTAccountResponse]
    count: int


class CreateMTAccountRequest(BaseModel):
    """Request to create a new MT account."""

    account_alias: str
    mt_login: str
    mt_password: str  # Password for MetaAPI provisioning - never stored
    mt_server: str
    mt_platform: str = "mt5"
    broker_keywords: Optional[List[str]] = None


class CreateMTAccountResponse(BaseModel):
    """Response after creating MT account."""

    success: bool
    message: str
    account: Optional[MTAccountResponse] = None
    metaapi_account_id: Optional[str] = None
    provisioning_status: Optional[str] = None
    suggested_servers: Optional[List[str]] = None


class UpdateMTAccountRequest(BaseModel):
    """Request to update an MT account."""

    account_alias: Optional[str] = None
    is_active: Optional[bool] = None
    is_primary: Optional[bool] = None


class MTAccountStatusResponse(BaseModel):
    """MetaAPI deployment status response."""

    account_id: str
    metaapi_account_id: Optional[str] = None
    state: Optional[str] = None  # UNDEPLOYED, DEPLOYING, DEPLOYED
    connection_status: Optional[str] = None  # DISCONNECTED, CONNECTING, CONNECTED


# Endpoints
@router.get("", response_model=MTAccountListResponse)
async def list_mt_accounts(
    active_only: bool = False,
    user: AuthUser = Depends(get_current_user),
):
    """List all MT accounts for the current user."""
    accounts = get_user_mt_accounts(user.id, active_only=active_only)

    return MTAccountListResponse(
        accounts=[MTAccountResponse(**a.to_dict()) for a in accounts],
        count=len(accounts),
    )


@router.get("/primary", response_model=Optional[MTAccountResponse])
async def get_primary_account(
    user: AuthUser = Depends(get_current_user),
):
    """Get the user's primary MT account."""
    account = get_primary_mt_account(user.id)

    if not account:
        return None

    return MTAccountResponse(**account.to_dict())


@router.post("", response_model=CreateMTAccountResponse)
async def add_mt_account(
    request: CreateMTAccountRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Add a new MT account with MetaAPI provisioning.

    This creates the account record and provisions it with MetaAPI.
    The password is sent to MetaAPI but never stored locally.
    """
    # Validate login is numeric
    try:
        int(request.mt_login)
    except ValueError:
        raise HTTPException(status_code=400, detail="Login must be numeric (account number)")

    # Validate password
    if not request.mt_password:
        raise HTTPException(status_code=400, detail="Password is required")

    # Validate alias
    if not request.account_alias or len(request.account_alias.strip()) < 1:
        raise HTTPException(status_code=400, detail="Account alias is required")

    # Check if account already exists
    existing_accounts = get_user_mt_accounts(user.id)
    for acc in existing_accounts:
        if acc.mt_login == request.mt_login and acc.mt_server == request.mt_server:
            return CreateMTAccountResponse(
                success=False,
                message=f"Account {request.mt_login} on {request.mt_server} already exists.",
            )

    # Provision with MetaAPI
    result = await _provision_metaapi_account(
        user_id=user.id,
        login=request.mt_login,
        password=request.mt_password,
        server=request.mt_server,
        platform=request.mt_platform,
        broker_keywords=request.broker_keywords,
        alias=request.account_alias,
    )

    if not result["success"]:
        return CreateMTAccountResponse(
            success=False,
            message=result.get("message", "Failed to provision account"),
            suggested_servers=result.get("suggested_servers"),
        )

    # Determine if this should be primary (first account = primary)
    is_primary = len(existing_accounts) == 0

    # Create the account record
    account = create_mt_account(
        user_id=user.id,
        account_alias=request.account_alias.strip(),
        mt_login=request.mt_login,
        mt_server=request.mt_server,
        mt_platform=request.mt_platform,
        metaapi_account_id=result.get("account_id"),
        is_primary=is_primary,
    )

    if not account:
        return CreateMTAccountResponse(
            success=False,
            message="Failed to create account record after provisioning",
        )

    log.info(
        "MT account created and provisioned",
        user_id=user.id[:8],
        account_id=account.id,
        metaapi_id=result.get("account_id"),
        alias=request.account_alias,
    )

    return CreateMTAccountResponse(
        success=True,
        message="Account created successfully. Connection is being established...",
        account=MTAccountResponse(**account.to_dict()),
        metaapi_account_id=result.get("account_id"),
        provisioning_status=result.get("state"),
    )


@router.get("/{account_id}", response_model=MTAccountResponse)
async def get_account(
    account_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Get a specific MT account."""
    account = get_mt_account(account_id)

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this account")

    return MTAccountResponse(**account.to_dict())


@router.patch("/{account_id}", response_model=MTAccountResponse)
async def update_account(
    account_id: str,
    request: UpdateMTAccountRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Update an MT account's settings."""
    account = get_mt_account(account_id)

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this account")

    # Build updates
    updates = {}
    if request.account_alias is not None:
        updates["account_alias"] = request.account_alias.strip()
    if request.is_active is not None:
        updates["is_active"] = request.is_active
    if request.is_primary is not None:
        updates["is_primary"] = request.is_primary

    if updates:
        success = update_mt_account(account_id, updates)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update account")

    # Return updated account
    updated = get_mt_account(account_id)
    return MTAccountResponse(**updated.to_dict())


@router.delete("/{account_id}")
async def remove_account(
    account_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Remove an MT account.

    Note: This does not delete the MetaAPI account - that would need manual cleanup.
    """
    account = get_mt_account(account_id)

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this account")

    # Check if it's the only account
    all_accounts = get_user_mt_accounts(user.id)
    if len(all_accounts) == 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the only account. Add another account first.",
        )

    success = delete_mt_account(account_id, user.id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete account")

    log.info(
        "MT account deleted",
        user_id=user.id[:8],
        account_id=account_id,
        alias=account.account_alias,
    )

    return {"success": True, "message": "Account deleted"}


@router.post("/{account_id}/set-primary")
async def set_as_primary(
    account_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Set an account as the primary account."""
    account = get_mt_account(account_id)

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this account")

    success = set_primary_account(user.id, account_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to set primary account")

    log.info(
        "Primary account changed",
        user_id=user.id[:8],
        new_primary=account_id,
        alias=account.account_alias,
    )

    return {"success": True, "message": f"{account.account_alias} is now your primary account"}


@router.get("/{account_id}/status", response_model=MTAccountStatusResponse)
async def get_account_status(
    account_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Check the MetaAPI deployment and connection status of an account."""
    import httpx

    account = get_mt_account(account_id)

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this account")

    if not account.metaapi_account_id:
        return MTAccountStatusResponse(
            account_id=account_id,
            state="NOT_PROVISIONED",
        )

    # Get MetaAPI token
    system_config = get_system_config()
    metaapi_token = system_config.get("metaapi_token") or os.getenv("METAAPI_TOKEN")

    if not metaapi_token:
        raise HTTPException(status_code=500, detail="MetaAPI not configured")

    api_url = f"https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts/{account.metaapi_account_id}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                api_url,
                headers={"auth-token": metaapi_token},
                timeout=30,
            )

            if response.status_code == 200:
                data = response.json()
                state = data.get("state")
                connection_status = data.get("connectionStatus")

                # Update connection status in our database
                is_connected = state == "DEPLOYED" and connection_status == "CONNECTED"
                if account.is_connected != is_connected:
                    set_account_connected(account_id, is_connected)

                return MTAccountStatusResponse(
                    account_id=account_id,
                    metaapi_account_id=account.metaapi_account_id,
                    state=state,
                    connection_status=connection_status,
                )
            elif response.status_code == 404:
                return MTAccountStatusResponse(
                    account_id=account_id,
                    metaapi_account_id=account.metaapi_account_id,
                    state="NOT_FOUND",
                )
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"MetaAPI error: {response.text}",
                )

    except httpx.RequestError as e:
        log.error("MetaAPI request error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to connect to MetaAPI")


async def _provision_metaapi_account(
    user_id: str,
    login: str,
    password: str,
    server: str,
    platform: str,
    broker_keywords: Optional[List[str]] = None,
    alias: str = "Account",
) -> Dict[str, Any]:
    """Provision a MetaApi account.

    This is similar to the onboarding provisioning but for additional accounts.
    """
    import httpx

    system_config = get_system_config()
    metaapi_token = system_config.get("metaapi_token") or os.getenv("METAAPI_TOKEN")

    if not metaapi_token:
        return {
            "success": False,
            "message": "MetaAPI is not configured. Please contact support.",
        }

    api_url = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts"
    transaction_id = str(uuid.uuid4()).replace("-", "")

    headers = {
        "auth-token": metaapi_token,
        "Content-Type": "application/json",
        "transaction-id": transaction_id,
    }

    # Account name includes user ID prefix and alias for identification
    account_name = f"SC-{user_id[:8]}-{alias[:20]}"

    payload = {
        "name": account_name,
        "type": "cloud-g2",
        "login": login,
        "password": password,
        "server": server,
        "platform": platform,
        "magic": 12345,
        "application": "MetaApi",
        "reliability": "high",
    }

    if broker_keywords:
        payload["keywords"] = broker_keywords

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                api_url,
                json=payload,
                headers=headers,
                timeout=60,
            )

            # Handle async operation
            if response.status_code == 202:
                return await _poll_account_creation(client, api_url, headers, user_id)

            # Success
            if response.status_code in [200, 201]:
                data = response.json()
                return {
                    "success": True,
                    "account_id": data.get("id"),
                    "state": data.get("state", "CREATED"),
                }

            # Handle errors
            if response.status_code == 400:
                data = response.json()
                error_code = data.get("details", {})
                error_message = data.get("message", "")

                if isinstance(error_code, dict):
                    code = error_code.get("code", "")

                    if code == "E_SRV_NOT_FOUND":
                        servers_by_broker = error_code.get("serversByBrokers", {})
                        suggested = []
                        for broker, servers in servers_by_broker.items():
                            suggested.extend(servers[:5])
                        return {
                            "success": False,
                            "message": f"Server '{server}' not found.",
                            "suggested_servers": suggested[:10],
                        }

                    if code == "E_AUTH":
                        return {
                            "success": False,
                            "message": "Invalid login or password.",
                        }

                return {
                    "success": False,
                    "message": error_message or "Invalid account details.",
                }

            log.error(
                "MetaApi provisioning failed",
                user_id=user_id,
                status=response.status_code,
            )

            return {
                "success": False,
                "message": "Failed to create account. Please try again.",
            }

    except httpx.TimeoutException:
        return {"success": False, "message": "Request timed out."}
    except Exception as e:
        log.error("MetaApi error", error=str(e))
        return {"success": False, "message": str(e)}


async def _poll_account_creation(
    client,
    api_url: str,
    headers: Dict[str, str],
    user_id: str,
    max_attempts: int = 10,
) -> Dict[str, Any]:
    """Poll for account creation completion."""
    import asyncio

    for attempt in range(max_attempts):
        await asyncio.sleep(6)

        try:
            response = await client.post(
                api_url,
                json={},
                headers=headers,
                timeout=30,
            )

            if response.status_code in [200, 201]:
                data = response.json()
                return {
                    "success": True,
                    "account_id": data.get("id"),
                    "state": data.get("state", "CREATED"),
                }

            if response.status_code != 202:
                break

        except Exception as e:
            log.warning(f"Polling attempt {attempt + 1} failed: {e}")

    return {
        "success": False,
        "message": "Account creation timed out. Please try again.",
    }
