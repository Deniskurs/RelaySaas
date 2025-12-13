import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Check,
  Sparkles,
  Shield,
  Crown,
  ChevronRight,
  Zap,
  Infinity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { CheckoutModal } from "./CheckoutModal";

// Plan definitions with all features (prices in GBP to match Stripe)
export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Get started with signal copying",
    monthlyPrice: 0,
    annualPrice: 0,
    currency: "£",
    icon: Sparkles,
    popular: false,
    features: [
      { text: "5 signals per day", highlight: false },
      { text: "1 MT5 account", highlight: false },
      { text: "2 Telegram channels", highlight: false },
      { text: "7-day signal history", highlight: false },
      { text: "Basic risk management", highlight: false },
      { text: "Email support", highlight: false },
    ],
    cta: "Start Free",
    ctaVariant: "outline",
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For serious traders who want more",
    monthlyPrice: 22.99,
    annualPrice: 15.00, // £179.99/year = £15/mo
    annualTotal: 179.99,
    currency: "£",
    icon: Shield,
    popular: true,
    badge: "Most Popular",
    features: [
      { text: "Unlimited signals", highlight: true },
      { text: "3 MT5 accounts", highlight: true },
      { text: "5 Telegram channels", highlight: true },
      { text: "30-day signal history", highlight: false },
      { text: "Advanced filters", highlight: true },
      { text: "Basic analytics", highlight: true },
      { text: "Priority support", highlight: false },
      { text: "Custom lot sizing", highlight: false },
    ],
    cta: "Upgrade to Pro",
    ctaVariant: "default",
  },
  premium: {
    id: "premium",
    name: "Premium",
    tagline: "Maximum power for professionals",
    monthlyPrice: 62.99,
    annualPrice: 41.67, // £499.99/year = ~£41.67/mo
    annualTotal: 499.99,
    currency: "£",
    icon: Crown,
    popular: false,
    badge: "Best Value",
    features: [
      { text: "Everything in Pro", highlight: false },
      { text: "10 MT5 accounts", highlight: true },
      { text: "Unlimited channels", highlight: true },
      { text: "1-year signal history", highlight: true },
      { text: "Full analytics suite", highlight: true },
      { text: "API access", highlight: true },
      { text: "Custom webhooks", highlight: true },
      { text: "Dedicated support", highlight: false },
      { text: "White-label options", highlight: false },
    ],
    cta: "Go Premium",
    ctaVariant: "default",
  },
};

