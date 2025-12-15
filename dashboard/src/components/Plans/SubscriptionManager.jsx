/**
 * SubscriptionManager - Display and manage current subscription
 * Provides access to Stripe Customer Portal for subscription management
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Shield,
  Crown,
  User,
  ExternalLink,
  Calendar,
  CreditCard,
  Settings,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { createPortalSession } from "@/lib/stripe";

// Plan icons mapping
const PLAN_ICONS = {
  free: User,
  pro: Shield,
  premium: Crown,
};

const PLAN_COLORS = {
  free: "text-foreground-muted",
  pro: "text-[hsl(var(--accent-teal))]",
  premium: "text-[hsl(var(--accent-gold))]",
};

const PLAN_BG_COLORS = {
  free: "bg-white/[0.04]",
  pro: "bg-[hsl(var(--accent-teal))]/10",
  premium: "bg-[hsl(var(--accent-gold))]/10",
};

export function SubscriptionManager({ className }) {
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const tier = profile?.subscription_tier?.toLowerCase() || "free";
  const status = profile?.subscription_status || "active";
  const expiresAt = profile?.subscription_expires_at;
  const hasStripeCustomer = !!profile?.stripe_customer_id;

  const Icon = PLAN_ICONS[tier] || User;
  const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);

  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  const handleManageSubscription = async () => {
    if (!hasStripeCustomer) {
      setError("No active subscription found");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { url } = await createPortalSession(
        window.location.href,
        session.access_token
      );
      window.location.href = url;
    } catch (err) {
      console.error("Portal error:", err);
      setError(err.message || "Failed to open subscription manager");
      setLoading(false);
    }
  };

  return (
    <div className={cn("rounded-none border border-white/[0.06] bg-white/[0.02]", className)}>
      {/* Header */}
      <div className="p-6 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-none", PLAN_BG_COLORS[tier])}>
              <Icon size={20} className={PLAN_COLORS[tier]} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {tierName} Plan
                </h3>
                {status === "active" && tier !== "free" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-none bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] font-medium">
                    Active
                  </span>
                )}
                {status === "past_due" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-none bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] font-medium flex items-center gap-1">
                    <AlertTriangle size={10} />
                    Past Due
                  </span>
                )}
                {status === "canceled" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-none bg-destructive/10 text-destructive font-medium">
                    Canceled
                  </span>
                )}
              </div>
              {tier === "free" ? (
                <p className="text-xs text-foreground-muted">
                  Free forever · No credit card required
                </p>
              ) : (
                <p className="text-xs text-foreground-muted">
                  {status === "active" ? "Auto-renews" : "Ends"}{" "}
                  {formatDate(expiresAt) || "—"}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      {tier !== "free" && (
        <div className="p-6 space-y-4">
          {/* Billing Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-foreground-muted" />
              <div>
                <p className="text-xs text-foreground-muted">Next Billing</p>
                <p className="text-sm text-foreground">
                  {formatDate(expiresAt) || "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard size={16} className="text-foreground-muted" />
              <div>
                <p className="text-xs text-foreground-muted">Payment Method</p>
                <p className="text-sm text-foreground">
                  {hasStripeCustomer ? "Card on file" : "Not set up"}
                </p>
              </div>
            </div>
          </div>

          {/* Past Due Warning */}
          {status === "past_due" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-none bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-[hsl(var(--warning))] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Payment Failed
                  </p>
                  <p className="text-xs text-foreground-muted mt-1">
                    Please update your payment method to keep your subscription active.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-none bg-destructive/10 border border-destructive/20"
            >
              <p className="text-xs text-destructive">{error}</p>
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleManageSubscription}
              disabled={loading || !hasStripeCustomer}
              className="flex-1 gap-2"
              variant="outline"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Settings size={16} />
              )}
              Manage Subscription
              <ExternalLink size={12} className="opacity-50" />
            </Button>
          </div>

          <p className="text-[10px] text-foreground-muted text-center">
            Update payment method, view invoices, or cancel subscription
          </p>
        </div>
      )}

      {/* Free Tier CTA */}
      {tier === "free" && (
        <div className="p-6">
          <p className="text-sm text-foreground-muted mb-4">
            Upgrade to unlock unlimited signals, more accounts, and premium features.
          </p>
          <Button
            asChild
            className="w-full bg-[hsl(var(--accent-teal))] hover:bg-[hsl(var(--accent-teal))]/90 text-background"
          >
            <a href="#pricing">
              View Plans
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * SubscriptionBadge - Compact subscription indicator
 */
export function SubscriptionBadge({ className }) {
  const { profile } = useAuth();
  const tier = profile?.subscription_tier?.toLowerCase() || "free";
  const Icon = PLAN_ICONS[tier] || User;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-none",
        PLAN_BG_COLORS[tier],
        className
      )}
    >
      <Icon size={14} className={PLAN_COLORS[tier]} />
      <span className={cn("text-xs font-medium", PLAN_COLORS[tier])}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    </div>
  );
}

export default SubscriptionManager;
