import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

const MetricCard = ({ label, value }) => (
  <div className="p-4 glass-card">
    <p className="text-xs text-foreground-muted mb-1">{label}</p>
    <p className="text-xl font-semibold font-mono tabular-nums text-foreground">
      {value}
    </p>
  </div>
);

export default function AccountCard({ account, openTrades = [] }) {
  const { balance, margin, freeMargin } = account;
  const { format } = useCurrency();

  // Calculate equity in real-time from balance + open P&L for instant updates
  const openPnL = openTrades.reduce(
    (sum, t) => sum + (t.profit || t.unrealizedPnL || 0),
    0
  );
  const realTimeEquity = balance + openPnL;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <MetricCard label="Balance" value={format(balance)} />
      <MetricCard label="Equity" value={format(realTimeEquity)} />
      <MetricCard label="Free Margin" value={format(freeMargin)} />
      <MetricCard label="Used Margin" value={format(margin)} />
    </div>
  );
}
