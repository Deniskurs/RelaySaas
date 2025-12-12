import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

const PositionRow = ({ trade, formatAmount }) => {
  const isProfit = (trade.profit || 0) >= 0;
  // Case-insensitive check for buy type
  const isBuy = trade.type?.toString().toUpperCase() === "BUY";
  // Transformer maps volume to 'size'
  const lotSize = trade.size || trade.volume || trade.lots || 0;

  return (
    <div className="group flex items-center justify-between p-3 border-b border-border/40 hover:bg-white/[0.02] transition-colors last:border-0">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/5",
            isBuy ? "text-emerald-500" : "text-rose-500"
          )}
        >
          {isBuy ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground">
              {trade.symbol}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium uppercase tracking-wider",
                isBuy ? "text-emerald-500" : "text-rose-500"
              )}
            >
              {trade.type}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground-muted font-mono">
            <span>{lotSize.toFixed(2)} lots</span>
            <span className="text-foreground-subtle/50">•</span>
            <span>{trade.openPrice?.toFixed(5)}</span>
          </div>
        </div>
      </div>

      <div className="text-right">
        <div
          className={cn(
            "font-mono text-sm font-medium",
            isProfit ? "text-emerald-500" : "text-rose-500"
          )}
        >
          {isProfit ? "+" : ""}
          {formatAmount(trade.profit || 0)}
        </div>
        <div className="text-[10px] text-foreground-muted font-mono mt-0.5">
          {trade.currentPrice?.toFixed(5)}
        </div>
      </div>
    </div>
  );
};

export default function OpenPositions({
  trades = [],
  isLoading = false,
  fullPage = false,
}) {
  const { format: formatAmount } = useCurrency();
  const totalPnL = trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
  const isTotalProfit = totalPnL >= 0;

  return (
    <Card
      className={cn(
        "glass-card border-border/40 bg-black/40 flex flex-col shadow-none",
        fullPage ? "h-full" : "h-full"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-foreground/90 font-sans tracking-tight">
            Open Positions
          </CardTitle>
          <Badge
            variant="secondary"
            className="bg-white/5 hover:bg-white/10 text-foreground-muted font-mono text-[10px]"
          >
            {trades.length}
          </Badge>
        </div>

        {trades.length > 0 && (
          <div
            className={cn(
              "text-xs font-mono font-medium px-2 py-1 rounded-none bg-white/5 border border-white/5",
              isTotalProfit ? "text-emerald-500" : "text-rose-500"
            )}
          >
            {isTotalProfit ? "+" : ""}
            {formatAmount(totalPnL)}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea
          className={cn(fullPage ? "h-[calc(100vh-200px)]" : "h-[500px]")}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-foreground-muted" />
            </div>
          ) : trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-foreground-muted">
              <TrendingUp className="h-8 w-8 text-foreground-subtle mb-2 opacity-20" />
              <p className="text-xs">No open positions</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {trades.map((trade, index) => (
                <PositionRow
                  key={trade.id || index}
                  trade={trade}
                  formatAmount={formatAmount}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
