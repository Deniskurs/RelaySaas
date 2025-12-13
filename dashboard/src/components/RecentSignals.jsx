import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Settings,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/useApi";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useRefresh } from "@/hooks/useRefresh";

const formatTime = (timestamp) => {
  if (!timestamp) return "--:--";
  const date = new Date(timestamp);
  return isValid(date) ? format(date, "HH:mm") : "--:--";
};

/**
 * StatusBadge - Enhanced signal status indicator with icons
 *
 * Features:
 * - Larger, more visible badges
 * - Semantic icons for each state
 * - Distinct colors (no duplicates)
 * - Screen reader support
 * - Design tokens instead of hardcoded colors
 */
const StatusBadge = ({ status }) => {
  const statusConfig = {
    executed: {
      icon: CheckCircle,
      bg: "bg-success/10",
      text: "text-success",
      border: "border-success/20",
      label: "Executed",
    },
    validated: {
      icon: CheckCircle,
      bg: "bg-primary/10",
      text: "text-primary",
      border: "border-primary/20",
      label: "Validated",
    },
    pending: {
      icon: Clock,
      bg: "bg-warning/10",
      text: "text-warning",
      border: "border-warning/20",
      label: "Pending",
    },
    pending_confirmation: {
      icon: AlertTriangle,
      bg: "bg-primary/10",
      text: "text-primary",
      border: "border-primary/20",
      label: "Awaiting",
      pulse: true,
    },
    rejected: {
      icon: XCircle,
      bg: "bg-destructive/10",
      text: "text-destructive",
      border: "border-destructive/20",
      label: "Rejected",
    },
    failed: {
      icon: XCircle,
      bg: "bg-destructive/15",
      text: "text-destructive",
      border: "border-destructive/30",
      label: "Failed",
    },
    skipped: {
      icon: AlertTriangle,
      bg: "bg-warning/10",
      text: "text-warning",
      border: "border-warning/20",
      label: "Skipped",
    },
    received: {
      icon: Clock,
      bg: "bg-muted/50",
      text: "text-foreground-muted",
      border: "border-muted",
      label: "Received",
    },
  };

  const config = statusConfig[status?.toLowerCase()] || statusConfig.received;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-none border text-[10px] font-medium uppercase tracking-wider",
        config.bg,
        config.text,
        config.border,
        config.pulse && "animate-pulse"
      )}
    >
      <Icon size={12} className="shrink-0" />
      <span>{config.label}</span>
      {/* Screen reader only - full status */}
      <span className="sr-only">Signal status: {config.label}</span>
    </div>
  );
};

// Legacy StatusDot for backward compatibility (smaller variant)
const StatusDot = ({ status }) => {
  const colorMap = {
    executed: "bg-success",
    validated: "bg-primary",
    pending: "bg-warning",
    pending_confirmation: "bg-primary",
    rejected: "bg-destructive",
    failed: "bg-destructive",
    skipped: "bg-warning",
    received: "bg-muted-foreground",
  };

  return (
    <div
      className={cn(
        "w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.3)]",
        colorMap[status?.toLowerCase()] || "bg-muted-foreground"
      )}
      aria-hidden="true"
    />
  );
};

