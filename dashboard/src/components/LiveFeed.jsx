import { format, isValid } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const formatTime = (timestamp) => {
  if (!timestamp) return "--:--:--";
  const date = new Date(timestamp);
  return isValid(date) ? format(date, "HH:mm:ss") : "--:--:--";
};

const getEventColor = (type) => {
  const t = type?.toLowerCase() || "";
  if (t.includes("error") || t.includes("failed")) return "text-rose-400";
  if (t.includes("success") || t.includes("executed")) return "text-emerald-400";
  if (t.includes("warning") || t.includes("skipped")) return "text-yellow-400";
  return "text-blue-400";
};

const MAX_EVENTS = 5;

export default function LiveFeed({ events = [] }) {
  // Only show the latest 5 events
  const recentEvents = events.slice(0, MAX_EVENTS);

  return (
    <div className="glass-card border-border/40 bg-black/60 overflow-hidden relative">
      {/* Scanline overlay */}
      <div className="terminal-scanline absolute inset-0 z-10" />

      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-black/40">
        {/* Traffic lights + Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[11px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
            Terminal
          </span>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-mono font-medium text-emerald-400 uppercase tracking-wider">
              Live
            </span>
          </div>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="font-mono text-xs p-3 min-h-[180px] relative">
        {recentEvents.length === 0 ? (
          <div className="flex items-center gap-2 text-foreground-subtle">
            <span className="text-emerald-500">{">"}</span>
            <span className="opacity-60">Waiting for events...</span>
            <span className="terminal-cursor text-emerald-400">█</span>
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {recentEvents.map((event, idx) => (
              <motion.div
                key={event.id || `${event.timestamp}-${idx}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex items-start gap-2 py-1.5 leading-relaxed"
              >
                {/* Prompt */}
                <span className="text-emerald-500 flex-shrink-0">{">"}</span>

                {/* Timestamp */}
                <span className="text-foreground-subtle flex-shrink-0 w-[60px] opacity-50">
                  {formatTime(event.timestamp)}
                </span>

                {/* Event Type */}
                <span
                  className={cn(
                    "flex-shrink-0 w-[72px] uppercase font-medium tracking-tight",
                    getEventColor(event.type)
                  )}
                >
                  {event.type?.split(".").pop()?.slice(0, 8)}
                </span>

                {/* Message */}
                <span className="text-foreground-muted flex-1 truncate opacity-80">
                  {event.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Blinking cursor at bottom */}
        {recentEvents.length > 0 && (
          <div className="flex items-center gap-2 pt-1 text-foreground-subtle">
            <span className="text-emerald-500">{">"}</span>
            <span className="terminal-cursor text-emerald-400">█</span>
          </div>
        )}
      </div>
    </div>
  );
}
