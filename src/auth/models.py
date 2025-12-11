"""Authentication models."""
from dataclasses import dataclass
from typing import Optional
from datetime import datetime


@dataclass
class AuthUser:
    """Authenticated user from JWT token."""

    id: str  # UUID
    email: str
    role: str = "user"
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    status: str = "pending"
    onboarding_step: str = "telegram"
    subscription_tier: str = "free"

    @property
    def is_admin(self) -> bool:
        """Check if user is admin."""
        return self.role == "admin"

    @property
    def is_active(self) -> bool:
        """Check if user account is active."""
        return self.status == "active"

    @property
    def needs_onboarding(self) -> bool:
        """Check if user needs to complete onboarding."""
        return self.status in ("pending", "onboarding")
