import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";

const formatTime = (timestamp) => {
  if (!timestamp) return "--:--";
  const date = new Date(timestamp);
  return isValid(date) ? format(date, "HH:mm") : "--:--";
};

const statusStyles = {
  executed: "bg-success/10 text-success border-success/20",
  validated: "bg-success/10 text-success border-success/20",
  pending: "bg-muted text-foreground-muted border-border",
  received: "bg-muted text-foreground-muted border-border",
  parsed: "bg-muted text-foreground-muted border-border",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  skipped: "bg-warning/10 text-warning border-warning/20",
};

const SignalCard = ({ signal, onCorrect }) => {
  const status = signal.status?.toLowerCase() || "pending";
  const price = signal.price || signal.entryPrice || "--";
  const [isLoading, setIsLoading] = useState(false);
  const [correctionResult, setCorrectionResult] = useState(null);

  // Check if there's a suggested correction in warnings
  const suggestedCorrection = signal.warnings?.find(w => w.startsWith("Suggested correction:"))?.match(/Change to (BUY|SELL)/)?.[1];
  const canCorrect = (status === "skipped" || status === "failed") && signal.symbol && !correctionResult;

  const handleCorrect = async (newDirection) => {
    if (!signal.id || !onCorrect) return;
    setIsLoading(true);
    setCorrectionResult(null);
    try {
      const result = await onCorrect(signal.id, newDirection);
      setCorrectionResult(result);
    } catch (error) {
      setCorrectionResult({ status: "error", message: error.message || "Failed to correct" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-3 rounded-lg border border-border bg-card/50 space-y-3">
      {/* Row 1: Symbol, Type, Status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{signal.symbol || "--"}</span>
          {signal.type && (
            <span className={cn(
              "inline-flex items-center gap-0.5 text-xs",
              signal.type === "BUY" ? "text-success" : "text-destructive"
            )}>
              {signal.type === "BUY" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {signal.type}
            </span>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn("text-xs capitalize", statusStyles[status] || statusStyles.pending)}
        >
          {signal.status || "pending"}
        </Badge>
      </div>

      {/* Row 2: Channel + Time */}
      <div className="flex items-center justify-between text-xs text-foreground-muted">
        <span className="truncate max-w-[60%]">{signal.channelName || "Unknown Channel"}</span>
        <span className="font-mono shrink-0">{formatTime(signal.timestamp)}</span>
      </div>

      {/* Row 3: Raw Message */}
      <div className="p-2 rounded bg-muted/50 border border-border">
        <p className="text-xs text-foreground-muted font-mono whitespace-pre-wrap line-clamp-4">
          {signal.rawMessage || "No message content"}
        </p>
      </div>

      {/* Row 4: Price Info */}
      <div className="flex items-center gap-4 text-xs flex-wrap">
        <div>
          <span className="text-foreground-muted">Entry: </span>
          <span className="font-mono text-foreground">{price}</span>
        </div>
        <div>
          <span className="text-foreground-muted">SL: </span>
          <span className="font-mono text-foreground">{signal.stopLoss || "--"}</span>
        </div>
        <div>
          <span className="text-foreground-muted">TPs: </span>
          <span className="font-mono text-foreground">{signal.takeProfits?.length || 0}</span>
        </div>
        {signal.confidence !== undefined && signal.confidence !== null && (
          <div>
            <span className="text-foreground-muted">Confidence: </span>
            <span className={cn(
              "font-mono",
              signal.confidence >= 0.8 ? "text-success" :
              signal.confidence >= 0.6 ? "text-warning" :
              "text-destructive"
            )}>
              {(signal.confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {/* Row 5: Warnings (if any) */}
      {signal.warnings && signal.warnings.length > 0 && (
        <div className="p-2 rounded border bg-warning/10 border-warning/20 space-y-1">
          <div className="flex items-center gap-1.5 text-warning">
            <AlertTriangle size={12} />
            <span className="text-xs font-medium">Warnings</span>
          </div>
          {signal.warnings.map((warning, idx) => (
            <p key={idx} className="text-xs text-warning pl-4">
              • {warning}
            </p>
          ))}
        </div>
      )}

      {/* Row 6: Failure/Skip Reason */}
      {signal.failureReason && (
        <div className={cn(
          "p-2 rounded border space-y-1",
          status === "skipped"
            ? "bg-warning/10 border-warning/20"
            : "bg-destructive/10 border-destructive/20"
        )}>
          <div className={cn(
            "flex items-center gap-1.5",
            status === "skipped" ? "text-warning" : "text-destructive"
          )}>
            <XCircle size={12} />
            <span className="text-xs font-medium">
              {status === "skipped" ? "Skipped" : "Failed"}
            </span>
          </div>
          <p className={cn(
            "text-xs pl-4",
            status === "skipped" ? "text-warning" : "text-destructive"
          )}>
            {signal.failureReason}
          </p>
        </div>
      )}

      {/* Row 7: Correction Actions */}
      {canCorrect && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-foreground-muted">Correct to:</span>
          {suggestedCorrection ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => handleCorrect(suggestedCorrection)}
              disabled={isLoading}
            >
              <RefreshCw size={12} className={isLoading ? "animate-spin" : ""} />
              {suggestedCorrection} (Suggested)
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                onClick={() => handleCorrect("BUY")}
                disabled={isLoading}
              >
                <ArrowUpRight size={12} />
                BUY
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => handleCorrect("SELL")}
                disabled={isLoading}
              >
                <ArrowDownRight size={12} />
                SELL
              </Button>
            </>
          )}
        </div>
      )}

      {/* Row 8: Correction Result */}
      {correctionResult && (
        <div className={cn(
          "p-2 rounded border text-xs",
          correctionResult.executed || correctionResult.status === "executed"
            ? "bg-success/10 border-success/20 text-success"
            : "bg-destructive/10 border-destructive/20 text-destructive"
        )}>
          {correctionResult.message || (correctionResult.executed ? "Trade executed!" : "Correction failed")}
        </div>
      )}
    </div>
  );
};

const SignalCardSkeleton = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="p-3 rounded-lg border border-border space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-16 w-full rounded" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    ))}
  </>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-40 text-foreground-muted">
    <p className="text-sm">No signals yet</p>
  </div>
);

export default function RecentSignals({ signals = [], isLoading = false, onRefresh }) {
  const { postData } = useApi();

  const handleCorrect = async (signalId, newDirection) => {
    try {
      const response = await postData(`/signals/${signalId}/correct`, { new_direction: newDirection });
      console.log("Correction response:", response);
      // Refresh signals list after correction
      if (onRefresh) onRefresh();
      // Return result so SignalCard can show feedback
      return response;
    } catch (error) {
      console.error("Failed to correct signal:", error);
      throw error;
    }
  };

  return (
    <Card className="bg-card border border-border h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-foreground">
          Recent Signals
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {signals.length}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-[500px]">
          <div className="space-y-3 p-4">
            {isLoading ? (
              <SignalCardSkeleton count={3} />
            ) : signals.length === 0 ? (
              <EmptyState />
            ) : (
              signals.map((signal, idx) => (
                <SignalCard
                  key={signal.id || idx}
                  signal={signal}
                  onCorrect={handleCorrect}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