// Telegram connection status indicator
const ConnectionIndicator = ({ status, onReconnect, isReconnecting: propIsReconnecting, onNavigateSettings }) => {
  if (!status) return null;

  const { connected, reconnecting, last_activity, last_health_check, channels_count, reconnect_attempts } = status;

  // Use refresh hook for better UX feedback
  const { isRefreshing: isRefreshingConnection, refresh: refreshConnection } = useRefresh({
    loadingMessage: "Reconnecting to Telegram...",
    successMessage: "Telegram connection refreshed",
    errorMessage: "Failed to reconnect to Telegram",
  });

  // Calculate time since timestamp
  const getTimeAgo = (timestamp) => {
    if (!timestamp) return null;
    const lastTime = new Date(timestamp);
    const now = new Date();
    const diffMs = now - lastTime;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);

    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return format(lastTime, "MMM d");
  };

  const lastActivity = getTimeAgo(last_activity);
  const lastHealthCheck = getTimeAgo(last_health_check);

  // Use design tokens instead of hardcoded colors
  const statusConfig = reconnecting
    ? {
        color: "bg-warning",
        pulseColor: "bg-warning/70",
        icon: RefreshCw,
        text: reconnect_attempts > 0 ? `Reconnecting (${reconnect_attempts})...` : "Reconnecting...",
        textColor: "text-warning",
      }
    : connected
    ? {
        color: "bg-success",
        pulseColor: "bg-success/70",
        icon: Wifi,
        text: `Live${channels_count > 0 ? ` · ${channels_count}ch` : ""}`,
        textColor: "text-success",
      }
    : {
        color: "bg-destructive",
        pulseColor: "bg-destructive/70",
        icon: WifiOff,
        text: "Disconnected",
        textColor: "text-destructive",
      };

  const Icon = statusConfig.icon;

  return (
    <div className="flex items-center gap-2">
      {/* Animated status dot */}
      <div className="relative flex items-center justify-center">
        {(connected || reconnecting) && (
          <span
            className={cn(
              "absolute w-2 h-2 rounded-full animate-ping opacity-75",
              statusConfig.pulseColor
            )}
          />
        )}
        <span
          className={cn(
            "relative w-2 h-2 rounded-full",
            statusConfig.color,
            reconnecting && "animate-pulse"
          )}
        />
      </div>

      {/* Status text with tooltip */}
      <div className="flex items-center gap-1.5 group relative">
        <Icon
          className={cn(
            "w-3 h-3",
            statusConfig.textColor,
            reconnecting && "animate-spin"
          )}
        />
        <span className={cn("text-[10px] font-medium", statusConfig.textColor)}>
          {statusConfig.text}
        </span>

        {/* Tooltip with connection details */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/95 border border-white/10 text-white text-[10px] rounded-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
          <div className="space-y-1">
            {lastActivity && (
              <div className="flex justify-between gap-4">
                <span className="text-white/60">Last signal:</span>
                <span className="font-mono">{lastActivity}</span>
              </div>
            )}
            {lastHealthCheck && (
              <div className="flex justify-between gap-4">
                <span className="text-white/60">Health check:</span>
                <span className="font-mono text-emerald-400">{lastHealthCheck}</span>
              </div>
            )}
            {!lastActivity && !lastHealthCheck && (
              <span className="text-white/60">Waiting for activity...</span>
            )}
          </div>
        </div>
      </div>

      {/* Refresh button - always visible, larger touch target on mobile */}
      {onReconnect && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:h-6 lg:w-6 hover:bg-white/10"
          onClick={() => refreshConnection(onReconnect)}
          disabled={isRefreshingConnection || propIsReconnecting || reconnecting}
          title="Refresh Telegram connection"
          aria-label="Refresh Telegram connection"
        >
          <RefreshCw className={cn("w-4 h-4 lg:w-3 lg:h-3 text-foreground-muted", (isRefreshingConnection || propIsReconnecting || reconnecting) && "animate-spin")} />
        </Button>
      )}

      {/* Settings link - larger touch target on mobile */}
      {onNavigateSettings && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:h-6 lg:w-6 hover:bg-white/10"
          onClick={onNavigateSettings}
          title="Telegram settings"
          aria-label="Open Telegram settings"
        >
          <Settings className="w-4 h-4 lg:w-3 lg:h-3 text-foreground-muted" />
        </Button>
      )}
    </div>
  );
};

