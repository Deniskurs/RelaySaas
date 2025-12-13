"""Stripe subscription API routes."""
import os
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..auth.middleware import get_current_user, get_optional_user
from ..auth.models import AuthUser
from ..database.supabase import get_supabase_admin
from ..utils.logger import log


router = APIRouter(prefix="/stripe", tags=["stripe"])

# Initialize Stripe with secret key
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Price ID mapping
PRICE_IDS = {
    "pro_monthly": os.getenv("STRIPE_PRICE_PRO_MONTHLY", "price_1Sdwp9AKcZSTaYXWXBjDvJQo"),
    "pro_annual": os.getenv("STRIPE_PRICE_PRO_ANNUAL", "price_1Sdwp8AKcZSTaYXWgUr6CQj1"),
    "premium_monthly": os.getenv("STRIPE_PRICE_PREMIUM_MONTHLY", "price_1Sdwr3AKcZSTaYXWjvtbcHFn"),
    "premium_annual": os.getenv("STRIPE_PRICE_PREMIUM_ANNUAL", "price_1Sdwr3AKcZSTaYXWrgQR9CDi"),
}

# Plan to tier mapping
PLAN_TIERS = {
    "pro_monthly": "pro",
    "pro_annual": "pro",
    "premium_monthly": "premium",
    "premium_annual": "premium",
}


# =============================================================================
# Request/Response Models
# =============================================================================

class CreateCheckoutSessionRequest(BaseModel):
    """Request to create a checkout session."""
    plan: str  # "pro" or "premium"
    billing: str = "monthly"  # "monthly" or "annual"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


class CreateCheckoutSessionResponse(BaseModel):
    """Response with checkout session details."""
    client_secret: str
    session_id: str


class CreatePortalSessionRequest(BaseModel):
    """Request to create a customer portal session."""
    return_url: str


class CreatePortalSessionResponse(BaseModel):
    """Response with portal session URL."""
    url: str


class SubscriptionStatusResponse(BaseModel):
    """Current subscription status."""
    tier: str
    status: str
    stripe_customer_id: Optional[str]
    current_period_end: Optional[str]
    cancel_at_period_end: bool


class PriceInfo(BaseModel):
    """Price information for display."""
    price_id: str
    plan: str
    billing: str
    amount: int  # in pence/cents
    currency: str
    interval: str


# =============================================================================
# Helper Functions
# =============================================================================

async def get_or_create_stripe_customer(user: AuthUser) -> str:
    """Get existing Stripe customer or create new one."""
    supabase = get_supabase_admin()

    # Check if user already has a Stripe customer ID
    result = supabase.table("profiles").select(
        "stripe_customer_id, email, full_name"
    ).eq("id", user.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="User profile not found")

    profile = result.data

    if profile.get("stripe_customer_id"):
        # Verify customer still exists in Stripe
        try:
            customer = stripe.Customer.retrieve(profile["stripe_customer_id"])
            # Check if customer exists and is not deleted
            if customer and not getattr(customer, 'deleted', False):
                return profile["stripe_customer_id"]
        except stripe.error.InvalidRequestError:
            # Customer doesn't exist, create new one
            pass

    # Create new Stripe customer
    customer = stripe.Customer.create(
        email=profile.get("email") or user.email,
        name=profile.get("full_name"),
        metadata={"user_id": user.id},
    )

    # Save customer ID to profile
    supabase.table("profiles").update({
        "stripe_customer_id": customer.id
    }).eq("id", user.id).execute()

    log.info(f"Created Stripe customer {customer.id} for user {user.id}")

    return customer.id


def get_price_id(plan: str, billing: str) -> str:
    """Get the Stripe price ID for a plan and billing cycle."""
    key = f"{plan}_{billing}"
    price_id = PRICE_IDS.get(key)

    if not price_id:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid plan/billing combination: {plan}/{billing}"
        )

    return price_id


# =============================================================================
# API Endpoints
# =============================================================================

