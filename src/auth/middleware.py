"""FastAPI authentication middleware using Supabase JWT."""
import os
from typing import Optional
from functools import wraps

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .models import AuthUser
from ..database.supabase import get_supabase

# JWT settings from Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

# Extract project ref from URL for JWT verification
PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0] if SUPABASE_URL else ""

# Bearer token scheme
security = HTTPBearer(auto_error=False)


async def verify_jwt(token: str) -> Optional[dict]:
    """Verify a Supabase JWT token.

    Args:
        token: JWT token string.

    Returns:
        Decoded payload if valid, None otherwise.
    """
    try:
        # Supabase JWTs can be verified with the anon key as secret
        # or with the JWT secret (preferred for production)
        secret = SUPABASE_JWT_SECRET or os.getenv("SUPABASE_KEY", "")

        # Try to decode with HS256
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": False}  # Supabase doesn't always set aud
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
    except Exception:
        return None


async def get_user_profile(user_id: str) -> Optional[dict]:
    """Get user profile from Supabase.

    Args:
        user_id: User UUID.

    Returns:
        Profile dict if found, None otherwise.
    """
    try:
        supabase = get_supabase()
        result = supabase.table("profiles").select("*").eq("id", user_id).execute()

        if result.data and len(result.data) > 0:
            return result.data[0]
        return None
    except Exception:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> AuthUser:
    """Get current authenticated user from JWT token.

    Args:
        credentials: Bearer token from Authorization header.

    Returns:
        AuthUser object.

    Raises:
        HTTPException: If not authenticated or token invalid.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = await verify_jwt(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    email = payload.get("email", "")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    # Get additional profile data
    profile = await get_user_profile(user_id)

    return AuthUser(
        id=user_id,
        email=email,
        role=profile.get("role", "user") if profile else "user",
        full_name=profile.get("full_name") if profile else None,
        avatar_url=profile.get("avatar_url") if profile else None,
        status=profile.get("status", "pending") if profile else "pending",
        onboarding_step=profile.get("onboarding_step", "telegram") if profile else "telegram",
        subscription_tier=profile.get("subscription_tier", "free") if profile else "free",
    )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[AuthUser]:
    """Get current user if authenticated, None otherwise.

    Args:
        credentials: Bearer token from Authorization header.

    Returns:
        AuthUser object or None.
    """
    if not credentials:
        return None

    payload = await verify_jwt(credentials.credentials)
    if not payload:
        return None

    user_id = payload.get("sub")
    email = payload.get("email", "")

    if not user_id:
        return None

    profile = await get_user_profile(user_id)

    return AuthUser(
        id=user_id,
        email=email,
        role=profile.get("role", "user") if profile else "user",
        full_name=profile.get("full_name") if profile else None,
        avatar_url=profile.get("avatar_url") if profile else None,
        status=profile.get("status", "pending") if profile else "pending",
        onboarding_step=profile.get("onboarding_step", "telegram") if profile else "telegram",
        subscription_tier=profile.get("subscription_tier", "free") if profile else "free",
    )


async def require_admin(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Require admin role.

    Args:
        user: Current authenticated user.

    Returns:
        AuthUser object if admin.

    Raises:
        HTTPException: If not admin.
    """
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


async def require_active(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    """Require active account status.

    Args:
        user: Current authenticated user.

    Returns:
        AuthUser object if active.

    Raises:
        HTTPException: If not active.
    """
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not active. Please complete onboarding.",
        )
    return user
