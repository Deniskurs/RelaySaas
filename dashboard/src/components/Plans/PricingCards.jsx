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
    annualPrice: 15.0, // £179.99/year = £15/mo
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
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div
        className="relative inline-flex items-center p-1 rounded-full bg-black/40 border border-white/[0.08] backdrop-blur-xl cursor-pointer select-none"
        onClick={() => onChange(!isAnnual)}
      >
        {/* Sliding background */}
        <motion.div
          className="absolute inset-y-1 w-1/2 rounded-full bg-[hsl(var(--accent-teal))]/10 border border-[hsl(var(--accent-teal))]/20 shadow-[0_0_15px_-3px_hsl(var(--accent-teal))/20]"
          animate={{ x: isAnnual ? "100%" : "0%" }}
          initial={false}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />

        {/* Monthly Option */}
        <div
          className={cn(
            "relative z-10 px-6 py-2 rounded-full transition-colors duration-200 text-sm font-medium",
            !isAnnual
              ? "text-foreground"
              : "text-foreground-muted hover:text-foreground-muted/80"
          )}
        >
          Monthly
        </div>

        {/* Annual Option */}
        <div
          className={cn(
            "relative z-10 px-6 py-2 rounded-full transition-colors duration-200 text-sm font-medium flex items-center gap-2",
            isAnnual
              ? "text-foreground"
              : "text-foreground-muted hover:text-foreground-muted/80"
          )}
        >
          Annual
          {/* Badge */}
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[hsl(var(--accent-teal))] text-black tracking-wide">
            -33%
          </span>
        </div>
      </div>

      {/* Helper text */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs text-foreground-muted font-medium"
      >
        Save up to <span className="text-[hsl(var(--accent-teal))]">33%</span>{" "}
        with annual billing
      </motion.p>
    </div>
  );
}

