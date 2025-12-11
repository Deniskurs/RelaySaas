import { PauseCircle, PlayCircle, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import CurrencySelector from "@/components/CurrencySelector";

export default function TopBar({
  title,
  isPaused,
  onPause,
  onResume,
  isConnected,
}) {
  return (
    <header
      className={cn(
        "h-14 sticky top-0 z-40",
        "bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40",
        "border-b border-white/5",
        "px-6 flex items-center justify-between"
      )}
    >
      {/* Left: Title */}
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-medium text-foreground">{title}</h1>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-3">
        {/* Currency Selector */}
        <CurrencySelector />

        {/* Divider */}
        <div className="h-4 w-px bg-border" />

        {/* Connection Status - minimal */}
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <Circle
            size={6}
            className={cn(
              "fill-current",
              isConnected ? "text-emerald-500" : "text-neutral-500"
            )}
          />
          <span>{isConnected ? "Connected" : "Disconnected"}</span>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border" />

        {/* Pause/Resume Button - minimal */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isPaused ? "resume" : "pause"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <Button
              onClick={isPaused ? onResume : onPause}
              variant="ghost"
              size="sm"
              className={cn(
                "gap-2 text-xs font-medium h-8",
                "text-foreground-muted hover:text-foreground"
              )}
            >
              {isPaused ? (
                <>
                  <PlayCircle size={14} />
                  Resume
                </>
              ) : (
                <>
                  <PauseCircle size={14} />
                  Pause
                </>
              )}
            </Button>
          </motion.div>
        </AnimatePresence>
      </div>
    </header>
  );
}
