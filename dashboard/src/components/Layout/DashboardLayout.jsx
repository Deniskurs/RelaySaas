import { motion } from "framer-motion";
import TopBar from "./TopBar";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
  title,
  isPaused,
  onPause,
  onResume,
  isConnected,
}) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <TopBar
        title={title || "Dashboard"}
        isPaused={isPaused}
        onPause={onPause}
        onResume={onResume}
        isConnected={isConnected}
      />

      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "px-6 py-6 max-w-[1400px] mx-auto",
          "min-h-[calc(100vh-56px)]"
        )}
      >
        {children}
      </motion.main>
    </div>
  );
}
