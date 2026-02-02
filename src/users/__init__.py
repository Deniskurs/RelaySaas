"""User management module for multi-tenant operations."""
from .manager import UserConnectionManager, user_manager
from .credentials import get_user_credentials, update_user_credentials
from .mt_accounts import (
    MTAccount,
    get_user_mt_accounts,
    get_mt_account,
    get_primary_mt_account,
    create_mt_account,
    update_mt_account,
    delete_mt_account,
    set_account_connected,
)

__all__ = [
    "UserConnectionManager",
    "user_manager",
    "get_user_credentials",
    "update_user_credentials",
    "MTAccount",
    "get_user_mt_accounts",
    "get_mt_account",
    "get_primary_mt_account",
    "create_mt_account",
    "update_mt_account",
    "delete_mt_account",
    "set_account_connected",
]
