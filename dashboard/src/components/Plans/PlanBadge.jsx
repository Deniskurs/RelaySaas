import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Shield,
  Crown,
  ChevronUp,
  ChevronDown,
  Settings,
  CreditCard,
  BarChart3,
  Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Tier configuration
const TIER_CONFIG = {
  free: {
    label: "Free",
    icon: Sparkles,
    className: "border-white/[0.08] bg-white/[0.03] text-foreground-muted",
    badgeClassName: "text-foreground-muted",
    showUpgrade: true,
  },
  pro: {
    label: "Pro",
    icon: Shield,
    className: "border-[hsl(var(--accent-teal))]/30 bg-[hsl(var(--accent-teal))]/10 text-[hsl(var(--accent-teal))]",
    badgeClassName: "text-[hsl(var(--accent-teal))]",
    showUpgrade: false, // Can upgrade to Premium
  },
  premium: {
    label: "Premium",
    icon: Crown,
    className: "border-[hsl(var(--accent-gold))]/30 bg-[hsl(var(--accent-gold))]/10 text-[hsl(var(--accent-gold))]",
    badgeClassName: "text-[hsl(var(--accent-gold))]",
    showUpgrade: false,
  },
};

// Quick dropdown menu
function PlanDropdown({ isOpen, onClose, currentTier, onNavigate }) {
  const dropdownRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  const tierConfig = TIER_CONFIG[currentTier] || TIER_CONFIG.free;
  const TierIcon = tierConfig.icon;
  const isFree = currentTier === "free";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "absolute right-0 top-full mt-2 z-50",
            "w-64 rounded-none border border-white/[0.08] bg-background",
            "shadow-lg shadow-black/30 backdrop-blur-xl"
          )}
        >
          {/* Current Plan Header */}
          <div className="p-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-none",
                tierConfig.className
              )}>
                <TierIcon size={16} />
              </div>
              <div>
                <p className="text-xs text-foreground-muted">Current Plan</p>
                <p className="text-sm font-semibold text-foreground">
                  {tierConfig.label}
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            {isFree && (
              <button
                onClick={() => {
                  onNavigate?.("pricing");
                  onClose();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors group"
              >
                <ChevronUp size={14} className="text-[hsl(var(--accent-teal))]" />
                <div className="flex-1 text-left">
                  <span className="text-sm text-foreground group-hover:text-[hsl(var(--accent-teal))] transition-colors">
                    Upgrade to Pro
                  </span>
                  <p className="text-[10px] text-foreground-muted">
                    Unlock unlimited signals
                  </p>
                </div>
              </button>
            )}

            {currentTier === "pro" && (
              <button
                onClick={() => {
                  onNavigate?.("pricing");
                  onClose();
                }}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors group"
              >
                <Crown size={14} className="text-[hsl(var(--accent-gold))]" />
                <div className="flex-1 text-left">
                  <span className="text-sm text-foreground group-hover:text-[hsl(var(--accent-gold))] transition-colors">
                    Upgrade to Premium
                  </span>
                  <p className="text-[10px] text-foreground-muted">
                    API access & unlimited accounts
                  </p>
                </div>
              </button>
            )}

            <button
              onClick={() => {
                onNavigate?.("pricing");
                onClose();
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors"
            >
              <BarChart3 size={14} className="text-foreground-muted" />
              <span className="text-sm text-foreground">Compare Plans</span>
            </button>

            <button
              onClick={() => {
                onNavigate?.("billing");
                onClose();
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors"
            >
              <CreditCard size={14} className="text-foreground-muted" />
              <span className="text-sm text-foreground">Billing & Usage</span>
            </button>

            <button
              onClick={() => {
                onNavigate?.("settings");
                onClose();
              }}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-white/[0.04] transition-colors"
            >
              <Settings size={14} className="text-foreground-muted" />
              <span className="text-sm text-foreground">Account Settings</span>
            </button>
          </div>

          {/* Footer for Pro/Premium */}
          {!isFree && (
            <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2 text-[10px] text-foreground-muted">
                <Check size={10} className="text-[hsl(var(--accent-teal))]" />
                <span>
                  {currentTier === "premium"
                    ? "All features unlocked"
                    : "Unlimited signals active"
                  }
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PlanBadge({
  className,
  onNavigate, // Callback for navigation (pricing, billing, settings)
  showDropdown = true,
  size = "default", // "default" | "sm" | "lg"
}) {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const tier = profile?.subscription_tier?.toLowerCase() || "free";
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.free;
  const TierIcon = tierConfig.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    default: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  const iconSizes = {
    sm: 10,
    default: 12,
    lg: 14,
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => showDropdown && setIsOpen(!isOpen)}
        className={cn(
          "flex items-center rounded-none border transition-all duration-200",
          tierConfig.className,
          sizeClasses[size],
          showDropdown && "hover:bg-white/[0.06] cursor-pointer",
          !showDropdown && "cursor-default"
        )}
      >
        <TierIcon size={iconSizes[size]} />
        <span className="font-medium">{tierConfig.label}</span>

        {/* Upgrade indicator for free users */}
        {tier === "free" && (
          <ChevronUp
            size={iconSizes[size]}
            className="text-[hsl(var(--accent-teal))] ml-0.5"
          />
        )}

        {/* Dropdown indicator */}
        {showDropdown && tier !== "free" && (
          <ChevronDown
            size={iconSizes[size] - 2}
            className={cn(
              "text-foreground-muted/50 transition-transform ml-0.5",
              isOpen && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <PlanDropdown
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          currentTier={tier}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

// Simple badge variant (no dropdown, just display)
export function PlanBadgeSimple({ className, size = "default" }) {
  return (
    <PlanBadge
      className={className}
      size={size}
      showDropdown={false}
    />
  );
}

// Export tier config for use elsewhere
export { TIER_CONFIG };
