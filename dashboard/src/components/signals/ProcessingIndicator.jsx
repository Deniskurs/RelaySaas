import { motion } from "framer-motion";
import { Radio, Brain, ShieldCheck, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import AnimatedEllipsis from "./AnimatedEllipsis";

/**
 * ProcessingIndicator - SUBTLE status indicator for signal processing stages
 *
 * Shows a small floating badge with status text - no aggressive animations
 */
const statusConfig = {
  received: {
    icon: Radio,
    text: "Signal Received",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    accentColor: "bg-blue-500",
  },
  parsed: {
    icon: Brain,
    text: "Parsing",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    accentColor: "bg-amber-500",
    animated: true,
  },
  validated: {
    icon: ShieldCheck,
    text: "Validated",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    accentColor: "bg-emerald-500",
  },
  pending_confirmation: {
    icon: Bell,
    text: "Action Required",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    borderColor: "border-blue-500/40",
    accentColor: "bg-blue-500",
  },
};

export default function ProcessingIndicator({ status }) {
  const config = statusConfig[status?.toLowerCase()] || statusConfig.received;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "absolute -top-3 left-4 px-2.5 py-1 z-10 border backdrop-blur-sm",
        config.bgColor,
        config.borderColor
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn("w-3 h-3", config.color)} />
        <span className={cn("text-[10px] font-medium tracking-wide", config.color)}>
          {config.text}
          {config.animated && <AnimatedEllipsis />}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Get the accent bar color class based on status
 * Returns a left border color - NO animations, just color
 */
export function getStatusAccentColor(status) {
  switch (status?.toLowerCase()) {
    case "received":
      return "border-l-blue-500";
    case "parsed":
      return "border-l-amber-500";
    case "validated":
      return "border-l-emerald-500";
    case "pending_confirmation":
      return "border-l-blue-500";
    case "executed":
      return "border-l-success";
    case "rejected":
    case "failed":
      return "border-l-destructive";
    case "skipped":
      return "border-l-warning";
    default:
      return "border-l-white/10";
  }
}

/**
 * Get card animation class - NOW SUBTLE (no flashing)
 * Just returns transition classes for smooth color changes
 */
export function getCardAnimationClass(status) {
  // No more pulsing/flashing - just smooth transitions
  return "transition-all duration-300";
}

/**
 * Check if a status is a processing state (not completed)
 */
export function isProcessingStatus(status) {
  const processingStates = ["received", "parsed", "validated"];
  return processingStates.includes(status?.toLowerCase());
}

/**
 * Check if a status is a completed state
 */
export function isCompletedStatus(status) {
  const completedStates = ["executed", "rejected", "failed", "skipped"];
  return completedStates.includes(status?.toLowerCase());
}
