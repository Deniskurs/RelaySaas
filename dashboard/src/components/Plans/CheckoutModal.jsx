/**
 * CheckoutModal - Embedded Stripe checkout in a slide-out sheet
 * Uses Stripe's Payment Element with custom dark theme styling
 */

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { cn } from "@/lib/utils";
import {
  Shield,
  Crown,
  Loader2,
  Check,
  AlertCircle,
  ArrowLeft,
  Lock,
  Zap,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getStripe,
  createCheckoutSession,
  PRICE_INFO,
} from "@/lib/stripe";

// API URL for fallback endpoint
const API_URL = import.meta.env.VITE_API_URL || "";

// Plan display info
const PLAN_INFO = {
  pro: {
    name: "Pro",
    tagline: "For serious traders who want more",
    icon: Shield,
    color: "accent-teal",
    features: [
      "Unlimited signals",
      "3 MT5 accounts",
      "5 Telegram channels",
      "Advanced filters",
      "Priority support",
    ],
  },
  premium: {
    name: "Premium",
    tagline: "Maximum power for professionals",
    icon: Crown,
    color: "accent-gold",
    features: [
      "Everything in Pro",
      "10 MT5 accounts",
      "Unlimited channels",
      "API access",
      "Dedicated support",
    ],
  },
};

