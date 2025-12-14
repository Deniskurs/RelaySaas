import { motion } from "framer-motion";
import { Radio, Brain, ShieldCheck, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import AnimatedEllipsis from "./AnimatedEllipsis";

/**
 * ProcessingIndicator - Animated status indicator for signal processing stages
 *
 * Shows a floating badge with status-specific animation and text
 */
const statusConfig = {
  received: {
    icon: Radio,
    text: "Signal Received",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    animated: false,
  },
  parsed: {
    icon: Brain,
    text: "Parsing Signal",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    animated: true,
  },
  validated: {
    icon: ShieldCheck,
    text: "Validated",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    animated: false,
  },
  pending_confirmation: {
    icon: Bell,
    text: "Action Required",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    borderColor: "border-blue-500/40",
    animated: false,
    urgent: true,
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
        <Icon
          className={cn(
            "w-3 h-3",
            config.color,
            config.urgent && "animate-pulse"
          )}
        />
        <span className={cn("text-[10px] font-medium tracking-wide", config.color)}>
          {config.text}
          {config.animated && <AnimatedEllipsis />}
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Get the animation class for the card border based on status
 */
export function getCardAnimationClass(status) {
  switch (status?.toLowerCase()) {
    case "received":
      return "animate-pulse-soft border-2";
    case "parsed":
      return "border-2 border-amber-500/30 bg-gradient-to-r from-transparent via-amber-500/5 to-transparent bg-[length:200%_100%] animate-shimmer";
    case "validated":
      return "animate-flash-success border-2";
    case "pending_confirmation":
      return "animate-pulse-urgent border-2";
    default:
      return "";
  }
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
