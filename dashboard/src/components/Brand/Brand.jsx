import { useId } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Premium Logo Component - Abstract Relay/Connection Symbol
export function Logo({ className, size = 32, animate = true }) {
  // Generate unique ID for this instance to avoid SVG gradient conflicts
  const instanceId = useId();
  const gradientId = `brand-gradient-${instanceId}`;

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#29A19C" /> {/* Teal */}
            <stop offset="50%" stopColor="#A3E4DB" /> {/* Light Cyan */}
            <stop offset="100%" stopColor="#ECECEC" /> {/* Platinum */}
          </linearGradient>
        </defs>

        {/* Outer Ring Segment - Connectivity */}
        {animate ? (
          <motion.path
            d="M16 4 A12 12 0 0 1 28 16"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        ) : (
          <path
            d="M16 4 A12 12 0 0 1 28 16"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* Inner Core - The Relay Node */}
        {animate ? (
          <motion.circle
            cx="16"
            cy="16"
            r="6"
            fill={`url(#${gradientId})`}
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          />
        ) : (
          <circle
            cx="16"
            cy="16"
            r="6"
            fill={`url(#${gradientId})`}
          />
        )}

        {/* Pulse Effect - only when animated */}
        {animate && (
          <motion.circle
            cx="16"
            cy="16"
            r="6"
            stroke={`url(#${gradientId})`}
            strokeWidth="1"
            strokeOpacity="0.5"
            fill="none"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        )}

        {/* Connection Line */}
        {animate ? (
          <motion.path
            d="M4 16 L10 16"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          />
        ) : (
          <path
            d="M4 16 L10 16"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}

// Premium Wordmark Component
export function BrandName({ className, showSubtitle = false }) {
  return (
    <div className={cn("flex flex-col justify-center", className)}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex items-center gap-0.5"
      >
        <span className="font-garamond font-bold text-2xl tracking-tight text-foreground">
          Relay
        </span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#29A19C] mt-2 animate-pulse" />
      </motion.div>

      {showSubtitle && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-[10px] uppercase tracking-[0.2em] text-foreground-subtle font-medium ml-0.5"
        >
          Signal Infrastructure
        </motion.span>
      )}
    </div>
  );
}
