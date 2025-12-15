import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Check,
  User,
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
    icon: User,
    popular: false,
    features: [
      { text: "5 signals per month", highlight: false },
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

// Billing toggle component with proper animations
export function BillingToggle({ isAnnual, onChange, className }) {
  const containerRef = useRef(null);
  const monthlyRef = useRef(null);
  const annualRef = useRef(null);
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });

  // Measure button positions and update slider
  useEffect(() => {
    const updateSlider = () => {
      const container = containerRef.current;
      const activeRef = isAnnual ? annualRef.current : monthlyRef.current;

      if (container && activeRef) {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeRef.getBoundingClientRect();

        setSliderStyle({
          left: activeRect.left - containerRect.left,
          width: activeRect.width,
        });
      }
    };

    updateSlider();
    window.addEventListener("resize", updateSlider);
    return () => window.removeEventListener("resize", updateSlider);
  }, [isAnnual]);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        ref={containerRef}
        className="relative inline-flex items-center p-1 bg-white/[0.03] border border-white/[0.06]"
      >
        {/* Animated sliding background */}
        <motion.div
          className={cn(
            "absolute top-1 bottom-1 z-0",
            isAnnual
              ? "bg-[hsl(var(--accent-teal))]/10 border border-[hsl(var(--accent-teal))]/25 shadow-[0_0_20px_-5px_hsl(var(--accent-teal))/20]"
              : "bg-white/[0.06] border border-white/[0.08]"
          )}
          initial={false}
          animate={{
            left: sliderStyle.left,
            width: sliderStyle.width,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
        />

        {/* Monthly Option */}
        <button
          ref={monthlyRef}
          onClick={() => onChange(false)}
          className={cn(
            "relative z-10 px-5 py-2 text-sm font-medium transition-colors duration-200",
            !isAnnual ? "text-foreground" : "text-foreground-muted/50 hover:text-foreground-muted/70"
          )}
        >
          Monthly
        </button>

        {/* Annual Option */}
        <button
          ref={annualRef}
          onClick={() => onChange(true)}
          className={cn(
            "relative z-10 px-5 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-2",
            isAnnual ? "text-foreground" : "text-foreground-muted/50 hover:text-foreground-muted/70"
          )}
        >
          Annual
          <span className={cn(
            "text-[9px] uppercase font-bold px-1.5 py-0.5 tracking-wide transition-colors duration-200",
            isAnnual
              ? "bg-[hsl(var(--accent-teal))] text-black"
              : "bg-white/[0.06] text-foreground-muted/50"
          )}>
            -33%
          </span>
        </button>
      </div>

      {/* Helper text */}
      <p className="text-[11px] text-foreground-muted/50">
        Save up to <span className="text-[hsl(var(--accent-teal))]">33%</span> with annual billing
      </p>
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
      whileHover={{ y: -4 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative flex flex-col p-6 lg:p-8 transition-all duration-300 overflow-hidden h-full group",
        // Base styling - square corners for brand consistency
        "bg-white/[0.02] border border-white/[0.06]",

        // Hover effects
        "hover:bg-white/[0.04] hover:border-white/[0.1]",

        // Pro card - teal accent
        isPro && [
          "border-[hsl(var(--accent-teal))]/25",
          "bg-gradient-to-b from-[hsl(var(--accent-teal))]/[0.06] to-transparent",
          "shadow-[0_0_60px_-20px_hsl(var(--accent-teal))/15]",
          "hover:shadow-[0_0_80px_-20px_hsl(var(--accent-teal))/25]",
          "hover:border-[hsl(var(--accent-teal))]/40",
        ],
        // Premium card - gold accent
        isPremium && [
          "border-[hsl(var(--accent-gold))]/25",
          "bg-gradient-to-b from-[hsl(var(--accent-gold))]/[0.06] to-transparent",
          "shadow-[0_0_60px_-20px_hsl(var(--accent-gold))/15]",
          "hover:shadow-[0_0_80px_-20px_hsl(var(--accent-gold))/25]",
          "hover:border-[hsl(var(--accent-gold))]/40",
        ],
        // Current plan indicator
        isCurrent && "ring-1 ring-[hsl(var(--accent-teal))]/50",
        className
      )}
    >
      {/* Subtle top highlight line */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent",
          isPro && "via-[hsl(var(--accent-teal))]/40",
          isPremium && "via-[hsl(var(--accent-gold))]/40"
        )}
      />

      {/* Badge - positioned at top right corner */}
      {plan.badge && !isCurrent && (
        <div className="absolute -top-px -right-px">
          <div
            className={cn(
              "px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase",
              isPro
                ? "bg-[hsl(var(--accent-teal))] text-black"
                : "bg-[hsl(var(--accent-gold))] text-black"
            )}
          >
            {plan.badge}
          </div>
        </div>
      )}

      {/* Current plan badge */}
      {isCurrent && (
        <div className="absolute top-4 right-4">
          <span className="px-2.5 py-1 text-[10px] font-semibold bg-white/[0.08] text-foreground-muted border border-white/[0.08]">
            Current
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 mb-6 relative z-10">
        {/* Icon */}
        <div
          className={cn(
            "w-10 h-10 flex items-center justify-center transition-all duration-300",
            isPro && "bg-[hsl(var(--accent-teal))]/10 text-[hsl(var(--accent-teal))]",
            isPremium && "bg-[hsl(var(--accent-gold))]/10 text-[hsl(var(--accent-gold))]",
            isFree && "bg-white/[0.05] text-foreground-muted"
          )}
        >
          <Icon size={20} strokeWidth={1.5} />
        </div>

        {/* Plan name & tagline */}
        <div>
          <h3 className={cn(
            "text-lg font-semibold tracking-tight mb-0.5",
            isPro && "text-[hsl(var(--accent-teal))]",
            isPremium && "text-[hsl(var(--accent-gold))]",
            isFree && "text-foreground"
          )}>
            {plan.name}
          </h3>
          <p className="text-sm text-foreground-muted/70">
            {plan.tagline}
          </p>
        </div>

        {/* Price - dramatic monospace typography */}
        <div className="pt-2">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-medium text-foreground-muted/60 -mr-0.5">
              {plan.currency || "£"}
            </span>
            <span className="text-5xl font-mono font-bold tracking-tight text-foreground">
              {price}
            </span>
            <span className="text-sm text-foreground-muted/50 font-medium ml-1">
              /mo
            </span>
          </div>

          {/* Annual billing info */}
          {isAnnual && price > 0 && plan.annualTotal && (
            <p className="text-xs text-foreground-muted/60 mt-2 font-medium">
              Billed {plan.currency || "£"}{plan.annualTotal}/year
            </p>
          )}
          {!isAnnual && plan.monthlyPrice > 0 && (
            <p className="text-xs text-[hsl(var(--accent-teal))]/80 mt-2 font-medium">
              Save {plan.currency || "£"}{((plan.monthlyPrice - plan.annualPrice) * 12).toFixed(0)}/yr with annual
            </p>
          )}
          {isFree && (
            <p className="text-xs text-foreground-muted/50 mt-2">
              No credit card required
            </p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className={cn(
        "h-px w-full mb-6",
        isPro ? "bg-[hsl(var(--accent-teal))]/15" :
        isPremium ? "bg-[hsl(var(--accent-gold))]/15" :
        "bg-white/[0.06]"
      )} />

      {/* Features */}
      <div className="flex-grow mb-6 relative z-10">
        <ul className="space-y-3">
          {plan.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5 group/item">
              <div
                className={cn(
                  "w-4 h-4 flex items-center justify-center mt-0.5 shrink-0",
                  isPro && "text-[hsl(var(--accent-teal))]",
                  isPremium && "text-[hsl(var(--accent-gold))]",
                  isFree && (feature.highlight ? "text-foreground" : "text-foreground-muted/50")
                )}
              >
                {feature.text.toLowerCase().includes("unlimited") ? (
                  <Infinity size={12} strokeWidth={2} />
                ) : (
                  <Check size={12} strokeWidth={2.5} />
                )}
              </div>
              <span
                className={cn(
                  "text-sm leading-tight",
                  feature.highlight ? "text-foreground" : "text-foreground-muted/80"
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
            "w-full h-11 text-sm font-semibold tracking-wide transition-all duration-200",
            isCurrent && "opacity-40 cursor-not-allowed",

            // Pro Button - solid teal
            isPro && !isCurrent && [
              "bg-[hsl(var(--accent-teal))] hover:bg-[hsl(var(--accent-teal))]/90 text-black",
              "shadow-[0_4px_20px_-4px_hsl(var(--accent-teal))/30]",
              "hover:shadow-[0_4px_25px_-4px_hsl(var(--accent-teal))/50]",
            ],

            // Premium Button - solid gold
            isPremium && !isCurrent && [
              "bg-[hsl(var(--accent-gold))] hover:bg-[hsl(var(--accent-gold))]/90 text-black",
              "shadow-[0_4px_20px_-4px_hsl(var(--accent-gold))/30]",
              "hover:shadow-[0_4px_25px_-4px_hsl(var(--accent-gold))/50]",
            ],

            // Free Button - ghost style
            isFree && !isCurrent && [
              "bg-transparent text-foreground border border-white/[0.1]",
              "hover:bg-white/[0.05] hover:border-white/[0.15]",
            ]
          )}
        >
          {isCurrent ? "Current Plan" : plan.cta}
          {!isCurrent && <ChevronRight size={14} className="ml-1.5 opacity-60" />}
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
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-foreground-muted/60">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-foreground-muted/40" />
          <span>Secure payment</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-foreground-muted/40" />
          <span>14-day guarantee</span>
        </div>
        <div className="flex items-center gap-2">
          <Check size={14} className="text-foreground-muted/40" />
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
