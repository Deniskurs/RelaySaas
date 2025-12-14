import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Zap,
  Server,
  MessageSquare,
  ChevronDown,
  Sparkles,
  Infinity,
  TrendingUp,
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

// Sleek linear progress bar
function ProgressBar({ value, max, status, className }) {
  const isUnlimited = max === null;
  const percentage = isUnlimited ? 100 : Math.min((value / max) * 100, 100);

  const statusColors = {
    safe: "bg-[hsl(var(--accent-teal))]",
    warning: "bg-amber-500",
    critical: "bg-rose-500",
    unlimited: "bg-gradient-to-r from-[hsl(var(--accent-teal))] to-cyan-400",
  };

  const glowColors = {
    safe: "shadow-[0_0_10px_rgba(41,161,156,0.5)]",
    warning: "shadow-[0_0_10px_rgba(245,158,11,0.5)]",
    critical: "shadow-[0_0_10px_rgba(244,63,94,0.5)]",
    unlimited: "shadow-[0_0_10px_rgba(41,161,156,0.5)]",
  };

  return (
    <div
      className={cn(
        "h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden",
        className
      )}
    >
      <motion.div
        className={cn(
          "h-full rounded-full relative",
          statusColors[status],
          glowColors[status]
        )}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent w-full -translate-x-full animate-[shimmer_2s_infinite]" />
      </motion.div>
    </div>
  );
}

function UsageItem({
  icon: Icon,
  label,
  used,
  limit,
  status,
  compact = false,
}) {
  const isUnlimited = limit === null;

  return (
    <div className="group space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 text-foreground-muted group-hover:text-foreground-subtle transition-colors">
          <Icon
            size={12}
            className={cn(
              status === "critical"
                ? "text-rose-400"
                : status === "warning"
                ? "text-amber-400"
                : "text-foreground-muted"
            )}
          />
          <span>{label}</span>
        </div>
        <div
          className={cn(
            "font-mono tabular-nums font-medium",
            status === "critical"
              ? "text-rose-400"
              : status === "warning"
              ? "text-amber-400"
              : "text-foreground"
          )}
        >
          {isUnlimited ? (
            <Infinity size={12} className="text-[hsl(var(--accent-teal))]" />
          ) : (
            <span>
              {used}
              <span className="text-foreground-muted/50">/</span>
              {limit}
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
    return (
      <div className={cn("relative group/meter", className)}>
        {/* Glassmorphic Container */}
        <div
          className={cn(
            "rounded-xl overflow-hidden transition-all duration-300",
            "bg-gradient-to-b from-white/[0.08] to-white/[0.02]",
            "border border-white/[0.08] hover:border-white/[0.12]",
            "shadow-[0_4px_20px_rgba(0,0,0,0.2)]",
            isExpanded ? "ring-1 ring-[hsl(var(--accent-teal))]/30" : ""
          )}
        >
          {/* Main Toggle Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full relative overflow-hidden"
          >
            {/* Hover Highlight */}
            <div className="absolute inset-0 bg-white/0 group-hover/meter:bg-white/[0.02] transition-colors duration-300" />

            <div className="px-3 py-2.5 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "p-1.5 rounded-lg bg-black/20 text-[hsl(var(--accent-teal))]",
                    "shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
                  )}
                >
                  <TrendingUp size={12} />
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">
                    Daily Usage
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "text-xs font-bold font-mono",
                        signalStatus === "critical"
                          ? "text-rose-400"
                          : signalStatus === "warning"
                          ? "text-amber-400"
                          : "text-foreground"
                      )}
                    >
                      {limits.signalsPerDay === null
                        ? "UNLIMITED"
                        : `${Math.min(
                            (signalsUsedToday / limits.signalsPerDay) * 100,
                            100
                          ).toFixed(0)}%`}
                    </span>
                    {limits.signalsPerDay === null && (
                      <Sparkles
                        size={10}
                        className="text-[hsl(var(--accent-teal))]"
                      />
                    )}
                  </div>
                </div>
              </div>

              <ChevronDown
                size={14}
                className={cn(
                  "text-foreground-muted/50 transition-transform duration-300",
                  isExpanded && "rotate-180 text-[hsl(var(--accent-teal))]"
                )}
              />
            </div>

            {/* Micro Progress Bar on bottom when collapsed */}
            <div
              className={cn(
                "absolute bottom-0 left-0 h-[2px] bg-[hsl(var(--accent-teal))] transition-all duration-500 ease-out",
                isExpanded ? "opacity-0" : "opacity-100"
              )}
              style={{
                width:
                  limits.signalsPerDay === null
                    ? "100%"
                    : `${Math.min(
                        (signalsUsedToday / limits.signalsPerDay) * 100,
                        100
                      )}%`,
              }}
            />
          </button>

          {/* Expanded Details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }} // smooth quart cubic
              >
                <div className="px-3 pb-3 pt-1 space-y-3">
                  <div className="space-y-3 pt-2 border-t border-white/[0.04]">
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
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpgrade) onUpgrade();
                      }}
                      className={cn(
                        "w-full mt-3 py-2 rounded-lg relative overflow-hidden group/btn",
                        "bg-gradient-to-r from-[hsl(var(--accent-teal))] to-cyan-500",
                        "text-white text-xs font-bold shadow-lg shadow-cyan-500/20",
                        "border border-white/10"
                      )}
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 pointer-events-none" />
                      <div className="flex items-center justify-center gap-1.5 relative z-10">
                        <Sparkles size={12} className="fill-white/20" />
                        <span>Unlock Unlimited</span>
                      </div>
                    </motion.button>
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
        "rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm",
        "p-5 space-y-4",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[hsl(var(--accent-teal))]/10 text-[hsl(var(--accent-teal))]">
            <Zap size={16} />
          </div>
          <div>
            <span className="block text-sm font-semibold text-foreground">
              Usage Overview
            </span>
            <span className="text-[11px] text-foreground-muted">
              Renewal in {getTimeUntilReset()}
            </span>
          </div>
        </div>
        {!isPro && (
          <button
            onClick={onUpgrade}
            className="px-3 py-1.5 text-xs font-medium text-[hsl(var(--accent-teal))] bg-[hsl(var(--accent-teal))]/5 border border-[hsl(var(--accent-teal))]/20 rounded-lg hover:bg-[hsl(var(--accent-teal))]/10 transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>

      <div className="space-y-4 p-4 rounded-xl bg-black/20 border border-white/[0.04]">
        <UsageItem
          icon={Zap}
          label="Signal Limit"
          used={signalsUsedToday}
          limit={limits.signalsPerDay}
          status={signalStatus}
        />
        <UsageItem
          icon={Server}
          label="MT5 Connections"
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
