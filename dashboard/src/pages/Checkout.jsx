/**
 * Checkout Page - Standalone checkout for direct links
 * URL: /checkout?plan=pro&billing=monthly
 *
 * Use case: Landing page buttons can link directly to this page
 * If user is not authenticated, they'll be redirected to login first
 */

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
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
  Tag,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getStripe,
  createCheckoutSession,
  PRICE_INFO,
} from "@/lib/stripe";

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
      "30-day signal history",
      "Advanced filters",
      "Basic analytics",
      "Priority support",
      "Custom lot sizing",
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
      "Unlimited Telegram channels",
      "1-year signal history",
      "Full analytics suite",
      "API access",
      "Custom webhooks",
      "Dedicated support",
    ],
  },
};

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, session, isLoading: authLoading, refreshProfile } = useAuth();

  const plan = searchParams.get("plan") || "pro";
  const billing = searchParams.get("billing") || "monthly";

  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkoutComplete, setCheckoutComplete] = useState(false);

  const planInfo = PLAN_INFO[plan];
  const priceInfo = PRICE_INFO[plan]?.[billing];

  // Hide splash on mount
  useEffect(() => {
    window.__hideSplash?.();
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Store intended destination
      sessionStorage.setItem(
        "checkout_redirect",
        `/checkout?plan=${plan}&billing=${billing}`
      );
      navigate("/login");
    }
  }, [authLoading, isAuthenticated, navigate, plan, billing]);

  // Initialize checkout when authenticated
  useEffect(() => {
    if (isAuthenticated && session?.access_token && !clientSecret && !loading) {
      initializeCheckout();
    }
  }, [isAuthenticated, session?.access_token]);

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
    setCheckoutComplete(true);
    // Refresh profile to get updated subscription status
    if (refreshProfile) {
      await refreshProfile();
    }
  }, [refreshProfile]);

  const stripeOptions = clientSecret
    ? {
        clientSecret,
        onComplete: handleComplete,
      }
    : null;

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--accent-teal))]" />
      </div>
    );
  }

  // Not authenticated - will redirect
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-white/[0.06] bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex items-center gap-2 text-foreground-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-sm">Back to Dashboard</span>
            </Link>
            <div className="flex items-center gap-1.5">
              <Lock size={14} className="text-[hsl(var(--accent-teal))]" />
              <span className="text-xs text-foreground-muted">
                Secure Checkout
              </span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column - Plan Details */}
          <div className="order-2 lg:order-1">
            <div className="sticky top-8">
              {/* Plan Header */}
              <div className="flex items-center gap-4 mb-6">
                {planInfo && (
                  <div
                    className={cn(
                      "p-3 rounded-none",
                      plan === "pro" && "bg-[hsl(var(--accent-teal))]/10",
                      plan === "premium" && "bg-[hsl(var(--accent-gold))]/10"
                    )}
                  >
                    {planInfo.icon && (
                      <planInfo.icon
                        size={28}
                        className={cn(
                          plan === "pro" && "text-[hsl(var(--accent-teal))]",
                          plan === "premium" && "text-[hsl(var(--accent-gold))]"
                        )}
                      />
                    )}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {planInfo?.name} Plan
                  </h1>
                  <p className="text-foreground-muted">{planInfo?.tagline}</p>
                </div>
              </div>

              {/* Price */}
              {priceInfo && (
                <div className="mb-8 p-6 rounded-none border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold text-foreground">
                      {priceInfo.currency}
                      {priceInfo.amount}
                    </span>
                    <span className="text-foreground-muted">
                      /{priceInfo.interval}
                    </span>
                  </div>
                  {billing === "annual" && priceInfo.perMonth && (
                    <p className="text-sm text-[hsl(var(--accent-teal))]">
                      {priceInfo.currency}
                      {priceInfo.perMonth.toFixed(2)}/month when billed annually
                    </p>
                  )}

                  {/* Billing toggle hint */}
                  {billing === "monthly" && (
                    <button
                      onClick={() =>
                        navigate(`/checkout?plan=${plan}&billing=annual`)
                      }
                      className="mt-3 text-xs text-[hsl(var(--accent-teal))] hover:underline flex items-center gap-1"
                    >
                      <Tag size={12} />
                      Save with annual billing
                      <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              )}

              {/* Features */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground-muted uppercase tracking-wider">
                  What's included
                </h3>
                <ul className="space-y-3">
                  {planInfo?.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0",
                          plan === "pro" && "bg-[hsl(var(--accent-teal))]/10",
                          plan === "premium" && "bg-[hsl(var(--accent-gold))]/10"
                        )}
                      >
                        <Check
                          size={12}
                          className={cn(
                            plan === "pro" && "text-[hsl(var(--accent-teal))]",
                            plan === "premium" &&
                              "text-[hsl(var(--accent-gold))]"
                          )}
                        />
                      </div>
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Trust signals */}
              <div className="mt-8 pt-6 border-t border-white/[0.06]">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <Lock
                      size={18}
                      className="mx-auto mb-2 text-foreground-muted"
                    />
                    <p className="text-xs text-foreground-muted">
                      Secure
                      <br />
                      Payment
                    </p>
                  </div>
                  <div>
                    <Zap
                      size={18}
                      className="mx-auto mb-2 text-foreground-muted"
                    />
                    <p className="text-xs text-foreground-muted">
                      14-Day
                      <br />
                      Guarantee
                    </p>
                  </div>
                  <div>
                    <Check
                      size={18}
                      className="mx-auto mb-2 text-foreground-muted"
                    />
                    <p className="text-xs text-foreground-muted">
                      Cancel
                      <br />
                      Anytime
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Checkout */}
          <div className="order-1 lg:order-2">
            <div className="rounded-none border border-white/[0.06] bg-white/[0.01] overflow-hidden">
              {/* Loading State */}
              {loading && (
                <div className="flex flex-col items-center justify-center py-24 px-6">
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
                <div className="flex flex-col items-center justify-center py-24 px-6">
                  <div className="p-3 rounded-full bg-destructive/10 mb-4">
                    <AlertCircle size={24} className="text-destructive" />
                  </div>
                  <p className="text-sm text-foreground mb-4 text-center">
                    {error}
                  </p>
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
                  className="flex flex-col items-center justify-center py-24 px-6"
                >
                  <div className="p-4 rounded-full bg-[hsl(var(--accent-teal))]/10 mb-4">
                    <Check
                      size={40}
                      className="text-[hsl(var(--accent-teal))]"
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Welcome to {planInfo?.name}!
                  </h3>
                  <p className="text-sm text-foreground-muted text-center mb-6">
                    Your subscription is now active.
                    <br />
                    Enjoy unlimited trading signals!
                  </p>
                  <Button asChild>
                    <Link to="/" className="gap-2">
                      Go to Dashboard
                      <ChevronRight size={16} />
                    </Link>
                  </Button>
                </motion.div>
              )}

              {/* Stripe Embedded Checkout */}
              {clientSecret && !checkoutComplete && (
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-6">
                    Payment Details
                  </h2>
                  <EmbeddedCheckoutProvider
                    stripe={getStripe()}
                    options={stripeOptions}
                  >
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stripe badge */}
      <div className="fixed bottom-4 right-4">
        <div className="flex items-center gap-2 text-xs text-foreground-muted bg-background/80 backdrop-blur px-3 py-2 rounded-none border border-white/[0.06]">
          <Lock size={12} />
          Powered by Stripe
        </div>
      </div>
    </div>
  );
}
