"""Database modules."""
# Supabase-based database (primary)
from .supabase import (
    get_supabase,
    get_supabase_admin,
    get_settings,
    update_settings,
    get_system_config,
    get_system_config_value,
    update_system_config,
)
from . import supabase_crud

__all__ = [
    # Supabase client
    "get_supabase",
    "get_supabase_admin",
    # Settings
    "get_settings",
    "update_settings",
    # System config
    "get_system_config",
    "get_system_config_value",
    "update_system_config",
    # CRUD module
    "supabase_crud",
]
