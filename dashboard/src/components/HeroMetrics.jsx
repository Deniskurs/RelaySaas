import { TrendingUp, TrendingDown, AlertTriangle, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { motion } from "framer-motion";

/**
 * HeroMetrics - Primary dashboard metrics with proper visual hierarchy
 *
 * Designed so traders can answer "Am I making money?" in < 1 second
 */
export default function HeroMetrics({ stats, account, openTrades = [] }) {
  const { formatPnL, format } = useCurrency();

  // Calculate key metrics
  const todayPnL = stats?.todayPnL || stats?.today_pnl || 0;
  const openPnL = openTrades.reduce(
    (sum, t) => sum + (t.profit || t.unrealizedPnL || 0),
    0
  );
  // Calculate equity in real-time from balance + open P&L for instant updates
  // (MetaAPI's equity field has a delay vs position updates)
  const realTimeEquity = account.balance + openPnL;
  const marginPercent =
    realTimeEquity > 0 ? (account.margin / realTimeEquity) * 100 : 0;
  // Calculate starting balance to get accurate daily return %
  const startingBalance = account.balance - todayPnL;
  const todayChange =
    startingBalance > 0 ? (todayPnL / startingBalance) * 100 : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* TODAY'S P&L - THE HERO METRIC */}
      <HeroCard
        label="Today's P&L"
        value={formatPnL(todayPnL)}
        change={`${todayChange >= 0 ? "+" : ""}${todayChange.toFixed(2)}%`}
        variant={todayPnL >= 0 ? "profit" : "loss"}
        icon={todayPnL >= 0 ? TrendingUp : TrendingDown}
        priority="hero"
      />

      {/* OPEN P&L - Currently running positions */}
      <HeroCard
        label="Open P&L"
        value={formatPnL(openPnL)}
        subtitle={`${openTrades.length} position${
          openTrades.length !== 1 ? "s" : ""
        }`}
        variant={openPnL >= 0 ? "profit" : "loss"}
        icon={openPnL >= 0 ? TrendingUp : TrendingDown}
        priority="high"
      />

      {/* MARGIN USAGE - Risk indicator */}
      <HeroCard
        label="Margin Used"
        value={`${marginPercent.toFixed(1)}%`}
        progress={marginPercent}
        variant={
          marginPercent > 80
            ? "danger"
            : marginPercent > 50
            ? "warning"
            : "safe"
        }
        icon={marginPercent > 80 ? AlertTriangle : null}
        priority="high"
      />

      {/* BALANCE - Account status */}
      <HeroCard
        label="Balance"
        value={format(account.balance)}
        subtitle={`Equity: ${format(realTimeEquity)}`}
        variant="neutral"
        icon={Wallet}
        priority="medium"
      />
    </div>
  );
}

function HeroCard({
  label,
  value,
  change,
  subtitle,
  variant,
  icon: Icon,
  progress,
  priority = "medium",
}) {
  const variants = {
    profit: {
      bg: "bg-success/5 hover:bg-success/10",
      border: "border-success/20",
      text: "text-success",
      glow: "shadow-success/5",
    },
    loss: {
      bg: "bg-destructive/5 hover:bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      glow: "shadow-destructive/5",
    },
    danger: {
      bg: "bg-destructive/5 hover:bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      glow: "shadow-destructive/5",
    },
    warning: {
      bg: "bg-warning/5 hover:bg-warning/10",
      border: "border-warning/20",
      text: "text-warning",
      glow: "shadow-warning/5",
    },
    safe: {
      bg: "bg-primary/5 hover:bg-primary/10",
      border: "border-primary/20",
      text: "text-primary",
      glow: "shadow-primary/5",
    },
    neutral: {
      bg: "bg-white/[0.02] hover:bg-white/[0.04]",
      border: "border-white/[0.06]",
      text: "text-foreground",
      glow: "",
    },
  };

  const style = variants[variant] || variants.neutral;
  const isHero = priority === "hero";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative p-5 rounded-none border backdrop-blur-sm transition-all duration-300",
        style.bg,
        style.border,
        style.glow && `shadow-lg ${style.glow}`,
        isHero && "lg:col-span-1"
      )}
    >
      {/* Label + Icon Row */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-foreground-muted font-medium">
          {label}
        </span>
        {Icon && (
          <Icon
            size={isHero ? 20 : 16}
            className={cn("opacity-60", style.text)}
          />
        )}
      </div>

      {/* Main Value - Size varies by priority */}
      <div
        className={cn(
          "font-mono font-bold tracking-tight",
          style.text,
          isHero ? "text-3xl lg:text-4xl" : "text-2xl"
        )}
      >
        {value}
      </div>

      {/* Change Indicator (for P&L cards) */}
      {change && (
        <div
          className={cn(
            "text-sm font-medium mt-1.5 font-mono",
            style.text,
            "opacity-80"
          )}
        >
          {change}
        </div>
      )}

      {/* Subtitle (for position count, equity) */}
      {subtitle && (
        <div className="text-xs text-foreground-muted mt-1.5">{subtitle}</div>
      )}

      {/* Progress Bar (for margin) */}
      {progress !== undefined && (
        <div className="mt-4">
          <div className="h-1.5 bg-white/[0.06] rounded-none overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "h-full rounded-none transition-colors",
                variant === "danger"
                  ? "bg-destructive"
                  : variant === "warning"
                  ? "bg-warning"
                  : "bg-primary"
              )}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-foreground-muted">
            <span>0%</span>
            <span
              className={cn(
                progress > 80
                  ? "text-destructive"
                  : progress > 50
                  ? "text-warning"
                  : "text-foreground-muted"
              )}
            >
              {progress > 80
                ? "High Risk"
                : progress > 50
                ? "Moderate"
                : "Safe"}
            </span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Danger Pulse Animation for Critical States */}
      {variant === "danger" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 border-2 border-destructive/50 rounded-none pointer-events-none"
        />
      )}
    </motion.div>
  );
}
