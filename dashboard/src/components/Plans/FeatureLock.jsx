import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Lock,
  Zap,
  Shield,
  Crown,
  ChevronRight,
  Filter,
  BarChart3,
  Server,
  Code,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

// Feature definitions with their requirements
const FEATURE_CONFIG = {
  advancedFilters: {
    name: "Advanced Filters",
    description: "Filter signals by win rate, R:R, timeframe, and instrument type",
    icon: Filter,
    requiredTier: "pro",
    benefits: [
      "Filter by win rate (>60%, >70%, >80%)",
      "Filter by risk/reward ratio",
      "Filter by timeframe",
      "Filter by instrument type",
    ],
  },
  analytics: {
    name: "Trading Analytics",
    description: "Track your performance with detailed charts and insights",
    icon: BarChart3,
    requiredTier: "pro",
    benefits: [
      "Win rate tracking",
      "Profit/loss charts",
      "Signal performance history",
      "Export data to CSV",
    ],
  },
  multiAccount: {
    name: "Multiple Accounts",
    description: "Connect and manage multiple MT5 trading accounts",
    icon: Server,
    requiredTier: "pro",
    benefits: [
      "Connect up to 3 MT5 accounts",
      "Separate strategies per account",
      "Risk isolation",
      "Better profit tracking",
    ],
  },
  apiAccess: {
    name: "API Access",
    description: "Build custom integrations with our REST API",
    icon: Code,
    requiredTier: "premium",
    benefits: [
      "Full REST API access",
      "Webhook notifications",
      "Custom automation",
      "Rate limit: 1000 req/min",
    ],
  },
  webhooks: {
    name: "Custom Webhooks",
    description: "Send signal data to your own endpoints",
    icon: Webhook,
    requiredTier: "premium",
    benefits: [
      "Custom webhook endpoints",
      "Real-time signal delivery",
      "Retry logic & error handling",
      "Custom payload formatting",
    ],
  },
};

// Tier hierarchy for comparison
const TIER_HIERARCHY = {
  free: 0,
  pro: 1,
  premium: 2,
};

// Check if user has access to a feature
function hasAccess(userTier, requiredTier) {
  const userLevel = TIER_HIERARCHY[userTier?.toLowerCase()] || 0;
  const requiredLevel = TIER_HIERARCHY[requiredTier] || 0;
  return userLevel >= requiredLevel;
}

// Tier badge component
function TierBadge({ tier }) {
  const config = {
    pro: {
      icon: Shield,
      label: "Pro",
      className: "bg-[hsl(var(--accent-teal))]/10 text-[hsl(var(--accent-teal))] border-[hsl(var(--accent-teal))]/20",
    },
    premium: {
      icon: Crown,
      label: "Premium",
      className: "bg-[hsl(var(--accent-gold))]/10 text-[hsl(var(--accent-gold))] border-[hsl(var(--accent-gold))]/20",
    },
  };

  const { icon: Icon, label, className } = config[tier] || config.pro;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[10px] font-medium border",
      className
    )}>
      <Icon size={10} />
      {label}
    </span>
  );
}

