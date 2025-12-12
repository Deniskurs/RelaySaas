import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  PauseCircle,
  PlayCircle,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export default function BottomTabBar({
  activeTab,
  onTabChange,
  isPaused,
  onPause,
  onResume,
}) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const tabs = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "settings", icon: Settings, label: "Settings" },
    ...(isAdmin ? [{ id: "admin", icon: Shield, label: "Admin" }] : []),
  ];

  return (
    <nav
      className={cn(
        "lg:hidden fixed bottom-0 left-0 right-0 z-50",
        "border-t border-white/[0.04]",
        "pb-safe" // iOS safe area
      )}
      style={{
        background: "linear-gradient(180deg, rgba(10,10,15,0.95), rgba(8,8,12,0.98))",
        backdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {/* Navigation Tabs */}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "relative flex flex-col items-center gap-1 py-2 px-4 min-w-[64px]",
                "transition-colors duration-150"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="bottom-tab-active"
                  className="absolute inset-x-2 top-0 h-0.5 bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <Icon
                size={20}
                className={cn(
                  "transition-colors",
                  isActive ? "text-foreground" : "text-foreground-muted"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium uppercase tracking-wide",
                  isActive ? "text-foreground" : "text-foreground-subtle"
                )}
              >
                {tab.label}
              </span>
            </motion.button>
          );
        })}

        {/* Divider */}
        <div className="h-8 w-px bg-white/[0.06]" />

        {/* Pause/Resume Action */}
        <motion.button
          onClick={isPaused ? onResume : onPause}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative flex flex-col items-center gap-1 py-2 px-4 min-w-[64px]"
          )}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isPaused ? "paused" : "active"}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "w-10 h-10 flex items-center justify-center",
                isPaused
                  ? "bg-success/20 text-success"
                  : "bg-white/[0.06] text-foreground-muted"
              )}
            >
              {isPaused ? <PlayCircle size={22} /> : <PauseCircle size={22} />}
            </motion.div>
          </AnimatePresence>
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-wide",
              isPaused ? "text-success" : "text-foreground-subtle"
            )}
          >
            {isPaused ? "Resume" : "Active"}
          </span>
        </motion.button>
      </div>
    </nav>
  );
}