// Billing toggle component
export function BillingToggle({ isAnnual, onChange, className }) {
  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      <span className={cn(
        "text-sm transition-colors",
        !isAnnual ? "text-foreground" : "text-foreground-muted"
      )}>
        Monthly
      </span>

      <button
        onClick={() => onChange(!isAnnual)}
        className={cn(
          "relative w-14 h-7 rounded-full transition-colors",
          isAnnual
            ? "bg-[hsl(var(--accent-teal))]"
            : "bg-white/[0.1]"
        )}
      >
        <motion.div
          className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm"
          animate={{ left: isAnnual ? 32 : 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>

      <div className="flex items-center gap-2">
        <span className={cn(
          "text-sm transition-colors",
          isAnnual ? "text-foreground" : "text-foreground-muted"
        )}>
          Annual
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-none bg-[hsl(var(--accent-teal))]/10 text-[hsl(var(--accent-teal))] font-medium">
          Save 33%
        </span>
      </div>
    </div>
  );
}

// Single pricing card
function PricingCard({
  plan,
  isAnnual,
  isCurrent,
  onSelect,
  className,
}) {
  const Icon = plan.icon;
  const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
  const isPro = plan.id === "pro";
  const isPremium = plan.id === "premium";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative rounded-none border p-6 transition-all duration-300",
        // Base styling
        "bg-white/[0.02]",
        // Pro card - emphasized
        isPro && [
          "border-[hsl(var(--accent-teal))]/40",
          "bg-gradient-to-b from-[hsl(var(--accent-teal))]/5 to-transparent",
          "shadow-lg shadow-[hsl(var(--accent-teal))]/5",
          "scale-[1.02] z-10",
        ],
        // Premium card - gold accent
        isPremium && [
          "border-[hsl(var(--accent-gold))]/30",
          "bg-gradient-to-b from-[hsl(var(--accent-gold))]/5 to-transparent",
        ],
        // Free card - subtle
        !isPro && !isPremium && "border-white/[0.08]",
        // Current plan indicator
        isCurrent && "ring-1 ring-[hsl(var(--accent-teal))]",
        className
      )}
    >
      {/* Badge */}
      {plan.badge && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={cn(
            "px-3 py-1 rounded-none text-[10px] font-semibold",
            isPro
              ? "bg-[hsl(var(--accent-teal))] text-background"
              : "bg-[hsl(var(--accent-gold))] text-background"
          )}>
            {plan.badge}
          </span>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-none text-[10px] font-semibold bg-white/[0.1] text-foreground border border-white/[0.1]">
            Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pt-2">
        <div className={cn(
          "p-2.5 rounded-none",
          isPro && "bg-[hsl(var(--accent-teal))]/10",
          isPremium && "bg-[hsl(var(--accent-gold))]/10",
          !isPro && !isPremium && "bg-white/[0.04]"
        )}>
          <Icon
            size={20}
            className={cn(
              isPro && "text-[hsl(var(--accent-teal))]",
              isPremium && "text-[hsl(var(--accent-gold))]",
              !isPro && !isPremium && "text-foreground-muted"
            )}
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
          <p className="text-xs text-foreground-muted">{plan.tagline}</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">{plan.currency || "£"}{price}</span>
          <span className="text-sm text-foreground-muted">/mo</span>
        </div>
        {isAnnual && price > 0 && plan.annualTotal && (
          <p className="text-xs text-foreground-muted mt-1">
            Billed annually ({plan.currency || "£"}{plan.annualTotal}/year)
          </p>
        )}
        {!isAnnual && plan.monthlyPrice > 0 && (
          <p className="text-xs text-[hsl(var(--accent-teal))] mt-1">
            Save {plan.currency || "£"}{((plan.monthlyPrice - plan.annualPrice) * 12).toFixed(0)}/year with annual
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <div className={cn(
              "w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0",
              feature.highlight
                ? "bg-[hsl(var(--accent-teal))]/10"
                : "bg-white/[0.04]"
            )}>
              {feature.text.includes("Unlimited") || feature.text.includes("unlimited") ? (
                <Infinity size={8} className="text-[hsl(var(--accent-teal))]" />
              ) : (
                <Check
                  size={10}
                  className={cn(
                    feature.highlight
                      ? "text-[hsl(var(--accent-teal))]"
                      : "text-foreground-muted"
                  )}
                />
              )}
            </div>
            <span className={cn(
              "text-sm",
              feature.highlight ? "text-foreground" : "text-foreground-muted"
            )}>
              {feature.text}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Button
        onClick={() => !isCurrent && onSelect?.(plan.id)}
        disabled={isCurrent}
        className={cn(
          "w-full h-11 font-medium",
          isCurrent && "opacity-50 cursor-not-allowed",
          isPro && !isCurrent && "bg-[hsl(var(--accent-teal))] hover:bg-[hsl(var(--accent-teal))]/90 text-background",
          isPremium && !isCurrent && "bg-[hsl(var(--accent-gold))] hover:bg-[hsl(var(--accent-gold))]/90 text-background",
          plan.ctaVariant === "outline" && !isCurrent && "bg-transparent border border-white/[0.1] text-foreground hover:bg-white/[0.04]"
        )}
      >
        {isCurrent ? "Current Plan" : plan.cta}
        {!isCurrent && <ChevronRight size={16} className="ml-1" />}
      </Button>
    </motion.div>
  );
}

// Main pricing cards grid
export function PricingCards({
  onSelectPlan,
  showBillingToggle = true,
  className,
}) {
  const { profile } = useAuth();
  const [isAnnual, setIsAnnual] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);

  const currentTier = profile?.subscription_tier?.toLowerCase() || "free";

  const handleSelectPlan = (planId) => {
    // Free plan doesn't need checkout
    if (planId === "free") {
      onSelectPlan?.(planId);
      return;
    }

    // Open checkout modal for paid plans
    setSelectedPlan(planId);
    setCheckoutOpen(true);
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Billing toggle */}
      {showBillingToggle && (
        <BillingToggle
          isAnnual={isAnnual}
          onChange={setIsAnnual}
          className="mb-8"
        />
      )}

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {Object.values(PLANS).map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
          >
            <PricingCard
              plan={plan}
              isAnnual={isAnnual}
              isCurrent={currentTier === plan.id}
              onSelect={handleSelectPlan}
            />
          </motion.div>
        ))}
      </div>

      {/* Trust signals */}
      <div className="mt-8 flex items-center justify-center gap-6 text-xs text-foreground-muted">
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-[hsl(var(--accent-teal))]" />
          <span>14-day money-back guarantee</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield size={12} className="text-[hsl(var(--accent-teal))]" />
          <span>Secure payment via Stripe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check size={12} className="text-[hsl(var(--accent-teal))]" />
          <span>Cancel anytime</span>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        plan={selectedPlan}
        billing={isAnnual ? "annual" : "monthly"}
      />
    </div>
  );
}

