import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrency } from "@/contexts/CurrencyContext";

/**
 * Get computed color from CSS variable
 * Converts HSL CSS variables to hex for use with Recharts
 */
const getComputedColor = (cssVar) => {
  if (typeof window === 'undefined') return '#888888';

  const root = document.documentElement;
  const style = getComputedStyle(root);
  const hslValue = style.getPropertyValue(cssVar).trim();

  if (!hslValue) return '#888888';

  // Parse HSL values (format: "142 71% 45%")
  const [h, s, l] = hslValue.split(' ').map((v, i) =>
    i === 0 ? parseFloat(v) : parseFloat(v.replace('%', '')) / 100
  );

  // Convert HSL to RGB
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };

  const r = Math.round(f(0) * 255);
  const g = Math.round(f(8) * 255);
  const b = Math.round(f(4) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

// Hook to get colors from CSS variables (updates on theme change)
const useChartColors = () => {
  const [colors, setColors] = useState({
    success: '#10b981',
    destructive: '#f43f5e',
    primary: '#3b82f6',
    warning: '#eab308',
    muted: '#71717a',
  });

  useEffect(() => {
    const updateColors = () => {
      setColors({
        success: getComputedColor('--success'),
        destructive: getComputedColor('--destructive'),
        primary: getComputedColor('--primary'),
        warning: getComputedColor('--warning'),
        muted: getComputedColor('--muted'),
      });
    };

    updateColors();

    // Listen for potential theme changes
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => observer.disconnect();
  }, []);

  return colors;
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-none px-2 py-1 text-xs shadow-xl">
        <p className="font-medium text-white">{data.name}</p>
        <p className="text-white/70">{data.value} trades</p>
      </div>
    );
  }
  return null;
};

const StatRow = ({ label, value, color }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
    <div className="flex items-center gap-2">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-foreground-muted">{label}</span>
    </div>
    <span className="text-sm font-mono text-foreground font-medium">
      {value}
    </span>
  </div>
);

export default function PerformanceChart({ stats, isLoading = false }) {
  const { formatPnL } = useCurrency();
  const COLORS = useChartColors();

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
    ].filter((d) => d.value > 0);
  };

  const tradeData = getTradeData();
  const closedTrades = (stats?.winningTrades || 0) + (stats?.losingTrades || 0);
  const winRate =
    closedTrades > 0 ? ((stats?.winningTrades || 0) / closedTrades) * 100 : 0;
  const totalProfit = stats?.totalProfit || 0;

  return (
    <Card className="glass-card border-border/40 bg-black/40 shadow-none">
      <CardHeader className="py-3 px-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-foreground/90 font-sans tracking-tight">
            Performance
          </CardTitle>
          {stats && (
            <div
              className={cn(
                "text-sm font-mono font-medium",
                totalProfit >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatPnL(totalProfit)}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-[160px]">
            <div className="w-24 h-24 rounded-full border-4 border-white/5 border-t-success/50 animate-spin" />
          </div>
        ) : !stats ? (
          <div className="flex items-center justify-center h-[160px] text-foreground-muted text-sm">
            Loading stats...
          </div>
        ) : tradeData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[160px] text-foreground-muted">
            <p className="text-xs">No trades yet</p>
            <p className="text-[10px] mt-1 opacity-50">
              {stats.totalSignals || 0} signals received
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8 items-center">
            <div className="h-[160px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tradeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {tradeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: "transparent" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-2xl font-bold text-foreground font-mono">
                  {winRate.toFixed(0)}%
                </span>
                <span className="text-[10px] text-foreground-muted uppercase tracking-wider">
                  Win Rate
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <StatRow
                label="Winning"
                value={stats.winningTrades || 0}
                color={COLORS.success}
              />
              <StatRow
                label="Losing"
                value={stats.losingTrades || 0}
                color={COLORS.destructive}
              />
              <StatRow
                label="Open"
                value={stats.openTrades || 0}
                color={COLORS.primary}
              />
              <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-foreground-muted">
                  Total Trades
                </span>
                <span className="text-sm font-mono text-foreground">
                  {stats.totalTrades || 0}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
