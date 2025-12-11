import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TableSkeleton = ({ rows = 3 }) => (
  <>
    {Array.from({ length: rows }).map((_, idx) => (
      <TableRow key={idx}>
        <TableCell>
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-10" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-10" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-14" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-14" />
        </TableCell>
        <TableCell className="text-right">
          <Skeleton className="h-4 w-12 ml-auto" />
        </TableCell>
      </TableRow>
    ))}
  </>
);

export default function OpenPositions({ trades = [], isLoading = false }) {
  return (
    <Card className="glass-card h-full flex flex-col border-0">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-foreground">
          Open Positions
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {trades.length}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-xs text-foreground-muted">
                  Symbol
                </TableHead>
                <TableHead className="text-xs text-foreground-muted">
                  Type
                </TableHead>
                <TableHead className="text-xs text-foreground-muted">
                  Size
                </TableHead>
                <TableHead className="text-xs text-foreground-muted">
                  Entry
                </TableHead>
                <TableHead className="text-xs text-foreground-muted">
                  Current
                </TableHead>
                <TableHead className="text-xs text-foreground-muted text-right">
                  P&L
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={3} />
              ) : trades.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-foreground-muted text-sm"
                  >
                    No open positions
                  </TableCell>
                </TableRow>
              ) : (
                trades.map((trade, idx) => {
                  const entryPrice = trade.entryPrice || trade.openPrice || 0;
                  const currentPrice = trade.currentPrice || entryPrice;
                  const profit = trade.profit ?? 0;
                  const lotSize = trade.size || trade.lotSize || 0;

                  return (
                    <TableRow key={trade.id || idx} className="border-border">
                      <TableCell className="font-medium text-foreground">
                        {trade.symbol || "--"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs",
                            trade.type === "BUY"
                              ? "text-success"
                              : "text-destructive"
                          )}
                        >
                          {trade.type === "BUY" ? (
                            <ArrowUpRight size={12} />
                          ) : (
                            <ArrowDownRight size={12} />
                          )}
                          {trade.type || "--"}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground-muted">
                        {lotSize}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground-muted">
                        {entryPrice || "--"}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-foreground">
                        {currentPrice || "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "font-mono text-sm font-medium",
                            profit >= 0 ? "text-success" : "text-destructive"
                          )}
                        >
                          {profit >= 0 ? "+" : ""}${Math.abs(profit).toFixed(2)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
