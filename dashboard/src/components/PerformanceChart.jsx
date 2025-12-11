import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/contexts/CurrencyContext";

const COLORS = {
  success: "hsl(152, 45%, 45%)",
  destructive: "hsl(0, 55%, 55%)",
  primary: "hsl(215, 20%, 55%)",
  warning: "hsl(38, 70%, 50%)",
  muted: "hsl(0, 0%, 45%)",
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-md p-2 text-xs">
        <p className="font-medium text-foreground">{data.name}</p>
        <p className="text-foreground-muted">{data.value} trades</p>
      </div>
    );
  }
  return null;
};

const StatRow = ({ label, value, color }) => (
  <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-sm text-foreground-muted">{label}</span>
    </div>
    <span className="text-sm font-mono text-foreground">{value}</span>
  </div>
);

export default function PerformanceChart({ stats, isLoading = false }) {
  const { formatPnL } = useCurrency();

  const getTradeData = () => {
    if (!stats) return [];
    const winning = stats.winningTrades || 0;
    const losing = stats.losingTrades || 0;
    const open = stats.openTrades || 0;
    const total = winning + losing + open;
    if (total === 0) return [];

    return [
      { name: "Winning", value: winning, fill: COLORS.success },
      { name: "Losing", value: losing, fill: COLORS.destructive },
      { name: "Open", value: open, fill: COLORS.primary },
    ].filter(d => d.value > 0);
  };

  const tradeData = getTradeData();
  const closedTrades = (stats?.winningTrades || 0) + (stats?.losingTrades || 0);
  const winRate = closedTrades > 0 ? ((stats?.winningTrades || 0) / closedTrades) * 100 : 0;
  const totalProfit = stats?.totalProfit || 0;
  const totalTrades = stats?.totalTrades || 0;

  return (
    <Card className="bg-card border border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground">Performance</CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="animate-pulse w-24 h-24 rounded-full bg-muted" />
          </div>
        ) : !stats ? (
          <div className="flex items-center justify-center h-[200px] text-foreground-muted text-sm">
            Loading stats...
          </div>
        ) : tradeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-foreground-muted">
            <p className="text-sm">No trades yet</p>
            <p className="text-xs mt-1">{stats.totalSignals || 0} signals received</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tradeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {tradeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col justify-center">
              <StatRow label="Winning" value={stats.winningTrades || 0} color={COLORS.success} />
              <StatRow label="Losing" value={stats.losingTrades || 0} color={COLORS.destructive} />
              <StatRow label="Open" value={stats.openTrades || 0} color={COLORS.primary} />
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground-muted">Win Rate</span>
                  <span className="text-sm font-semibold font-mono text-foreground">
                    {winRate.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground-muted">Total P&L</span>
                  <span className={cn(
                    "text-sm font-semibold font-mono",
                    totalProfit >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {formatPnL(totalProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
