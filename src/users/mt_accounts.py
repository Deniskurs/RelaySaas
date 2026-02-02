"""Multi-account MetaTrader management.

This module provides CRUD operations for managing multiple MT accounts per user.
"""
from dataclasses import dataclass
from typing import Optional, List, Dict, Any

from ..database.supabase import get_supabase_admin
from ..utils.logger import log


@dataclass
class MTAccount:
    """MetaTrader account data."""

    id: str
    user_id: str
    account_alias: str
    mt_login: str
    mt_server: str
    mt_platform: str
    metaapi_account_id: Optional[str]
    is_active: bool
    is_connected: bool
    is_primary: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MTAccount":
        """Create MTAccount from database row."""
        return cls(
            id=data["id"],
            user_id=data["user_id"],
            account_alias=data.get("account_alias", ""),
            mt_login=data.get("mt_login", ""),
            mt_server=data.get("mt_server", ""),
            mt_platform=data.get("mt_platform", "mt5"),
            metaapi_account_id=data.get("metaapi_account_id"),
            is_active=data.get("is_active", True),
            is_connected=data.get("is_connected", False),
            is_primary=data.get("is_primary", False),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "account_alias": self.account_alias,
            "mt_login": self.mt_login,
            "mt_server": self.mt_server,
            "mt_platform": self.mt_platform,
            "metaapi_account_id": self.metaapi_account_id,
            "is_active": self.is_active,
            "is_connected": self.is_connected,
            "is_primary": self.is_primary,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


def get_user_mt_accounts(user_id: str, active_only: bool = False) -> List[MTAccount]:
    """Get all MT accounts for a user.

    Args:
        user_id: User UUID.
        active_only: If True, only return active accounts.

    Returns:
        List of MTAccount objects, ordered by primary first, then by alias.
    """
    try:
        supabase = get_supabase_admin()
        query = supabase.table("user_mt_accounts").select("*").eq("user_id", user_id)

        if active_only:
            query = query.eq("is_active", True)

        # Order by primary first, then by alias
        query = query.order("is_primary", desc=True).order("account_alias")

        result = query.execute()

        if result.data:
            return [MTAccount.from_dict(row) for row in result.data]
        return []

    except Exception as e:
        log.error("Error getting user MT accounts", user_id=user_id, error=str(e))
        return []


def get_mt_account(account_id: str) -> Optional[MTAccount]:
    """Get a specific MT account by ID.

    Args:
        account_id: Account UUID.

    Returns:
        MTAccount or None if not found.
    """
    try:
        supabase = get_supabase_admin()
        result = supabase.table("user_mt_accounts").select("*").eq("id", account_id).execute()

        if result.data and len(result.data) > 0:
            return MTAccount.from_dict(result.data[0])
        return None

    except Exception as e:
        log.error("Error getting MT account", account_id=account_id, error=str(e))
        return None


def get_primary_mt_account(user_id: str) -> Optional[MTAccount]:
    """Get the user's primary MT account.

    Args:
        user_id: User UUID.

    Returns:
        Primary MTAccount or None if no primary set.
    """
    try:
        supabase = get_supabase_admin()
        result = (
            supabase.table("user_mt_accounts")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_primary", True)
            .limit(1)
            .execute()
        )

        if result.data and len(result.data) > 0:
            return MTAccount.from_dict(result.data[0])
        return None

    except Exception as e:
        log.error("Error getting primary MT account", user_id=user_id, error=str(e))
        return None


def get_mt_account_by_metaapi_id(metaapi_account_id: str) -> Optional[MTAccount]:
    """Get MT account by MetaAPI account ID.

    Args:
        metaapi_account_id: MetaAPI account UUID.

    Returns:
        MTAccount or None if not found.
    """
    try:
        supabase = get_supabase_admin()
        result = (
            supabase.table("user_mt_accounts")
            .select("*")
            .eq("metaapi_account_id", metaapi_account_id)
            .limit(1)
            .execute()
        )

        if result.data and len(result.data) > 0:
            return MTAccount.from_dict(result.data[0])
        return None

    except Exception as e:
        log.error("Error getting MT account by MetaAPI ID", metaapi_id=metaapi_account_id, error=str(e))
        return None


def create_mt_account(
    user_id: str,
    account_alias: str,
    mt_login: str,
    mt_server: str,
    mt_platform: str = "mt5",
    metaapi_account_id: Optional[str] = None,
    is_primary: bool = False,
) -> Optional[MTAccount]:
    """Create a new MT account for a user.

    Args:
        user_id: User UUID.
        account_alias: Friendly name for the account.
        mt_login: MetaTrader login number.
        mt_server: Broker server name.
        mt_platform: "mt4" or "mt5".
        metaapi_account_id: MetaAPI account ID (set after provisioning).
        is_primary: Whether this should be the primary account.

    Returns:
        Created MTAccount or None on error.
    """
    try:
        supabase = get_supabase_admin()

        # Check if this exact account already exists
        existing = (
            supabase.table("user_mt_accounts")
            .select("id")
            .eq("user_id", user_id)
            .eq("mt_login", mt_login)
            .eq("mt_server", mt_server)
            .execute()
        )

        if existing.data and len(existing.data) > 0:
            log.warning(
                "MT account already exists",
                user_id=user_id,
                login=mt_login,
                server=mt_server,
            )
            # Return the existing account
            return get_mt_account(existing.data[0]["id"])

        # If this is the first account for the user, make it primary
        user_accounts = get_user_mt_accounts(user_id)
        if len(user_accounts) == 0:
            is_primary = True

        data = {
            "user_id": user_id,
            "account_alias": account_alias,
            "mt_login": mt_login,
            "mt_server": mt_server,
            "mt_platform": mt_platform,
            "metaapi_account_id": metaapi_account_id,
            "is_active": True,
            "is_connected": False,
            "is_primary": is_primary,
        }

        result = supabase.table("user_mt_accounts").insert(data).execute()

        if result.data and len(result.data) > 0:
            account = MTAccount.from_dict(result.data[0])
            log.info(
                "MT account created",
                user_id=user_id,
                account_id=account.id,
                alias=account_alias,
                login=mt_login,
                is_primary=is_primary,
            )
            return account

        return None

    except Exception as e:
        log.error(
            "Error creating MT account",
            user_id=user_id,
            login=mt_login,
            error=str(e),
        )
        return None


def update_mt_account(account_id: str, updates: Dict[str, Any]) -> bool:
    """Update an MT account.

    Args:
        account_id: Account UUID.
        updates: Dict of fields to update.

    Returns:
        True if successful, False otherwise.
    """
    try:
        supabase = get_supabase_admin()

        # Filter allowed fields
        allowed_fields = {
            "account_alias",
            "mt_login",
            "mt_server",
            "mt_platform",
            "metaapi_account_id",
            "is_active",
            "is_connected",
            "is_primary",
        }
        filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}

        if not filtered_updates:
            return True

        result = (
            supabase.table("user_mt_accounts")
            .update(filtered_updates)
            .eq("id", account_id)
            .execute()
        )

        success = bool(result.data)
        if success:
            log.info(
                "MT account updated",
                account_id=account_id,
                fields=list(filtered_updates.keys()),
            )
        return success

    except Exception as e:
        log.error("Error updating MT account", account_id=account_id, error=str(e))
        return False


