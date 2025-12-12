import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  WifiOff,
  X,
  RefreshCw,
  Settings,
  TrendingDown,
  CheckCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * AlertBanner - Critical event notification system
 *
 * Displays sticky alerts for events that require immediate attention:
 * - Telegram disconnection
 * - MT5 disconnection
 * - High margin usage (>80%)
 * - Signal execution failures
 */

const ALERT_CONFIG = {
  telegram_disconnected: {
    icon: WifiOff,
    level: "critical",
    priority: 100,
    title: "Telegram Connection Lost",
    message: "No new signals will be received. Reconnect immediately.",
    dismissible: false,
  },
  mt5_disconnected: {
    icon: WifiOff,
    level: "critical",
    priority: 95,
    title: "MetaTrader 5 Disconnected",
    message: "Trades cannot be executed. Check your MT5 connection.",
    dismissible: false,
  },
  high_margin: {
    icon: AlertTriangle,
    level: "critical",
    priority: 90,
    title: "High Margin Usage",
    message: "Risk of margin call. Consider closing some positions.",
    dismissible: true,
  },
  signal_failed: {
    icon: TrendingDown,
    level: "warning",
    priority: 70,
    title: "Signal Execution Failed",
    message: "A recent signal could not be executed.",
    dismissible: true,
  },
  connection_restored: {
    icon: CheckCircle,
    level: "success",
    priority: 50,
    title: "Connection Restored",
    message: "All systems operational.",
    dismissible: true,
    autoDismiss: 5000,
  },
};

const LEVEL_STYLES = {
  critical: {
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    text: "text-destructive",
    icon: "text-destructive",
  },
  warning: {
    bg: "bg-warning/10",
    border: "border-warning/30",
    text: "text-warning",
    icon: "text-warning",
  },
  success: {
    bg: "bg-success/10",
    border: "border-success/30",
    text: "text-success",
    icon: "text-success",
  },
  info: {
    bg: "bg-primary/10",
    border: "border-primary/30",
    text: "text-primary",
    icon: "text-primary",
  },
};

export default function AlertBanner({
  alerts = [],
  onDismiss,
  onAction,
}) {
  const [dismissed, setDismissed] = useState(new Set());

  // Get the highest priority active alert
  const activeAlert = useMemo(() => {
    return alerts
      .filter(a => a.active && !dismissed.has(a.id))
      .sort((a, b) => b.priority - a.priority)[0];
  }, [alerts, dismissed]);

  // Auto-dismiss handler
  useEffect(() => {
    if (!activeAlert) return;

    const config = ALERT_CONFIG[activeAlert.type];
    if (config?.autoDismiss) {
      const timer = setTimeout(() => {
        handleDismiss(activeAlert.id);
      }, config.autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [activeAlert]);

  const handleDismiss = (alertId) => {
    setDismissed(prev => new Set([...prev, alertId]));
    onDismiss?.(alertId);
  };

  if (!activeAlert) return null;

  const config = ALERT_CONFIG[activeAlert.type] || {
    icon: Info,
    level: "info",
    title: "Alert",
    message: activeAlert.message,
    dismissible: true,
  };

  const Icon = config.icon;
  const styles = LEVEL_STYLES[config.level] || LEVEL_STYLES.info;

  return (
    <AnimatePresence>
      <motion.div
        key={activeAlert.id}
        initial={{ opacity: 0, y: -20, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -20, height: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "mb-4 rounded-none border backdrop-blur-sm overflow-hidden",
          styles.bg,
          styles.border
        )}
      >
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          {/* Icon + Content */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "shrink-0 p-2 rounded-none",
              config.level === "critical" ? "bg-destructive/20" :
              config.level === "warning" ? "bg-warning/20" :
              config.level === "success" ? "bg-success/20" :
              "bg-primary/20"
            )}>
              <Icon size={18} className={styles.icon} />
            </div>

            <div className="min-w-0">
              <p className={cn("font-semibold text-sm", styles.text)}>
                {activeAlert.title || config.title}
              </p>
              <p className="text-xs text-foreground-muted mt-0.5 truncate">
                {activeAlert.message || config.message}
                {activeAlert.details && (
                  <span className="ml-1 opacity-70">{activeAlert.details}</span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {activeAlert.actions?.map((action, i) => (
              <Button
                key={i}
                size="sm"
                variant="outline"
                onClick={() => onAction?.(action.id, activeAlert)}
                className={cn(
                  "h-8 text-xs font-medium rounded-none",
                  "border-current/30 hover:bg-current/10",
                  styles.text
                )}
              >
                {action.icon && <action.icon size={14} className="mr-1.5" />}
                {action.label}
              </Button>
            ))}

            {(config.dismissible || activeAlert.dismissible) && (
              <button
                onClick={() => handleDismiss(activeAlert.id)}
                className={cn(
                  "p-1.5 hover:bg-white/10 rounded-none transition-colors",
                  styles.text
                )}
                aria-label="Dismiss alert"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Critical alert pulse animation */}
        {config.level === "critical" && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 3, repeat: Infinity }}
            className="h-0.5 bg-destructive/50 origin-left"
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Hook to generate alerts from system state
 */
export function useAlertSystem({
  telegramStatus,
  mt5Connected = true,
  account = {},
  recentFailures = [],
}) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const newAlerts = [];

    // Telegram disconnection alert
    if (telegramStatus && !telegramStatus.connected) {
      const lastActivity = telegramStatus.last_activity
        ? new Date(telegramStatus.last_activity)
        : null;
      const minutesAgo = lastActivity
        ? Math.floor((Date.now() - lastActivity.getTime()) / 60000)
        : null;

      newAlerts.push({
        id: "telegram_disconnected",
        type: "telegram_disconnected",
        active: true,
        priority: 100,
        title: "Telegram Connection Lost",
        message: minutesAgo
          ? `Last signal ${minutesAgo}m ago. No new signals will be received.`
          : "No new signals will be received.",
        actions: [
          { id: "reconnect", label: "Reconnect", icon: RefreshCw },
          { id: "settings", label: "Settings", icon: Settings },
        ],
      });
    }

    // MT5 disconnection alert
    if (!mt5Connected) {
      newAlerts.push({
        id: "mt5_disconnected",
        type: "mt5_disconnected",
        active: true,
        priority: 95,
        actions: [
          { id: "settings", label: "Check Settings", icon: Settings },
        ],
      });
    }

    // High margin usage alert
    const marginPercent = account.equity > 0
      ? ((account.margin / account.equity) * 100)
      : 0;

    if (marginPercent > 80) {
      newAlerts.push({
        id: "high_margin",
        type: "high_margin",
        active: true,
        priority: 90,
        title: "High Margin Usage",
        message: `${marginPercent.toFixed(1)}% of equity used. Risk of margin call.`,
        dismissible: true,
      });
    }

    // Recent signal failures
    const recentFailed = recentFailures.filter(f => {
      const age = Date.now() - new Date(f.timestamp).getTime();
      return age < 5 * 60 * 1000; // Within last 5 minutes
    });

    if (recentFailed.length > 0) {
      newAlerts.push({
        id: "signal_failed",
        type: "signal_failed",
        active: true,
        priority: 70,
        title: `${recentFailed.length} Signal${recentFailed.length > 1 ? "s" : ""} Failed`,
        message: recentFailed[0].reason || "Check signal history for details.",
        dismissible: true,
        actions: [
          { id: "view_signals", label: "View Signals" },
        ],
      });
    }

    setAlerts(newAlerts);
  }, [telegramStatus, mt5Connected, account, recentFailures]);

  return { alerts };
}