// Compact pricing cards (for modals/sheets)
export function PricingCardsCompact({
  onSelectPlan,
  className,
}) {
  const { profile } = useAuth();
  const currentTier = profile?.subscription_tier?.toLowerCase() || "free";

  return (
    <div className={cn("space-y-3", className)}>
      {Object.values(PLANS).map((plan) => {
        const Icon = plan.icon;
        const isCurrent = currentTier === plan.id;
        const isPro = plan.id === "pro";
        const isPremium = plan.id === "premium";

        return (
          <button
            key={plan.id}
            onClick={() => !isCurrent && onSelectPlan?.(plan.id)}
            disabled={isCurrent}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-none border transition-all",
              "text-left",
              isPro && "border-[hsl(var(--accent-teal))]/30 bg-[hsl(var(--accent-teal))]/5",
              isPremium && "border-[hsl(var(--accent-gold))]/20 bg-[hsl(var(--accent-gold))]/5",
              !isPro && !isPremium && "border-white/[0.06] bg-white/[0.02]",
              !isCurrent && "hover:border-white/[0.15] hover:bg-white/[0.04]",
              isCurrent && "ring-1 ring-[hsl(var(--accent-teal))] cursor-default"
            )}
          >
            <div className={cn(
              "p-2 rounded-none shrink-0",
              isPro && "bg-[hsl(var(--accent-teal))]/10",
              isPremium && "bg-[hsl(var(--accent-gold))]/10",
              !isPro && !isPremium && "bg-white/[0.04]"
            )}>
              <Icon
                size={16}
                className={cn(
                  isPro && "text-[hsl(var(--accent-teal))]",
                  isPremium && "text-[hsl(var(--accent-gold))]",
                  !isPro && !isPremium && "text-foreground-muted"
                )}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{plan.name}</span>
                {plan.badge && !isCurrent && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-none bg-[hsl(var(--accent-teal))]/10 text-[hsl(var(--accent-teal))]">
                    {plan.badge}
                  </span>
                )}
                {isCurrent && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-none bg-white/[0.1] text-foreground-muted">
                    Current
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground-muted truncate">{plan.tagline}</p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-lg font-semibold text-foreground">{plan.currency || "£"}{plan.monthlyPrice}</span>
              <span className="text-xs text-foreground-muted">/mo</span>
            </div>

            {!isCurrent && (
              <ChevronRight size={16} className="text-foreground-muted shrink-0" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Export plans data
export { PLANS as PRICING_PLANS };
