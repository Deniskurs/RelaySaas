import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function OpenPositions({ trades = [], isLoading = false, fullPage = false }) {
  const { format: formatAmount } = useCurrency();

  const formatPrice = (price) => {
    if (!price) return "-";
    return price.toFixed(5);
  };

  const formatLotSize = (size) => {
    if (!size) return "-";
    return size.toFixed(2);
  };

  if (isLoading && trades.length === 0) {
    return (
      <Card className={cn("bg-card", fullPage && "min-h-[600px]")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Open Positions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (trades.length === 0) {
    return (
      <Card className={cn("bg-card", fullPage && "min-h-[600px]")}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Open Positions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-sm">No open positions</p>
          <p className="text-muted-foreground/70 text-xs mt-1">
            Positions will appear here when trades are opened
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate total P&L
  const totalPnL = trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);

  return (
    <Card className={cn("bg-card", fullPage && "min-h-[600px]")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Open Positions
            <Badge variant="secondary" className="ml-2">
              {trades.length}
            </Badge>
          </CardTitle>
          <div className={cn(
            "text-sm font-semibold",
            totalPnL >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {totalPnL >= 0 ? "+" : ""}{formatAmount(totalPnL)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={cn("px-6 pb-4", fullPage ? "h-[calc(100vh-280px)]" : "h-[400px]")}>
          <div className="space-y-3">
            {trades.map((trade, index) => (
              <div
                key={trade.id || index}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    trade.type === "buy" ? "bg-green-500/20" : "bg-red-500/20"
                  )}>
                    {trade.type === "buy" ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{trade.symbol}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs px-1.5 py-0",
                          trade.type === "buy"
                            ? "border-green-500/50 text-green-500"
                            : "border-red-500/50 text-red-500"
                        )}
                      >
                        {trade.type?.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{formatLotSize(trade.volume)} lots</span>
                      <span className="text-muted-foreground/50">@</span>
                      <span>{formatPrice(trade.openPrice)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    "font-semibold text-sm",
                    (trade.profit || 0) >= 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {(trade.profit || 0) >= 0 ? "+" : ""}{formatAmount(trade.profit || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {trade.currentPrice ? formatPrice(trade.currentPrice) : "-"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