def delete_mt_account(account_id: str, user_id: str) -> bool:
    """Delete an MT account.

    Args:
        account_id: Account UUID.
        user_id: User UUID (for authorization check).

    Returns:
        True if successful, False otherwise.
    """
    try:
        supabase = get_supabase_admin()

        # Get account to check ownership and if it's primary
        account = get_mt_account(account_id)
        if not account:
            log.warning("MT account not found for deletion", account_id=account_id)
            return False

        if account.user_id != user_id:
            log.warning(
                "Unauthorized MT account deletion attempt",
                account_id=account_id,
                requesting_user=user_id,
                owner=account.user_id,
            )
            return False

        was_primary = account.is_primary

        # Delete the account
        result = supabase.table("user_mt_accounts").delete().eq("id", account_id).execute()

        if result.data:
            log.info(
                "MT account deleted",
                account_id=account_id,
                user_id=user_id,
                was_primary=was_primary,
            )

            # If deleted account was primary, set another account as primary
            if was_primary:
                remaining = get_user_mt_accounts(user_id)
                if remaining:
                    update_mt_account(remaining[0].id, {"is_primary": True})
                    log.info(
                        "New primary account set after deletion",
                        user_id=user_id,
                        new_primary=remaining[0].id,
                    )

            return True

        return False

    except Exception as e:
        log.error("Error deleting MT account", account_id=account_id, error=str(e))
        return False


def set_account_connected(account_id: str, connected: bool) -> bool:
    """Update the connection status of an MT account.

    Args:
        account_id: Account UUID.
        connected: Connection status.

    Returns:
        True if successful, False otherwise.
    """
    return update_mt_account(account_id, {"is_connected": connected})


def set_account_metaapi_id(account_id: str, metaapi_account_id: str) -> bool:
    """Set the MetaAPI account ID after provisioning.

    Args:
        account_id: Our account UUID.
        metaapi_account_id: MetaAPI account UUID.

    Returns:
        True if successful, False otherwise.
    """
    return update_mt_account(account_id, {"metaapi_account_id": metaapi_account_id})


def set_primary_account(user_id: str, account_id: str) -> bool:
    """Set an account as the primary for a user.

    The database trigger will automatically unset other primary accounts.

    Args:
        user_id: User UUID.
        account_id: Account UUID to make primary.

    Returns:
        True if successful, False otherwise.
    """
    # Verify ownership
    account = get_mt_account(account_id)
    if not account or account.user_id != user_id:
        log.warning(
            "Cannot set primary - account not found or not owned",
            user_id=user_id,
            account_id=account_id,
        )
        return False

    return update_mt_account(account_id, {"is_primary": True})


def get_active_accounts_for_execution(user_id: str) -> List[MTAccount]:
    """Get all active accounts that should receive trade executions.

    This is for Phase 2 when we support executing on multiple accounts.

    Args:
        user_id: User UUID.

    Returns:
        List of active, connected MTAccount objects.
    """
    try:
        supabase = get_supabase_admin()
        result = (
            supabase.table("user_mt_accounts")
            .select("*")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .eq("is_connected", True)
            .order("is_primary", desc=True)
            .execute()
        )

        if result.data:
            return [MTAccount.from_dict(row) for row in result.data]
        return []

    except Exception as e:
        log.error("Error getting active accounts for execution", user_id=user_id, error=str(e))
        return []