export function CheckoutModal({
  open,
  onOpenChange,
  plan = "pro",
  billing = "monthly",
}) {
  const { session, refreshProfile } = useAuth();
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  const planInfo = PLAN_INFO[plan];
  const priceInfo = PRICE_INFO[plan]?.[billing];

  // Create checkout session when modal opens
  useEffect(() => {
    if (open && !clientSecret && !loading && session?.access_token) {
      initializeCheckout();
    }
  }, [open, session?.access_token]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setError(null);
      setCheckoutComplete(false);
    }
  }, [open]);

  const initializeCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await createCheckoutSession(
        plan,
        billing,
        session.access_token
      );
      setClientSecret(result.client_secret);
    } catch (err) {
      console.error("Checkout error:", err);
      setError(err.message || "Failed to initialize checkout");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = useCallback(async () => {
    console.log("[Checkout] handleComplete called");
    setCheckoutComplete(true);

    // Call the checkout session endpoint to activate subscription (fallback for webhook)
    console.log("[Checkout] session access_token:", session?.access_token ? "present" : "missing");
    console.log("[Checkout] clientSecret:", clientSecret ? "present" : "missing");

    if (session?.access_token && clientSecret) {
      // Extract session ID from client secret (format: cs_xxx_secret_yyy)
      const sessionId = clientSecret.split('_secret_')[0];
      console.log("[Checkout] Extracted session ID:", sessionId);
      console.log("[Checkout] API_URL:", API_URL || "(empty - using relative URL)");

      try {
        const url = `${API_URL}/api/stripe/checkout-session/${sessionId}`;
        console.log("[Checkout] Fetching:", url);

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        const data = await response.json();
        console.log("[Checkout] Response:", response.status, data);
      } catch (err) {
        console.error("[Checkout] Failed to verify checkout session:", err);
      }
    } else {
      console.warn("[Checkout] Missing session or clientSecret, skipping activation");
    }

    // Refresh profile to get updated subscription status
    console.log("[Checkout] Refreshing profile...");
    if (refreshProfile) {
      await refreshProfile();
    }

    // Close modal after delay
    setTimeout(() => {
      onOpenChange(false);
    }, 2000);
  }, [refreshProfile, onOpenChange, session?.access_token, clientSecret]);

  const stripeOptions = clientSecret
    ? {
        clientSecret,
        onComplete: handleComplete,
      }
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[540px] overflow-y-auto p-0"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-white/[0.06]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-3">
                {planInfo && (
                  <div
                    className={cn(
                      "p-2.5 rounded-none",
                      plan === "pro" && "bg-[hsl(var(--accent-teal))]/10",
                      plan === "premium" && "bg-[hsl(var(--accent-gold))]/10"
                    )}
                  >
                    {planInfo.icon && (
                      <planInfo.icon
                        size={20}
                        className={cn(
                          plan === "pro" && "text-[hsl(var(--accent-teal))]",
                          plan === "premium" && "text-[hsl(var(--accent-gold))]"
                        )}
                      />
                    )}
                  </div>
                )}
                <div>
                  <span className="text-foreground">
                    Upgrade to {planInfo?.name}
                  </span>
                  <p className="text-xs font-normal text-foreground-muted mt-0.5">
                    {planInfo?.tagline}
                  </p>
                </div>
              </SheetTitle>
              <SheetDescription className="sr-only">
                Complete your upgrade to the {planInfo?.name} plan with secure checkout
              </SheetDescription>
            </SheetHeader>
          </div>

          {/* Price Summary */}
          {priceInfo && (
            <div className="px-6 py-4 bg-white/[0.02] border-b border-white/[0.06]">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-bold text-foreground">
                    {priceInfo.currency}
                    {priceInfo.amount}
                  </span>
                  <span className="text-sm text-foreground-muted ml-1">
                    /{priceInfo.interval}
                  </span>
                </div>
                {billing === "annual" && priceInfo.perMonth && (
                  <span className="text-xs px-2 py-1 rounded-none bg-[hsl(var(--accent-teal))]/10 text-[hsl(var(--accent-teal))]">
                    {priceInfo.currency}
                    {priceInfo.perMonth.toFixed(2)}/mo
                  </span>
                )}
              </div>
              {billing === "monthly" && (
                <p className="text-xs text-[hsl(var(--accent-teal))] mt-1">
                  Save with annual billing
                </p>
              )}
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 p-6">
            {/* Loading State */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2
                  size={32}
                  className="animate-spin text-[hsl(var(--accent-teal))] mb-4"
                />
                <p className="text-sm text-foreground-muted">
                  Preparing checkout...
                </p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-3 rounded-full bg-destructive/10 mb-4">
                  <AlertCircle size={24} className="text-destructive" />
                </div>
                <p className="text-sm text-foreground mb-4">{error}</p>
                <Button
                  onClick={initializeCheckout}
                  variant="outline"
                  className="gap-2"
                >
                  <ArrowLeft size={16} />
                  Try Again
                </Button>
              </div>
            )}

            {/* Success State */}
            {checkoutComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="p-4 rounded-full bg-[hsl(var(--accent-teal))]/10 mb-4">
                  <Check
                    size={32}
                    className="text-[hsl(var(--accent-teal))]"
                  />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Welcome to {planInfo?.name}!
                </h3>
                <p className="text-sm text-foreground-muted text-center">
                  Your subscription is now active. Enjoy unlimited trading!
                </p>
              </motion.div>
            )}

            {/* Stripe Embedded Checkout */}
            {clientSecret && !checkoutComplete && (
              <div className="min-h-[400px]">
                <EmbeddedCheckoutProvider
                  stripe={getStripe()}
                  options={stripeOptions}
                >
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}
          </div>

          {/* Footer - Trust signals */}
          {!checkoutComplete && (
            <div className="p-4 border-t border-white/[0.06] bg-white/[0.01]">
              <div className="flex items-center justify-center gap-6 text-[10px] text-foreground-muted">
                <div className="flex items-center gap-1.5">
                  <Lock size={10} className="text-[hsl(var(--accent-teal))]" />
                  <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap size={10} className="text-[hsl(var(--accent-teal))]" />
                  <span>14-day guarantee</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check size={10} className="text-[hsl(var(--accent-teal))]" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * CheckoutButton - Convenience component to trigger checkout
 */
export function CheckoutButton({
  plan,
  billing = "monthly",
  children,
  className,
  ...props
}) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setCheckoutOpen(true)}
        className={className}
        {...props}
      >
        {children}
      </Button>
      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        plan={plan}
        billing={billing}
      />
    </>
  );
}

export default CheckoutModal;