// Full-page feature lock overlay (for pages like Analytics)
export function FeatureLockOverlay({
  feature,
  onUpgrade,
  showPreview = true,
  children,
  className,
}) {
  const { profile } = useAuth();
  const userTier = profile?.subscription_tier?.toLowerCase() || "free";

  const config = FEATURE_CONFIG[feature] || {
    name: "Pro Feature",
    description: "This feature requires an upgrade",
    icon: Lock,
    requiredTier: "pro",
    benefits: [],
  };

  const Icon = config.icon;
  const isLocked = !hasAccess(userTier, config.requiredTier);

  if (!isLocked) {
    return children;
  }

  return (
    <div className={cn("relative", className)}>
      {/* Blurred preview content */}
      {showPreview && children && (
        <div className="blur-sm opacity-50 pointer-events-none select-none">
          {children}
        </div>
      )}

      {/* Lock overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          "bg-background/80 backdrop-blur-sm",
          !showPreview && "relative min-h-[300px]"
        )}
      >
        <div className="w-full max-w-md px-6">
          <div className="rounded-none border border-white/[0.08] bg-background/95 p-6 text-center shadow-xl">
            {/* Icon */}
            <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4">
              <Lock size={24} className="text-foreground-muted" />
            </div>

            {/* Title */}
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-foreground">
                {config.name}
              </h3>
              <TierBadge tier={config.requiredTier} />
            </div>

            {/* Description */}
            <p className="text-sm text-foreground-muted mb-6">
              {config.description}
            </p>

            {/* Benefits */}
            {config.benefits.length > 0 && (
              <div className="text-left mb-6 space-y-2">
                {config.benefits.map((benefit, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-[hsl(var(--accent-teal))]/10 flex items-center justify-center shrink-0">
                      <Zap size={8} className="text-[hsl(var(--accent-teal))]" />
                    </div>
                    <span className="text-sm text-foreground-muted">{benefit}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <Button
              onClick={onUpgrade}
              className="w-full h-11 bg-[hsl(var(--accent-teal))] hover:bg-[hsl(var(--accent-teal))]/90 text-background font-medium"
            >
              Unlock with {config.requiredTier === "premium" ? "Premium" : "Pro"}
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Inline feature lock (for buttons/toggles)
export function FeatureLockInline({
  feature,
  onUpgrade,
  children,
  className,
  showTooltip = true,
}) {
  const { profile } = useAuth();
  const userTier = profile?.subscription_tier?.toLowerCase() || "free";

  const config = FEATURE_CONFIG[feature] || {
    name: "Pro Feature",
    requiredTier: "pro",
    icon: Lock,
  };

  const isLocked = !hasAccess(userTier, config.requiredTier);

  if (!isLocked) {
    return children;
  }

  return (
    <div className={cn("relative group", className)}>
      {/* Disabled content */}
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>

      {/* Lock badge overlay */}
      <button
        onClick={onUpgrade}
        className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] cursor-pointer group-hover:bg-background/70 transition-colors"
      >
        <span className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-none text-xs",
          "bg-white/[0.06] border border-white/[0.1]",
          "text-foreground-muted group-hover:text-foreground transition-colors"
        )}>
          <Lock size={10} />
          {config.requiredTier === "premium" ? "Premium" : "Pro"}
        </span>
      </button>

      {/* Tooltip on hover */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
          <div className="px-3 py-2 rounded-none bg-background border border-white/[0.1] shadow-lg text-center whitespace-nowrap">
            <p className="text-xs font-medium text-foreground">{config.name}</p>
            <p className="text-[10px] text-foreground-muted mt-0.5">
              Upgrade to {config.requiredTier === "premium" ? "Premium" : "Pro"} to unlock
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// List item lock (for locked items in lists)
export function FeatureLockListItem({
  feature,
  label,
  onUpgrade,
  className,
}) {
  const config = FEATURE_CONFIG[feature] || {
    name: label || "Pro Feature",
    requiredTier: "pro",
    icon: Lock,
  };

  const Icon = config.icon;

  return (
    <button
      onClick={onUpgrade}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3",
        "bg-white/[0.02] border border-white/[0.06] rounded-none",
        "hover:bg-white/[0.04] hover:border-white/[0.1] transition-colors",
        "group",
        className
      )}
    >
      <div className="p-2 rounded-none bg-white/[0.04]">
        <Lock size={14} className="text-foreground-muted" />
      </div>
      <div className="flex-1 text-left">
        <span className="text-sm text-foreground-muted group-hover:text-foreground transition-colors">
          {config.name}
        </span>
        <p className="text-xs text-foreground-muted/60 mt-0.5">
          Upgrade to {config.requiredTier === "premium" ? "Premium" : "Pro"}
        </p>
      </div>
      <ChevronRight size={14} className="text-foreground-muted/50 group-hover:text-foreground-muted transition-colors" />
    </button>
  );
}

// Card-style feature lock (for feature cards)
export function FeatureLockCard({
  feature,
  onUpgrade,
  className,
}) {
  const config = FEATURE_CONFIG[feature] || {
    name: "Pro Feature",
    description: "This feature requires an upgrade",
    icon: Lock,
    requiredTier: "pro",
    benefits: [],
  };

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-none border border-white/[0.06] bg-white/[0.02]",
        "p-5 hover:border-white/[0.1] transition-colors",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-none bg-white/[0.04]">
            <Icon size={18} className="text-foreground-muted" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-foreground">{config.name}</h4>
              <TierBadge tier={config.requiredTier} />
            </div>
            <p className="text-xs text-foreground-muted mt-0.5">
              {config.description}
            </p>
          </div>
        </div>
      </div>

      {/* Benefits preview */}
      {config.benefits.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {config.benefits.slice(0, 3).map((benefit, i) => (
            <div key={i} className="flex items-center gap-2">
              <Zap size={10} className="text-[hsl(var(--accent-teal))]" />
              <span className="text-xs text-foreground-muted">{benefit}</span>
            </div>
          ))}
          {config.benefits.length > 3 && (
            <p className="text-[10px] text-foreground-muted/60 pl-5">
              +{config.benefits.length - 3} more features
            </p>
          )}
        </div>
      )}

      {/* CTA */}
      <Button
        onClick={onUpgrade}
        variant="outline"
        className="w-full h-9 text-xs border-[hsl(var(--accent-teal))]/30 text-[hsl(var(--accent-teal))] hover:bg-[hsl(var(--accent-teal))]/10"
      >
        <Lock size={12} className="mr-1.5" />
        Unlock Feature
      </Button>
    </motion.div>
  );
}

// Export feature config for use elsewhere
export { FEATURE_CONFIG, hasAccess, TIER_HIERARCHY };
