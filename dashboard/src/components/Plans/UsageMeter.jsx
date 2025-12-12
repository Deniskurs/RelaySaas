import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Zap,
  Server,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Infinity
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Plan limits configuration
const PLAN_LIMITS = {
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
};

// Get status color based on usage percentage
function getUsageStatus(used, limit) {
  if (limit === null) return "unlimited";
  const percentage = (used / limit) * 100;
  if (percentage >= 100) return "critical";
  if (percentage >= 80) return "warning";
  return "safe";
}

// Progress ring component
function ProgressRing({ value, max, size = 32, strokeWidth = 3, status }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const isUnlimited = max === null;
  const percentage = isUnlimited ? 100 : Math.min((value / max) * 100, 100);
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const statusColors = {
    safe: "stroke-[hsl(var(--accent-teal))]",
    warning: "stroke-amber-500",
    critical: "stroke-rose-500",
    unlimited: "stroke-[hsl(var(--accent-teal))]",
  };

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        className="stroke-white/[0.06]"
      />
      {/* Progress ring */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        className={statusColors[status]}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        style={{
          strokeDasharray: circumference,
        }}
      />
    </svg>
  );
}

// Single usage item
function UsageItem({ icon: Icon, label, used, limit, status, compact = false }) {
  const isUnlimited = limit === null;

  return (
    <div className={cn(
      "flex items-center gap-3",
      compact ? "py-1" : "py-2"
    )}>
      <div className="relative">
        <ProgressRing
          value={used}
          max={limit}
          size={compact ? 28 : 32}
          strokeWidth={compact ? 2.5 : 3}
          status={status}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon size={compact ? 10 : 12} className="text-foreground-muted" />
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-foreground-muted",
            compact ? "text-[11px]" : "text-xs"
          )}>
            {label}
          </span>
          <span className={cn(
            "font-mono tabular-nums",
            compact ? "text-[11px]" : "text-xs",
            status === "critical" ? "text-rose-400" :
            status === "warning" ? "text-amber-400" :
            "text-foreground"
          )}>
            {isUnlimited ? (
              <span className="flex items-center gap-1">
                {used}
                <Infinity size={10} className="text-[hsl(var(--accent-teal))]" />
              </span>
            ) : (
              `${used}/${limit}`
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

export function UsageMeter({
  signalsUsedToday = 0,
  mtAccountsConnected = 0,
  telegramChannelsActive = 0,
  className,
  variant = "default" // "default" | "compact" | "inline"
}) {
  const { profile } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  // Get current tier and limits
  const tier = profile?.subscription_tier?.toLowerCase() || "free";
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

  // Calculate usage statuses
  const signalStatus = getUsageStatus(signalsUsedToday, limits.signalsPerDay);
  const accountStatus = getUsageStatus(mtAccountsConnected, limits.mtAccounts);
  const channelStatus = getUsageStatus(telegramChannelsActive, limits.telegramChannels);

  // Determine overall status (worst of all)
  const overallStatus = useMemo(() => {
    const statuses = [signalStatus, accountStatus, channelStatus];
    if (statuses.includes("critical")) return "critical";
    if (statuses.includes("warning")) return "warning";
    return "safe";
  }, [signalStatus, accountStatus, channelStatus]);

  // Is Pro/Premium?
  const isPro = tier === "pro" || tier === "premium";

  // Inline variant (minimal, for header)
  if (variant === "inline") {
    return (
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-none",
          "bg-white/[0.03] border border-white/[0.06]",
          "hover:bg-white/[0.06] hover:border-white/[0.1]",
          "transition-all duration-200 group",
          overallStatus === "critical" && "border-rose-500/30 bg-rose-500/5",
          overallStatus === "warning" && "border-amber-500/30 bg-amber-500/5",
          className
        )}
      >
        <div className="relative">
          <ProgressRing
            value={signalsUsedToday}
            max={limits.signalsPerDay}
            size={20}
            strokeWidth={2}
            status={signalStatus}
          />
        </div>
        <span className={cn(
          "text-xs font-mono tabular-nums",
          signalStatus === "critical" ? "text-rose-400" :
          signalStatus === "warning" ? "text-amber-400" :
          "text-foreground-muted"
        )}>
          {limits.signalsPerDay === null ? (
            <Infinity size={12} className="text-[hsl(var(--accent-teal))]" />
          ) : (
            `${signalsUsedToday}/${limits.signalsPerDay}`
          )}
        </span>
        <ChevronDown
          size={12}
          className={cn(
            "text-foreground-muted/50 transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>
    );
  }

  // Compact variant
  if (variant === "compact") {
    return (
      <div className={cn(
        "rounded-none border border-white/[0.06] bg-white/[0.02]",
        "overflow-hidden transition-all duration-300",
        className
      )}>
        {/* Header - always visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-foreground-muted" />
            <span className="text-xs text-foreground-muted">Usage</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-xs font-mono tabular-nums",
              signalStatus === "critical" ? "text-rose-400" :
              signalStatus === "warning" ? "text-amber-400" :
              "text-foreground"
            )}>
              {limits.signalsPerDay === null
                ? <Infinity size={12} className="text-[hsl(var(--accent-teal))]" />
                : `${signalsUsedToday}/${limits.signalsPerDay}`
              }
            </span>
            <ChevronDown
              size={12}
              className={cn(
                "text-foreground-muted/50 transition-transform",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </button>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pt-1 space-y-1 border-t border-white/[0.04]">
                <UsageItem
                  icon={Zap}
                  label="Signals Today"
                  used={signalsUsedToday}
                  limit={limits.signalsPerDay}
                  status={signalStatus}
                  compact
                />
                <UsageItem
                  icon={Server}
                  label="MT5 Accounts"
                  used={mtAccountsConnected}
                  limit={limits.mtAccounts}
                  status={accountStatus}
                  compact
                />
                <UsageItem
                  icon={MessageSquare}
                  label="Channels"
                  used={telegramChannelsActive}
                  limit={limits.telegramChannels}
                  status={channelStatus}
                  compact
                />

                {!isPro && (
                  <div className="pt-2 mt-2 border-t border-white/[0.04]">
                    <button className="w-full flex items-center justify-center gap-1.5 text-[10px] text-[hsl(var(--accent-teal))] hover:text-[hsl(var(--accent-teal))]/80 transition-colors">
                      <Sparkles size={10} />
                      Upgrade for unlimited
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Default variant (full card)
  return (
    <div className={cn(
      "rounded-none border border-white/[0.06] bg-white/[0.02]",
      "p-4 space-y-3",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-foreground-muted" />
          <span className="text-sm font-medium text-foreground">Usage</span>
        </div>
        {!isPro && (
          <button className="flex items-center gap-1 text-[10px] text-[hsl(var(--accent-teal))] hover:text-[hsl(var(--accent-teal))]/80 transition-colors">
            <ChevronUp size={10} />
            Upgrade
          </button>
        )}
      </div>

      {/* Usage items */}
      <div className="space-y-1">
        <UsageItem
          icon={Zap}
          label="Signals Today"
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
          label="Telegram Channels"
          used={telegramChannelsActive}
          limit={limits.telegramChannels}
          status={channelStatus}
        />
      </div>

      {/* Upgrade hint for free users */}
      {!isPro && (
        <div className="pt-2 border-t border-white/[0.04]">
          <p className="text-[10px] text-foreground-muted/60 text-center">
            {signalStatus === "critical"
              ? "Daily limit reached. Reset in " + getTimeUntilReset()
              : "Upgrade to Pro for unlimited signals"
            }
          </p>
        </div>
      )}
    </div>
  );
}

// Helper to calculate time until daily reset (midnight UTC)
function getTimeUntilReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  const diff = tomorrow - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// Export PLAN_LIMITS for use elsewhere
export { PLAN_LIMITS };
