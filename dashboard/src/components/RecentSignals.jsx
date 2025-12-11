import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  XCircle,
  RefreshCw,
  CheckCircle,
  Clock,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  pending_confirmation: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rejected: "bg-muted text-foreground-muted border-border",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  skipped: "bg-warning/10 text-warning border-warning/20",
};

const SignalCard = ({ signal, onCorrect, onConfirm, onReject }) => {
  const status = signal.status?.toLowerCase() || "pending";
  const price = signal.price || signal.entryPrice || "--";
  const [isLoading, setIsLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  // Lot size selection state
  const [lotPresets, setLotPresets] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [customLot, setCustomLot] = useState("");
  const [lastTradeLot, setLastTradeLot] = useState(null);
  const { fetchData } = useApi();

  // Check if there's a suggested correction in warnings
  const suggestedCorrection = signal.warnings
    ?.find((w) => w.startsWith("Suggested correction:"))
    ?.match(/Change to (BUY|SELL)/)?.[1];
  const canCorrect =
    (status === "skipped" || status === "failed") &&
    signal.symbol &&
    !actionResult;
  const isPendingConfirmation = status === "pending_confirmation" && !actionResult;

  // Fetch lot presets when signal is pending confirmation
  useEffect(() => {
    if (isPendingConfirmation && !lotPresets) {
      fetchLotPresets();
      fetchLastTradeLot();
    }
  }, [isPendingConfirmation]);

  const fetchLotPresets = async () => {
    try {
      // Pass the symbol to get symbol-specific lot presets (GOLD=0.04, others=0.01 on £500)
      const symbolParam = signal.symbol ? `?symbol=${encodeURIComponent(signal.symbol)}` : "";
      const data = await fetchData(`/account/lot-presets${symbolParam}`);
      if (data) {
        setLotPresets(data);
        setSelectedLot(data.medium_lot);
      }
    } catch (error) {
      console.error("Failed to fetch lot presets:", error);
    }
  };

  const fetchLastTradeLot = async () => {
    try {
      const data = await fetchData("/account/last-trade-lot");
      if (data?.lot_size) {
        setLastTradeLot(data);
      }
    } catch (error) {
      console.error("Failed to fetch last trade lot:", error);
    }
  };

  const handleCorrect = async (newDirection) => {
    if (!signal.id || !onCorrect) return;
    setIsLoading(true);
    setActionResult(null);
    try {
      const result = await onCorrect(signal.id, newDirection);
      setActionResult(result);
    } catch (error) {
      setActionResult({
        status: "error",
        message: error.message || "Failed to correct",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!signal.id || !onConfirm) return;
    setIsLoading(true);
    setActionResult(null);
    try {
      // Use custom lot if entered, otherwise use selected preset
      const lotToUse = customLot ? parseFloat(customLot) : selectedLot;
      const result = await onConfirm(signal.id, lotToUse);
      setActionResult(result);
    } catch (error) {
      setActionResult({
        status: "error",
        message: error.message || "Failed to confirm",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!signal.id || !onReject) return;
    setIsLoading(true);
    setActionResult(null);
    try {
      const result = await onReject(signal.id);
      setActionResult({ status: "rejected", message: "Signal rejected" });
    } catch (error) {
      setActionResult({
        status: "error",
        message: error.message || "Failed to reject",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "p-3 rounded-lg border bg-black/20 space-y-3",
        isPendingConfirmation
          ? "border-blue-500/50 ring-1 ring-blue-500/20"
          : "border-white/5"
      )}
    >
      {/* Row 1: Symbol, Type, Status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            {signal.symbol || "--"}
          </span>
          {signal.type && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs",
                signal.type === "BUY" ? "text-success" : "text-destructive"
              )}
            >
              {signal.type === "BUY" ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}
              {signal.type}
            </span>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-xs capitalize",
            statusStyles[status] || statusStyles.pending
          )}
        >
          {signal.status || "pending"}
        </Badge>
      </div>

      {/* Row 2: Channel + Time */}
      <div className="flex items-center justify-between text-xs text-foreground-muted">
        <span className="truncate max-w-[60%]">
          {signal.channelName || "Unknown Channel"}
        </span>
        <span className="font-mono shrink-0">
          {formatTime(signal.timestamp)}
        </span>
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
          <span className="font-mono text-foreground">
            {signal.stopLoss || "--"}
          </span>
        </div>
        <div>
          <span className="text-foreground-muted">TPs: </span>
          <span className="font-mono text-foreground">
            {signal.takeProfits?.length || 0}
          </span>
        </div>
        {signal.confidence !== undefined && signal.confidence !== null && (
          <div>
            <span className="text-foreground-muted">Confidence: </span>
            <span
              className={cn(
                "font-mono",
                signal.confidence >= 0.8
                  ? "text-success"
                  : signal.confidence >= 0.6
                  ? "text-warning"
                  : "text-destructive"
              )}
            >
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
        <div
          className={cn(
            "p-2 rounded border space-y-1",
            status === "skipped"
              ? "bg-warning/10 border-warning/20"
              : "bg-destructive/10 border-destructive/20"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1.5",
              status === "skipped" ? "text-warning" : "text-destructive"
            )}
          >
            <XCircle size={12} />
            <span className="text-xs font-medium">
              {status === "skipped" ? "Skipped" : "Failed"}
            </span>
          </div>
          <p
            className={cn(
              "text-xs pl-4",
              status === "skipped" ? "text-warning" : "text-destructive"
            )}
          >
            {signal.failureReason}
          </p>
        </div>
      )}

      {/* Row 7: Confirmation Actions with Lot Size Selection */}
      {isPendingConfirmation && (
        <div className="p-3 rounded border bg-blue-500/10 border-blue-500/20 space-y-3">
          <div className="flex items-center gap-1.5 text-blue-400">
            <Clock size={12} />
            <span className="text-xs font-medium">Awaiting Confirmation</span>
          </div>

          {/* Lot Size Selection */}
          {lotPresets && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">Lot Size:</span>
                <span className="text-xs font-mono text-foreground">
                  {customLot || selectedLot || lotPresets.medium_lot}
                </span>
              </div>

              {/* Preset Buttons */}
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={selectedLot === lotPresets.low_lot && !customLot ? "default" : "outline"}
                  className="h-6 text-[10px] flex-1 px-1"
                  onClick={() => { setSelectedLot(lotPresets.low_lot); setCustomLot(""); }}
                >
                  Low ({lotPresets.low_lot})
                </Button>
                <Button
                  size="sm"
                  variant={selectedLot === lotPresets.medium_lot && !customLot ? "default" : "outline"}
                  className="h-6 text-[10px] flex-1 px-1"
                  onClick={() => { setSelectedLot(lotPresets.medium_lot); setCustomLot(""); }}
                >
                  Med ({lotPresets.medium_lot})
                </Button>
                <Button
                  size="sm"
                  variant={selectedLot === lotPresets.high_lot && !customLot ? "default" : "outline"}
                  className="h-6 text-[10px] flex-1 px-1"
                  onClick={() => { setSelectedLot(lotPresets.high_lot); setCustomLot(""); }}
                >
                  High ({lotPresets.high_lot})
                </Button>
              </div>

              {/* Custom Input and Last Trade */}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Custom"
                  className="h-6 text-xs flex-1 bg-background/50"
                  value={customLot}
                  onChange={(e) => setCustomLot(e.target.value)}
                />
                {lastTradeLot?.lot_size && (
                  <Button
                    size="sm"
                    variant={selectedLot === lastTradeLot.lot_size && !customLot ? "default" : "outline"}
                    className="h-6 text-[10px] px-2"
                    onClick={() => { setSelectedLot(lastTradeLot.lot_size); setCustomLot(""); }}
                  >
                    Last ({lastTradeLot.lot_size})
                  </Button>
                )}
              </div>

              <div className="text-[10px] text-foreground-muted">
                Balance: {lotPresets.balance?.toFixed(2)} | Base: {lotPresets.base_lot}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-success border-success/30 hover:bg-success/10 gap-1 flex-1"
              onClick={handleConfirm}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <CheckCircle size={12} />
              )}
              Accept Trade
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
              onClick={handleReject}
              disabled={isLoading}
            >
              <XCircle size={12} />
              Reject
            </Button>
          </div>
        </div>
      )}

      {/* Row 8: Correction Actions */}
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
              <RefreshCw
                size={12}
                className={isLoading ? "animate-spin" : ""}
              />
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

      {/* Row 9: Action Result */}
      {actionResult && (
        <div
          className={cn(
            "p-2 rounded border text-xs",
            actionResult.executed || actionResult.status === "executed"
              ? "bg-success/10 border-success/20 text-success"
              : actionResult.status === "rejected"
              ? "bg-muted border-border text-foreground-muted"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          )}
        >
          {actionResult.message ||
            (actionResult.executed
              ? "Trade executed!"
              : actionResult.status === "rejected"
              ? "Signal rejected"
              : "Action failed")}
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

export default function RecentSignals({
  signals = [],
  isLoading = false,
  onRefresh,
}) {
  const { postData } = useApi();

  const handleCorrect = async (signalId, newDirection) => {
    try {
      const response = await postData(`/signals/${signalId}/correct`, {
        new_direction: newDirection,
      });
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

  const handleConfirm = async (signalId, lotSize = null) => {
    try {
      const body = lotSize ? { lot_size: lotSize } : {};
      const response = await postData(`/signals/${signalId}/confirm`, body);
      console.log("Confirm response:", response);
      if (onRefresh) onRefresh();
      return response;
    } catch (error) {
      console.error("Failed to confirm signal:", error);
      throw error;
    }
  };

  const handleReject = async (signalId) => {
    try {
      const response = await postData(`/signals/${signalId}/reject`, {
        reason: "Manually rejected from dashboard",
      });
      console.log("Reject response:", response);
      if (onRefresh) onRefresh();
      return response;
    } catch (error) {
      console.error("Failed to reject signal:", error);
      throw error;
    }
  };

  return (
    <Card className="glass-card h-full flex flex-col border-0">
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
                  onConfirm={handleConfirm}
                  onReject={handleReject}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
