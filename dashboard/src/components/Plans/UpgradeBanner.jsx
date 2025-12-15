import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  X,
  Lightbulb,
  AlertTriangle,
  Ban,
  ChevronRight,
  Zap,
  Shield,
  Clock,
  Gift,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Soft awareness banner (dismissible, non-intrusive)
export function SoftUpgradeBanner({
  onDismiss,
  onUpgrade,
  className,
  message = "Pro traders use unlimited signals daily",
  ctaText = "Compare Plans",
}) {
  const [isDismissed, setIsDismissed] = useState(false);

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store dismissal in localStorage with timestamp
    localStorage.setItem("soft-upgrade-banner-dismissed", Date.now().toString());
    onDismiss?.();
  };

  // Check if banner should be shown (not dismissed in last 3 days)
  useEffect(() => {
    const dismissedAt = localStorage.getItem("soft-upgrade-banner-dismissed");
    if (dismissedAt) {
      const daysSinceDismissal = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissal < 3) {
        setIsDismissed(true);
      }
    }
  }, []);

  if (isDismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "relative rounded-none border-l-2 border-l-[hsl(var(--accent-teal))]",
        "border border-white/[0.06] bg-white/[0.02]",
        "px-4 py-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Lightbulb size={14} className="text-[hsl(var(--accent-teal))] shrink-0" />
          <p className="text-sm text-foreground-muted">
            {message}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onUpgrade}
            className="h-7 px-3 text-xs text-[hsl(var(--accent-teal))] hover:text-[hsl(var(--accent-teal))] hover:bg-[hsl(var(--accent-teal))]/10"
          >
            {ctaText}
            <ChevronRight size={12} className="ml-1" />
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 text-foreground-muted/50 hover:text-foreground-muted transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Warning banner (80% limit - more prominent)
export function WarningUpgradeBanner({
  signalsUsed,
  signalsLimit,
  onUpgrade,
  className,
}) {
  const remaining = signalsLimit - signalsUsed;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-none border-l-2 border-l-amber-500",
        "border border-amber-500/20 bg-amber-500/5",
        "px-4 py-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <div>
            <p className="text-sm text-foreground">
              <span className="font-medium">{signalsUsed}/{signalsLimit}</span>
              {" "}daily signals used
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">
              {remaining === 1 ? "Last signal remaining" : `${remaining} signals remaining today`}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onUpgrade}
          className="h-8 px-4 text-xs border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
        >
          <Zap size={12} className="mr-1.5" />
          Upgrade Now
        </Button>
      </div>
    </motion.div>
  );
}

