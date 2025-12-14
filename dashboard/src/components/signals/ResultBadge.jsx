import { CheckCircle, XCircle, AlertTriangle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ResultBadge - Displays the final result status of a completed signal
 *
 * Used in collapsed card view to show execution result at a glance
 */
const resultConfig = {
  executed: {
    icon: CheckCircle,
    text: "Executed",
    className: "bg-success/10 text-success border-success/20",
  },
  rejected: {
    icon: XCircle,
    text: "Rejected",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  failed: {
    icon: AlertTriangle,
    text: "Failed",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  skipped: {
    icon: SkipForward,
    text: "Skipped",
    className: "bg-warning/10 text-warning border-warning/20",
  },
};

export default function ResultBadge({ status, size = "default" }) {
  const config = resultConfig[status?.toLowerCase()];

  if (!config) return null;

  const Icon = config.icon;
  const isSmall = size === "sm";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 border font-medium",
        config.className,
        isSmall
          ? "px-2 py-0.5 text-[9px]"
          : "px-2.5 py-1 text-[11px]"
      )}
    >
      <Icon size={isSmall ? 10 : 12} className="shrink-0" />
      <span>{config.text}</span>
    </div>
  );
}

/**
 * DirectionBadge - Displays BUY/SELL direction
 */
export function DirectionBadge({ type, size = "default" }) {
  const isBuy = type?.toUpperCase() === "BUY";
  const isSmall = size === "sm";

  return (
    <span
      className={cn(
        "font-bold uppercase tracking-wider bg-white/5",
        isBuy ? "text-success" : "text-destructive",
        isSmall
          ? "text-[8px] px-1 py-0.5"
          : "text-[10px] px-1.5 py-0.5"
      )}
    >
      {type}
    </span>
  );
}