const SignalCard = ({ signal, onCorrect, onConfirm, onReject }) => {
  const status = signal.status?.toLowerCase() || "pending";
  const price = signal.price || signal.entryPrice || "--";
  const [isLoading, setIsLoading] = useState(false);

  // Lot size selection state
  const [lotPresets, setLotPresets] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const [customLot, setCustomLot] = useState("");
  const { fetchData } = useApi();
  const { format: formatCurrency } = useCurrency();

  const isPendingConfirmation = status === "pending_confirmation";

  useEffect(() => {
    if (isPendingConfirmation && !lotPresets) {
      const loadPresets = async () => {
        try {
          const symbolParam = signal.symbol
            ? `?symbol=${encodeURIComponent(signal.symbol)}`
            : "";
          const data = await fetchData(`/account/lot-presets${symbolParam}`);
          if (data) {
            setLotPresets(data);
            setSelectedLot(data.medium_lot);
          }
        } catch (e) {
          console.error(e);
        }
      };
      loadPresets();
    }
  }, [isPendingConfirmation, signal.symbol, fetchData, lotPresets]);

  const handleAction = async (actionFn, ...args) => {
    setIsLoading(true);
    try {
      await actionFn(...args);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="group rounded-none border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200 overflow-hidden">
      {/* Header Section */}
      <div className="p-4 border-b border-white/5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <StatusBadge status={status} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">
                {signal.symbol || "--"}
              </span>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-none bg-white/5",
                  signal.type === "BUY" ? "text-success" : "text-destructive"
                )}
              >
                {signal.type}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-foreground-muted font-mono">
                {formatTime(signal.timestamp)}
              </span>
              <span className="text-[10px] text-foreground-subtle">•</span>
              <span className="text-[10px] text-foreground-muted truncate max-w-[120px]">
                {signal.channelName || "Unknown"}
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono text-sm font-medium text-foreground">
            {price}
          </div>
          {signal.confidence && (
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-foreground-muted">
                Confidence:
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono",
                  signal.confidence >= 0.8
                    ? "text-success"
                    : "text-warning"
                )}
              >
                {(signal.confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Body Content */}
      <div className="p-4 space-y-3">
        {/* Raw Message */}
        <div className="bg-black/20 rounded-none p-3 border border-white/5">
          <p className="text-[11px] font-mono text-foreground-muted leading-relaxed whitespace-pre-wrap line-clamp-3 group-hover:line-clamp-none transition-all">
            {signal.rawMessage || "No message content"}
          </p>
        </div>

        {/* Warnings */}
        {signal.warnings?.length > 0 && (
          <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-none p-2.5">
            {signal.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[11px] text-yellow-500/90"
              >
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Failure Reason - Show for failed/skipped signals */}
        {signal.failureReason &&
          (status === "failed" ||
            status === "skipped" ||
            status === "rejected") && (
            <div className="bg-rose-500/5 border border-rose-500/10 rounded-none p-3">
              <div className="flex items-start gap-2">
                <XCircle size={14} className="mt-0.5 shrink-0 text-rose-400" />
                <div className="flex-1">
                  <p className="text-[10px] font-medium text-rose-400 uppercase tracking-wider mb-1">
                    Failure Reason
                  </p>
                  <p className="text-[11px] font-mono text-rose-300/80 leading-relaxed whitespace-pre-wrap">
                    {signal.failureReason}
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* Pending Confirmation Actions */}
        {isPendingConfirmation && (
          <div className="bg-blue-500/5 border border-blue-500/10 rounded-none p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-blue-400 font-medium flex items-center gap-2">
                <Clock size={14} /> Awaiting Confirmation
              </p>
              {lotPresets && (
                <div className="text-[10px] text-foreground-muted">
                  Bal: {formatCurrency(lotPresets.balance || 0)}
                </div>
              )}
            </div>

            {lotPresets ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { label: "Low", value: lotPresets.low_lot },
                  { label: "Med", value: lotPresets.medium_lot },
                  { label: "High", value: lotPresets.high_lot },
                ].map((opt) => (
                  <Button
                    key={opt.label}
                    size="sm"
                    variant={
                      selectedLot === opt.value && !customLot
                        ? "secondary"
                        : "ghost"
                    }
                    className={cn(
                      "h-6 text-[10px] px-2 border border-white/5",
                      selectedLot === opt.value && !customLot
                        ? "bg-white/10 text-foreground"
                        : "text-foreground-muted"
                    )}
                    onClick={() => {
                      setSelectedLot(opt.value);
                      setCustomLot("");
                    }}
                  >
                    {opt.label}{" "}
                    <span className="opacity-50 ml-1">({opt.value})</span>
                  </Button>
                ))}
                <div className="w-[1px] h-4 bg-white/10 mx-1" />
                <input
                  type="number"
                  className="h-6 w-16 bg-black/20 border border-white/10 rounded-none px-2 text-[10px] text-foreground font-mono focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="Lot"
                  value={customLot}
                  onChange={(e) => setCustomLot(e.target.value)}
                />
              </div>
            ) : (
              <div className="text-xs text-foreground-muted animate-pulse">
                Loading lot presets...
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20"
                onClick={() =>
                  handleAction(
                    onConfirm,
                    signal.id,
                    customLot ? parseFloat(customLot) : selectedLot
                  )
                }
                disabled={isLoading}
              >
                <CheckCircle size={14} className="mr-1.5" />
                Accept
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20"
                onClick={() => handleAction(onReject, signal.id)}
                disabled={isLoading}
              >
                <XCircle size={14} className="mr-1.5" />
                Reject
              </Button>
            </div>
          </div>
        )}

        {/* Correction Actions */}
        {(status === "skipped" || status === "failed") &&
          !isPendingConfirmation && (
            <div className="flex items-center gap-3 pt-2 border-t border-white/5">
              <span className="text-[10px] font-medium text-foreground-muted uppercase tracking-wider">
                Correction
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 border-white/10 hover:bg-white/5"
                  onClick={() => handleAction(onCorrect, signal.id, "BUY")}
                >
                  Change to BUY
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 border-white/10 hover:bg-white/5"
                  onClick={() => handleAction(onCorrect, signal.id, "SELL")}
                >
                  Change to SELL
                </Button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default function RecentSignals({
  signals = [],
  isLoading = false,
  onRefresh,
  telegramStatus = null,
  onReconnect = null,
  isReconnecting = false,
  onNavigateSettings = null,
}) {
  const { postData } = useApi();

  const handleCorrect = async (signalId, newDirection) => {
    await postData(`/signals/${signalId}/correct`, {
      new_direction: newDirection,
    });
    if (onRefresh) onRefresh();
  };

  const handleConfirm = async (signalId, lotSize) => {
    await postData(
      `/signals/${signalId}/confirm`,
      lotSize ? { lot_size: lotSize } : {}
    );
    if (onRefresh) onRefresh();
  };

  const handleReject = async (signalId) => {
    await postData(`/signals/${signalId}/reject`, {
      reason: "Manual rejection",
    });
    if (onRefresh) onRefresh();
  };

  return (
    <Card className="glass-card border-border/40 bg-black/40 h-full flex flex-col shadow-none">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-medium text-foreground/90 font-sans tracking-tight">
            Recent Signals
          </CardTitle>
          <ConnectionIndicator
            status={telegramStatus}
            onReconnect={onReconnect}
            isReconnecting={isReconnecting}
            onNavigateSettings={onNavigateSettings}
          />
        </div>
        <Badge
          variant="secondary"
          className="bg-white/5 hover:bg-white/10 text-foreground-muted font-mono text-[10px]"
        >
          {signals.length}
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-[500px]">
          <div className="flex flex-col">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full bg-white/5" />
                ))}
              </div>
            ) : signals.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-foreground-muted text-xs">
                No signals yet
              </div>
            ) : (
              signals.map((signal) => (
                <SignalCard
                  key={signal.id}
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