@router.post("/create-checkout-session", response_model=CreateCheckoutSessionResponse)
async def create_checkout_session(
    request: CreateCheckoutSessionRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Create a Stripe Checkout Session for embedded checkout.

    Uses ui_mode='embedded' for the Payment Element integration.
    """
    try:
        # Get or create Stripe customer
        customer_id = await get_or_create_stripe_customer(user)

        # Get the price ID for the selected plan
        price_id = get_price_id(request.plan, request.billing)

        # Build return URL
        base_url = request.success_url or os.getenv(
            "APP_URL", "http://localhost:5173"
        )
        return_url = f"{base_url}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"

        # Create checkout session with embedded mode
        session = stripe.checkout.Session.create(
            ui_mode="embedded",
            customer=customer_id,
            line_items=[{
                "price": price_id,
                "quantity": 1,
            }],
            mode="subscription",
            return_url=return_url,
            # Metadata for webhook processing
            metadata={
                "user_id": user.id,
                "plan": request.plan,
                "billing": request.billing,
            },
            subscription_data={
                "metadata": {
                    "user_id": user.id,
                    "plan": request.plan,
                },
            },
            # Allow promotion codes
            allow_promotion_codes=True,
            # Collect billing address for tax purposes
            billing_address_collection="auto",
        )

        log.info(f"Created checkout session {session.id} for user {user.id}")

        return CreateCheckoutSessionResponse(
            client_secret=session.client_secret,
            session_id=session.id,
        )

    except stripe.error.StripeError as e:
        log.error(f"Stripe error creating checkout session: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-portal-session", response_model=CreatePortalSessionResponse)
async def create_portal_session(
    request: CreatePortalSessionRequest,
    user: AuthUser = Depends(get_current_user),
):
    """Create a Stripe Customer Portal session for subscription management."""
    supabase = get_supabase_admin()

    # Get customer ID from profile
    result = supabase.table("profiles").select(
        "stripe_customer_id"
    ).eq("id", user.id).single().execute()

    if not result.data or not result.data.get("stripe_customer_id"):
        raise HTTPException(
            status_code=400,
            detail="No active subscription found. Please subscribe first."
        )

    try:
        session = stripe.billing_portal.Session.create(
            customer=result.data["stripe_customer_id"],
            return_url=request.return_url,
        )

        log.info(f"Created portal session for user {user.id}")

        return CreatePortalSessionResponse(url=session.url)

    except stripe.error.StripeError as e:
        log.error(f"Stripe error creating portal session: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subscription-status", response_model=SubscriptionStatusResponse)
async def get_subscription_status(user: AuthUser = Depends(get_current_user)):
    """Get current subscription status for the authenticated user."""
    supabase = get_supabase_admin()

    result = supabase.table("profiles").select(
        "subscription_tier, subscription_status, stripe_customer_id, subscription_expires_at"
    ).eq("id", user.id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile = result.data

    # Check Stripe for more detailed subscription info
    cancel_at_period_end = False
    current_period_end = profile.get("subscription_expires_at")

    if profile.get("stripe_customer_id"):
        try:
            subscriptions = stripe.Subscription.list(
                customer=profile["stripe_customer_id"],
                status="active",
                limit=1,
            )
            if subscriptions.data:
                sub = subscriptions.data[0]
                cancel_at_period_end = sub.cancel_at_period_end
                current_period_end = sub.current_period_end
        except stripe.error.StripeError:
            pass  # Use profile data if Stripe call fails

    return SubscriptionStatusResponse(
        tier=profile.get("subscription_tier") or "free",
        status=profile.get("subscription_status") or "active",
        stripe_customer_id=profile.get("stripe_customer_id"),
        current_period_end=str(current_period_end) if current_period_end else None,
        cancel_at_period_end=cancel_at_period_end,
    )


@router.get("/prices")
async def get_prices():
    """Get all available subscription prices.

    Public endpoint - no authentication required.
    """
    prices = []

    for key, price_id in PRICE_IDS.items():
        plan, billing = key.rsplit("_", 1)

        try:
            stripe_price = stripe.Price.retrieve(price_id)
            prices.append(PriceInfo(
                price_id=price_id,
                plan=plan,
                billing=billing,
                amount=stripe_price.unit_amount,
                currency=stripe_price.currency,
                interval=stripe_price.recurring.interval if stripe_price.recurring else "one_time",
            ))
        except stripe.error.StripeError as e:
            log.warning(f"Failed to fetch price {price_id}: {e}")

    return {"prices": prices}


@router.get("/checkout-session/{session_id}")
async def get_checkout_session(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """Get checkout session status (for confirming successful payment)."""
    try:
        session = stripe.checkout.Session.retrieve(session_id)

        # Verify this session belongs to the user
        if session.metadata.get("user_id") != user.id:
            raise HTTPException(status_code=403, detail="Session not found")

        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "customer_email": session.customer_details.email if session.customer_details else None,
        }

    except stripe.error.StripeError as e:
        log.error(f"Error retrieving checkout session: {e}")
        raise HTTPException(status_code=400, detail=str(e))
