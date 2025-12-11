import { cn } from "@/lib/utils";

const StatItem = ({ label, value, variant = "neutral" }) => {
  const variantStyles = {
    profit: "text-success",
    loss: "text-destructive",
    neutral: "text-foreground",
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 glass-card">
      <div className="flex flex-col">
        <span className="text-xs text-foreground-muted">{label}</span>
        <span
          className={cn(
            "text-sm font-semibold font-mono tabular-nums",
            variantStyles[variant]
          )}
        >
          {value}
        </span>
      </div>
    </div>
  );
};

export default function StatsBar({ stats }) {
  if (!stats) return null;

  const todayPnL = stats.todayPnL || stats.today_pnl || 0;
  const winRate = stats.winRate || stats.win_rate || 0;
  const openTrades = stats.openTrades || stats.open_trades || 0;
  const signalsToday = stats.signalsToday || stats.signals_today || 0;

  const pnlVariant = todayPnL >= 0 ? "profit" : "loss";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatItem
        label="Today's P&L"
        value={`${todayPnL >= 0 ? "+" : ""}$${Math.abs(todayPnL).toFixed(2)}`}
        variant={pnlVariant}
      />
      <StatItem
        label="Win Rate"
        value={`${winRate.toFixed(1)}%`}
        variant="neutral"
      />
      <StatItem
        label="Open Trades"
        value={openTrades.toString()}
        variant="neutral"
      />
      <StatItem
        label="Signals Today"
        value={signalsToday.toString()}
        variant="neutral"
      />
    </div>
  );
}
