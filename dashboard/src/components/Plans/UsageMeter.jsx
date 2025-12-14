import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Zap,
  Server,
  MessageSquare,
  ChevronRight,
  Infinity,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    signalsPerDay: 5,
    mtAccounts: 1,
    telegramChannels: 2,
  },
  pro: {
    signalsPerDay: null, // unlimited
    mtAccounts: 3,
    telegramChannels: 5,
  },
  premium: {
    signalsPerDay: null, // unlimited
    mtAccounts: 10,
    telegramChannels: null, // unlimited
  },
  // Add enterprise or other tiers if needed
  enterprise: {
    signalsPerDay: null,
    mtAccounts: 50,
    telegramChannels: null,
  },
};

function getUsageStatus(used, limit) {
  if (limit === null) return "unlimited";
  const percentage = (used / limit) * 100;
  if (percentage >= 100) return "critical";
  if (percentage >= 80) return "warning";
  return "safe";
}

// Minimal progress bar
function ProgressBar({ value, max, status, className }) {
  const isUnlimited = max === null;
  const percentage = isUnlimited ? 100 : Math.min((value / max) * 100, 100);

  const statusColors = {
    safe: "bg-[hsl(var(--accent-teal))]",
    warning: "bg-amber-500",
    critical: "bg-rose-500",
    unlimited: "bg-[hsl(var(--accent-teal))]/60",
  };

  return (
    <div className={cn("h-[3px] w-full bg-white/[0.04] overflow-hidden", className)}>
      <motion.div
        className={cn("h-full", statusColors[status])}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

function UsageItem({ icon: Icon, label, used, limit, status }) {
  const isUnlimited = limit === null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-foreground-muted/70">
          <Icon size={11} strokeWidth={1.5} />
          <span>{label}</span>
        </div>
        <div
          className={cn(
            "text-[11px] font-mono tabular-nums",
            status === "critical" ? "text-rose-400" :
            status === "warning" ? "text-amber-400" :
            "text-foreground-muted"
          )}
        >
          {isUnlimited ? (
            <Infinity size={11} className="text-[hsl(var(--accent-teal))]/70" />
          ) : (
            <span>
              {used}<span className="text-foreground-muted/30">/</span>{limit}
            </span>
          )}
        </div>
      </div>
      <ProgressBar value={used} max={limit} status={status} />
    </div>
  );
}

export function UsageMeter({
  signalsUsedToday = 0,
  mtAccountsConnected = 0,
  telegramChannelsActive = 0,
  className,
  variant = "default", // "default" | "compact" | "inline"
  onUpgrade,
}) {
  const { profile } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  // Get current tier and limits
  const tier = profile?.subscription_tier?.toLowerCase() || "free";
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

  const signalStatus = getUsageStatus(signalsUsedToday, limits.signalsPerDay);
  const accountStatus = getUsageStatus(mtAccountsConnected, limits.mtAccounts);
  const channelStatus = getUsageStatus(
    telegramChannelsActive,
    limits.telegramChannels
  );

  const isPro = tier === "pro" || tier === "premium" || tier === "enterprise";

  // --- COMPACT VARIANT (SIDEBAR) ---
  if (variant === "compact") {
    const percentage = limits.signalsPerDay === null
      ? 100
      : Math.min((signalsUsedToday / limits.signalsPerDay) * 100, 100);

    return (
      <div className={cn("relative", className)}>
        <div className={cn(
          "overflow-hidden transition-all duration-200",
          "bg-white/[0.02] border border-white/[0.05]",
          isExpanded && "border-white/[0.08]"
        )}>
          {/* Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted/50">
                Usage
              </span>
              {limits.signalsPerDay === null ? (
                <span className="text-[10px] font-mono text-[hsl(var(--accent-teal))]/70">
                  PRO
                </span>
              ) : (
                <span className={cn(
                  "text-xs font-mono font-medium",
                  signalStatus === "critical" ? "text-rose-400" :
                  signalStatus === "warning" ? "text-amber-400" :
                  "text-foreground-muted"
                )}>
                  {percentage.toFixed(0)}%
                </span>
              )}
            </div>
            <ChevronRight
              size={12}
              className={cn(
                "text-foreground-muted/30 transition-transform duration-200",
                isExpanded && "rotate-90"
              )}
            />
          </button>

          {/* Progress bar when collapsed */}
          {!isExpanded && limits.signalsPerDay !== null && (
            <div className="px-3 pb-2">
              <ProgressBar
                value={signalsUsedToday}
                max={limits.signalsPerDay}
                status={signalStatus}
              />
            </div>
          )}

          {/* Expanded Details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="px-3 pb-3 space-y-3 border-t border-white/[0.04]">
                  <div className="pt-3 space-y-3">
                    <UsageItem
                      icon={Zap}
                      label="Signals"
                      used={signalsUsedToday}
                      limit={limits.signalsPerDay}
                      status={signalStatus}
                    />
                    <UsageItem
                      icon={Server}
                      label="Accounts"
                      used={mtAccountsConnected}
                      limit={limits.mtAccounts}
                      status={accountStatus}
                    />
                    <UsageItem
                      icon={MessageSquare}
                      label="Channels"
                      used={telegramChannelsActive}
                      limit={limits.telegramChannels}
                      status={channelStatus}
                    />
                  </div>

                  {!isPro && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpgrade) onUpgrade();
                      }}
                      className="w-full py-2 text-[11px] font-medium text-[hsl(var(--accent-teal))] bg-[hsl(var(--accent-teal))]/[0.08] border border-[hsl(var(--accent-teal))]/15 hover:bg-[hsl(var(--accent-teal))]/[0.12] transition-colors"
                    >
                      Upgrade
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // --- DEFAULT VARIANT (FULL CARD) ---
  return (
    <div
      className={cn(
        "border border-white/[0.06] bg-white/[0.02]",
        "p-4 space-y-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="block text-sm font-medium text-foreground">
            Usage
          </span>
          <span className="text-[10px] text-foreground-muted/60">
            Resets in {getTimeUntilReset()}
          </span>
        </div>
        {!isPro && (
          <button
            onClick={onUpgrade}
            className="px-2.5 py-1 text-[10px] font-medium text-[hsl(var(--accent-teal))] bg-[hsl(var(--accent-teal))]/[0.08] border border-[hsl(var(--accent-teal))]/15 hover:bg-[hsl(var(--accent-teal))]/[0.12] transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>

      <div className="space-y-3 p-3 bg-black/20 border border-white/[0.04]">
        <UsageItem
          icon={Zap}
          label="Signals"
          used={signalsUsedToday}
          limit={limits.signalsPerDay}
          status={signalStatus}
        />
        <UsageItem
          icon={Server}
          label="MT5 Accounts"
          used={mtAccountsConnected}
          limit={limits.mtAccounts}
          status={accountStatus}
        />
        <UsageItem
          icon={MessageSquare}
          label="Channels"
          used={telegramChannelsActive}
          limit={limits.telegramChannels}
          status={channelStatus}
        />
      </div>
    </div>
  );
}

function getTimeUntilReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  const diff = tomorrow - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}