// Critical limit modal (hard gate - requires action)
export function LimitReachedModal({
  isOpen,
  onClose,
  onUpgrade,
  onRemindLater,
  signalsLimit = 5,
  hoursUntilReset,
}) {
  if (!isOpen) return null;

  // Calculate reset time
  const resetTime = hoursUntilReset
    ? `${Math.floor(hoursUntilReset)}h ${Math.floor((hoursUntilReset % 1) * 60)}m`
    : getTimeUntilMidnightUTC();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={cn(
            "relative w-full max-w-md rounded-none",
            "border border-white/[0.08] bg-background",
            "shadow-2xl shadow-black/50"
          )}
        >
          {/* Header with warning icon */}
          <div className="flex flex-col items-center pt-8 pb-4 px-6">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
              <Ban size={28} className="text-rose-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground text-center">
              Daily Limit Reached
            </h2>
            <p className="text-sm text-foreground-muted text-center mt-2">
              You've used all {signalsLimit} signals today.
            </p>
          </div>

          {/* Reset countdown */}
          <div className="mx-6 mb-6 p-3 rounded-none bg-white/[0.02] border border-white/[0.06]">
            <div className="flex items-center justify-center gap-2">
              <Clock size={14} className="text-foreground-muted" />
              <span className="text-sm text-foreground-muted">
                Reset in <span className="font-mono text-foreground">{resetTime}</span>
              </span>
            </div>
          </div>

          {/* What Pro includes */}
          <div className="px-6 pb-4">
            <p className="text-xs text-foreground-muted uppercase tracking-wider mb-3">
              Pro includes
            </p>
            <div className="space-y-2">
              {[
                "Unlimited signals daily",
                "3 MT5 accounts",
                "Priority support",
                "Advanced filters"
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-[hsl(var(--accent-teal))]/10 flex items-center justify-center">
                    <Zap size={10} className="text-[hsl(var(--accent-teal))]" />
                  </div>
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 border-t border-white/[0.06] space-y-3">
            <Button
              onClick={onUpgrade}
              className="w-full h-11 bg-[hsl(var(--accent-teal))] hover:bg-[hsl(var(--accent-teal))]/90 text-background font-medium"
            >
              <Shield size={16} className="mr-2" />
              Upgrade to Pro - $29/mo
            </Button>

            <Button
              variant="ghost"
              onClick={onRemindLater || onClose}
              className="w-full h-9 text-foreground-muted hover:text-foreground hover:bg-white/[0.04]"
            >
              Remind Me Tomorrow
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Feature-specific upgrade prompt (for locked features)
export function FeatureUpgradePrompt({
  feature,
  description,
  icon: Icon = Zap,
  onUpgrade,
  className,
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "rounded-none border border-[hsl(var(--accent-teal))]/20 bg-[hsl(var(--accent-teal))]/5",
        "p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-none bg-[hsl(var(--accent-teal))]/10">
          <Icon size={16} className="text-[hsl(var(--accent-teal))]" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-foreground">{feature}</h4>
          <p className="text-xs text-foreground-muted mt-1">{description}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onUpgrade}
            className="h-7 px-0 mt-2 text-xs text-[hsl(var(--accent-teal))] hover:text-[hsl(var(--accent-teal))]/80"
          >
            Unlock with Pro
            <ChevronRight size={12} className="ml-1" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// "Pro Day" gift banner (for users eligible for 24hr Pro trial)
export function ProDayGiftBanner({
  onClaim,
  onDismiss,
  className,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-none overflow-hidden",
        "border border-[hsl(var(--accent-gold))]/30",
        "bg-gradient-to-r from-[hsl(var(--accent-gold))]/10 to-[hsl(var(--accent-teal))]/10",
        "px-4 py-4",
        className
      )}
    >
      {/* Decorative shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-[hsl(var(--accent-gold))]/20">
            <Gift size={18} className="text-[hsl(var(--accent-gold))]" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              You've earned a free Pro Day!
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">
              Experience unlimited signals for 24 hours
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={onClaim}
            className="h-9 px-4 bg-[hsl(var(--accent-gold))] hover:bg-[hsl(var(--accent-gold))]/90 text-background font-medium"
          >
            <Zap size={14} className="mr-1.5" />
            Claim Now
          </Button>
          <button
            onClick={onDismiss}
            className="p-1 text-foreground-muted/50 hover:text-foreground-muted transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// Pro Day active countdown banner
export function ProDayActiveBanner({
  hoursRemaining,
  onUpgrade,
  className,
}) {
  const isLow = hoursRemaining <= 4;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-none overflow-hidden",
        "border",
        isLow
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-[hsl(var(--accent-teal))]/30 bg-[hsl(var(--accent-teal))]/5",
        "px-4 py-3",
        className
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-full",
            isLow ? "bg-amber-500/20" : "bg-[hsl(var(--accent-teal))]/20"
          )}>
            {isLow ? (
              <Bell size={14} className="text-amber-500" />
            ) : (
              <Shield size={14} className="text-[hsl(var(--accent-teal))]" />
            )}
          </div>
          <div>
            <p className="text-sm text-foreground">
              {isLow ? (
                <>
                  <span className="font-medium text-amber-400">
                    {Math.floor(hoursRemaining)}h {Math.floor((hoursRemaining % 1) * 60)}m
                  </span>
                  {" "}left of Pro access
                </>
              ) : (
                <>
                  Pro Day active -{" "}
                  <span className="font-medium">
                    {Math.floor(hoursRemaining)}h {Math.floor((hoursRemaining % 1) * 60)}m
                  </span>
                  {" "}remaining
                </>
              )}
            </p>
            {isLow && (
              <p className="text-xs text-foreground-muted mt-0.5">
                Loving Pro? Keep it for just $29/mo
              </p>
            )}
          </div>
        </div>

        {isLow && (
          <Button
            onClick={onUpgrade}
            className="h-8 px-4 text-xs bg-amber-500 hover:bg-amber-500/90 text-background font-medium"
          >
            Keep Pro
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// Helper function
function getTimeUntilMidnightUTC() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  const diff = tomorrow - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}
