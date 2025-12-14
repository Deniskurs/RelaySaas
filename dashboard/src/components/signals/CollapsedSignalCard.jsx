import { motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import { format, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import ResultBadge, { DirectionBadge } from "./ResultBadge";

/**
 * CollapsedSignalCard - Minimal view for completed signals
 *
 * 64px height showing: symbol, direction, result, timestamp, expand/dismiss buttons
 */

const formatTime = (timestamp) => {
  if (!timestamp) return "--:--";
  const date = new Date(timestamp);
  return isValid(date) ? format(date, "HH:mm") : "--:--";
};

// Color bar based on status
const statusColors = {
  executed: "bg-success",
  rejected: "bg-destructive",
  failed: "bg-destructive",
  skipped: "bg-warning",
};

export default function CollapsedSignalCard({
  signal,
  onExpand,
  onDismiss,
}) {
  const status = signal.status?.toLowerCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 0.6 }}
      whileHover={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="group"
    >
      <div className="flex items-center justify-between px-4 py-3 border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors">
        {/* Left: Color bar + Symbol + Direction */}
        <div className="flex items-center gap-3">
          {/* Status color bar */}
          <div
            className={cn(
              "w-1 h-8 rounded-full",
              statusColors[status] || "bg-muted-foreground"
            )}
          />

          {/* Symbol and timestamp */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground/70">
                {signal.symbol || "--"}
              </span>
              <DirectionBadge type={signal.type} size="sm" />
            </div>
            <span className="text-[10px] text-foreground-muted font-mono">
              {formatTime(signal.timestamp)}
            </span>
          </div>
        </div>

        {/* Center: Result */}
        <div className="flex-shrink-0">
          <ResultBadge status={status} size="sm" />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {/* Expand button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity"
            onClick={() => onExpand?.(signal.id)}
            title="Show details"
          >
            <ChevronDown className="w-4 h-4 text-foreground-muted" />
          </Button>

          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-50 group-hover:opacity-100 transition-opacity hover:text-destructive"
            onClick={() => onDismiss?.(signal.id)}
            title="Dismiss"
          >
            <X className="w-4 h-4 text-foreground-muted" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
