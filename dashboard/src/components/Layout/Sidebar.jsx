import {
  LayoutDashboard,
  BarChart2,
  Radio,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Radio, label: "Signals", id: "signals" },
  { icon: BarChart2, label: "Positions", id: "positions" },
  { icon: Wallet, label: "Account", id: "account" },
  { icon: Settings, label: "Settings", id: "settings" },
];

export default function Sidebar({ activeTab, onTabChange, onCollapsedChange }) {
  const [collapsed, setCollapsed] = useState(false);

  const handleCollapse = (value) => {
    setCollapsed(value);
    onCollapsedChange?.(value);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "fixed left-0 top-0 h-full z-50 flex flex-col",
          "bg-background-elevated/80 backdrop-blur-2xl",
          "border-r border-border"
        )}
        style={{
          boxShadow: "1px 0 0 hsla(0, 0%, 100%, 0.02)",
        }}
      >
        {/* Logo Area */}
        <div
          className={cn(
            "h-16 flex items-center border-b border-border-subtle",
            "bg-gradient-to-b from-white/[0.02] to-transparent",
            collapsed ? "justify-center px-3" : "justify-between px-5"
          )}
        >
          <AnimatePresence mode="wait">
            {!collapsed ? (
              <motion.div
                key="logo-full"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shadow-glow-sm">
                  <Zap size={16} className="text-white" />
                </div>
                <span className="text-lg font-semibold text-gradient tracking-tight">
                  SignalCopier
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="logo-icon"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center shadow-glow-sm"
              >
                <Zap size={16} className="text-white" />
              </motion.div>
            )}
          </AnimatePresence>

          {!collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleCollapse(true)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all duration-200",
                    "text-foreground-subtle hover:text-foreground",
                    "hover:bg-surface-hover active:scale-95"
                  )}
                >
                  <ChevronLeft size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Collapse sidebar
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item, index) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            const button = (
              <motion.button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
                  "transition-all duration-200 group relative",
                  collapsed && "justify-center",
                  isActive
                    ? "text-foreground"
                    : "text-foreground-muted hover:text-foreground hover:bg-surface-hover"
                )}
              >
                {/* Active background */}
                {isActive && (
                  <motion.div
                    layoutId="activeNavItem"
                    className={cn(
                      "absolute inset-0 rounded-xl",
                      "bg-gradient-to-r from-primary/15 via-primary/10 to-accent-purple/10",
                      "border border-primary/20"
                    )}
                    style={{
                      boxShadow: "inset 0 1px 0 hsla(0, 0%, 100%, 0.05)",
                    }}
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}

                {/* Icon */}
                <div className="relative z-10">
                  <Icon
                    size={20}
                    className={cn(
                      "transition-all duration-200",
                      isActive
                        ? "text-primary"
                        : "text-foreground-subtle group-hover:text-foreground"
                    )}
                    style={
                      isActive
                        ? {
                            filter:
                              "drop-shadow(0 0 8px hsla(217, 91%, 60%, 0.5))",
                          }
                        : undefined
                    }
                  />
                </div>

                {/* Label */}
                <AnimatePresence mode="wait">
                  {!collapsed && (
                    <motion.span
                      key={`label-${item.id}`}
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="relative z-10 font-medium text-sm whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Active indicator dot */}
                {isActive && !collapsed && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary shadow-glow-primary"
                  />
                )}
              </motion.button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}
        </nav>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="p-3 border-t border-border-subtle">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleCollapse(false)}
                  className={cn(
                    "w-full p-2.5 rounded-xl transition-all duration-200",
                    "text-foreground-subtle hover:text-foreground",
                    "hover:bg-surface-hover active:scale-95",
                    "flex items-center justify-center"
                  )}
                >
                  <ChevronRight size={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Bottom section */}
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="p-4 border-t border-border-subtle"
          >
            <div
              className={cn(
                "p-3 rounded-xl",
                "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
                "border border-primary/10"
              )}
            >
              <p className="text-xs text-foreground-muted">
                Pro tip: Use keyboard shortcuts to navigate faster
              </p>
            </div>
          </motion.div>
        )}
      </motion.aside>
    </TooltipProvider>
  );
}
