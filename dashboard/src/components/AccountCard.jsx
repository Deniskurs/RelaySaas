import { cn } from "@/lib/utils";

const formatCurrency = (val) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(val);

const MetricCard = ({ label, value }) => (
  <div className="p-4 glass-card">
    <p className="text-xs text-foreground-muted mb-1">{label}</p>
    <p className="text-xl font-semibold font-mono tabular-nums text-foreground">
      {value}
    </p>
  </div>
);

export default function AccountCard({ account }) {
  const { balance, equity, margin, freeMargin } = account;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <MetricCard label="Balance" value={formatCurrency(balance)} />
      <MetricCard label="Equity" value={formatCurrency(equity)} />
      <MetricCard label="Free Margin" value={formatCurrency(freeMargin)} />
      <MetricCard label="Used Margin" value={formatCurrency(margin)} />
    </div>
  );
}