// Single pricing card
function PricingCard({ plan, isAnnual, isCurrent, onSelect, className }) {
  const Icon = plan.icon;
  const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
  const isPro = plan.id === "pro";
  const isPremium = plan.id === "premium";
  const isFree = plan.id === "free";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "relative flex flex-col p-8 transition-all duration-300 rounded-2xl overflow-hidden h-full",
        // Base Glass styling
        "bg-white/[0.03] backdrop-blur-xl border border-white/[0.06]",

        // Hover effects
        "hover:bg-white/[0.05] hover:border-white/[0.1]",
        "hover:shadow-[0_0_40px_-10px_rgba(255,255,255,0.05)]",

        // Pro card - subtle teal glow
        isPro && [
          "border-[hsl(var(--accent-teal))]/30",
          "bg-gradient-to-b from-[hsl(var(--accent-teal))]/10 to-transparent",
          "shadow-[0_0_40px_-15px_hsl(var(--accent-teal))/20]",
          "hover:shadow-[0_0_60px_-15px_hsl(var(--accent-teal))/30]",
        ],
        // Premium card - gold accent
        isPremium && [
          "border-[hsl(var(--accent-gold))]/30",
          "bg-gradient-to-b from-[hsl(var(--accent-gold))]/10 to-transparent",
          "shadow-[0_0_40px_-15px_hsl(var(--accent-gold))/20]",
          "hover:shadow-[0_0_60px_-15px_hsl(var(--accent-gold))/30]",
        ],
        // Current plan indicator
        isCurrent && "ring-1 ring-[hsl(var(--accent-teal))]",
        className
      )}
    >
      {/* Background ambient glow/noise for premium feel */}
      <div className="absolute inset-0 bg-noise opacity-[0.03] pointer-events-none" />

      {/* Highlight glow at top */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50",
          isPro && "via-[hsl(var(--accent-teal))]/50",
          isPremium && "via-[hsl(var(--accent-gold))]/50"
        )}
      />

      {/* Badge */}
      {plan.badge && !isCurrent && (
        <div className="absolute top-0 right-0">
          <div
            className={cn(
              "px-4 py-1 rounded-bl-xl text-xs font-bold tracking-wide uppercase",
              isPro
                ? "bg-[hsl(var(--accent-teal))] text-background"
                : "bg-[hsl(var(--accent-gold))] text-background"
            )}
          >
            {plan.badge}
          </div>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrent && (
        <div className="absolute top-4 right-4">
          <span className="px-3 py-1 rounded-full text-[10px] font-semibold bg-white/[0.1] text-foreground border border-white/[0.1]">
            Current Plan
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-6 mb-8 relative z-10">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300",
            isPro &&
              "bg-[hsl(var(--accent-teal))]/10 text-[hsl(var(--accent-teal))]",
            isPremium &&
              "bg-[hsl(var(--accent-gold))]/10 text-[hsl(var(--accent-gold))]",
            isFree && "bg-white/[0.06] text-foreground-muted"
          )}
        >
          <Icon size={24} strokeWidth={1.5} />
        </div>

        <div>
          <h3 className="text-xl font-bold text-foreground mb-1 tracking-tight">
            {plan.name}
          </h3>
          <p className="text-sm text-foreground-muted/80 font-medium">
            {plan.tagline}
          </p>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-bold tracking-tighter text-foreground">
            {plan.currency || "£"}
            {price}
          </span>
          <span className="text-base text-foreground-muted/60 font-medium">
            /mo
          </span>
        </div>

        {isAnnual && price > 0 && plan.annualTotal && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 w-fit">
            <span className="text-xs font-semibold text-green-400">
              Billed {plan.currency || "£"}
              {plan.annualTotal} yearly
            </span>
          </div>
        )}
        {!isAnnual && plan.monthlyPrice > 0 && (
          <p className="text-xs text-[hsl(var(--accent-teal))] font-medium">
            Save {plan.currency || "£"}
            {((plan.monthlyPrice - plan.annualPrice) * 12).toFixed(0)}/year with
            annual
          </p>
        )}
      </div>

      {/* Features */}
      <div className="flex-grow mb-8 relative z-10">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mb-6" />
        <ul className="space-y-4">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3 group/item">
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center mt-0.5 shrink-0 transition-colors",
                  feature.highlight || isPro || isPremium
                    ? "bg-[hsl(var(--accent-teal))]/20 text-[hsl(var(--accent-teal))]"
                    : "bg-white/[0.06] text-foreground-muted group-hover/item:text-foreground",
                  isPremium &&
                    "bg-[hsl(var(--accent-gold))]/20 text-[hsl(var(--accent-gold))]"
                )}
              >
                {feature.text.toLowerCase().includes("unlimited") ? (
                  <Infinity size={10} strokeWidth={2.5} />
                ) : (
                  <Check size={10} strokeWidth={3} />
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium transition-colors",
                  feature.highlight
                    ? "text-foreground"
                    : "text-foreground-muted group-hover/item:text-foreground"
                )}
              >
                {feature.text}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="relative z-10 mt-auto">
        <Button
          onClick={() => !isCurrent && onSelect?.(plan.id)}
          disabled={isCurrent}
          className={cn(
            "w-full h-12 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300",
            isCurrent && "opacity-50 cursor-not-allowed",

            // Pro Button
            isPro &&
              !isCurrent && [
                "bg-[hsl(var(--accent-teal))] hover:bg-[hsl(var(--accent-teal))]/90 text-white",
                "shadow-[0_0_20px_-5px_hsl(var(--accent-teal))/40]",
                "hover:shadow-[0_0_30px_-5px_hsl(var(--accent-teal))/60] hover:scale-[1.02]",
              ],

            // Premium Button
            isPremium &&
              !isCurrent && [
                "bg-[hsl(var(--accent-gold))] hover:bg-[hsl(var(--accent-gold))]/90 text-black",
                "shadow-[0_0_20px_-5px_hsl(var(--accent-gold))/40]",
                "hover:shadow-[0_0_30px_-5px_hsl(var(--accent-gold))/60] hover:scale-[1.02]",
              ],

            // Free Button
            isFree &&
              !isCurrent &&
              "bg-white/[0.08] text-foreground hover:bg-white/[0.15] border border-white/[0.05]"
          )}
        >
          {isCurrent ? "Current Plan" : plan.cta}
          {!isCurrent && <ChevronRight size={16} className="ml-1 opacity-70" />}
        </Button>
      </div>
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
export function PricingCardsCompact({ onSelectPlan, className }) {
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
              isPro &&
                "border-[hsl(var(--accent-teal))]/30 bg-[hsl(var(--accent-teal))]/5",
              isPremium &&
                "border-[hsl(var(--accent-gold))]/20 bg-[hsl(var(--accent-gold))]/5",
              !isPro && !isPremium && "border-white/[0.06] bg-white/[0.02]",
              !isCurrent && "hover:border-white/[0.15] hover:bg-white/[0.04]",
              isCurrent &&
                "ring-1 ring-[hsl(var(--accent-teal))] cursor-default"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-none shrink-0",
                isPro && "bg-[hsl(var(--accent-teal))]/10",
                isPremium && "bg-[hsl(var(--accent-gold))]/10",
                !isPro && !isPremium && "bg-white/[0.04]"
              )}
            >
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
              <p className="text-xs text-foreground-muted truncate">
                {plan.tagline}
              </p>
            </div>

            <div className="text-right shrink-0">
              <span className="text-lg font-semibold text-foreground">
                {plan.currency || "£"}
                {plan.monthlyPrice}
              </span>
              <span className="text-xs text-foreground-muted">/mo</span>
            </div>

            {!isCurrent && (
              <ChevronRight
                size={16}
                className="text-foreground-muted shrink-0"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Export plans data
export { PLANS as PRICING_PLANS };
