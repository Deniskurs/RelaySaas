import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  User,
  Shield,
  Search,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Command,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";

// Command definitions
const createCommands = (
  onTabChange,
  onClose,
  isPaused,
  onPause,
  onResume,
  onRefresh,
  setCurrency,
  currencies,
  isAdmin
) => {
  const navCommands = [
    {
      id: "nav-dashboard",
      label: "Dashboard",
      description: "Go to main dashboard",
      icon: LayoutDashboard,
      group: "Navigation",
      action: () => {
        onTabChange("dashboard");
        onClose();
      },
    },
    {
      id: "nav-settings",
      label: "Settings",
      description: "Application settings",
      icon: Settings,
      group: "Navigation",
      action: () => {
        onTabChange("settings");
        onClose();
      },
    },
    {
      id: "nav-profile",
      label: "Profile",
      description: "Your profile settings",
      icon: User,
      group: "Navigation",
      action: () => {
        onTabChange("profile");
        onClose();
      },
    },
  ];

  if (isAdmin) {
    navCommands.push({
      id: "nav-admin",
      label: "Admin Panel",
      description: "System administration",
      icon: Shield,
      group: "Navigation",
      action: () => {
        onTabChange("admin");
        onClose();
      },
    });
  }

  const actionCommands = [
    {
      id: "action-toggle-trading",
      label: isPaused ? "Resume Trading" : "Pause Trading",
      description: isPaused ? "Resume signal execution" : "Pause signal execution",
      icon: isPaused ? PlayCircle : PauseCircle,
      group: "Actions",
      action: () => {
        isPaused ? onResume() : onPause();
        onClose();
      },
    },
    {
      id: "action-refresh",
      label: "Refresh Data",
      description: "Reload all dashboard data",
      icon: RefreshCw,
      group: "Actions",
      action: () => {
        onRefresh?.();
        onClose();
      },
    },
  ];

  const currencyCommands = Object.values(currencies).map((curr) => ({
    id: `currency-${curr.code}`,
    label: curr.code,
    description: curr.name,
    icon: DollarSign,
    group: "Currency",
    action: () => {
      setCurrency(curr.code);
      onClose();
    },
    badge: curr.symbol,
  }));

  return [...navCommands, ...actionCommands, ...currencyCommands];
};

export default function CommandPalette({
  isOpen,
  onClose,
  onTabChange,
  isPaused,
  onPause,
  onResume,
  onRefresh,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const { currency, setCurrency, currencies } = useCurrency();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const commands = createCommands(
    onTabChange,
    onClose,
    isPaused,
    onPause,
    onResume,
    onRefresh,
    setCurrency,
    currencies,
    isAdmin
  );

  // Filter commands based on query
  const filteredCommands = query
    ? commands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description.toLowerCase().includes(query.toLowerCase()) ||
          cmd.group.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Group commands
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  const flatFilteredCommands = filteredCommands;

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flatFilteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flatFilteredCommands.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (flatFilteredCommands[selectedIndex]) {
            flatFilteredCommands[selectedIndex].action();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isOpen, flatFilteredCommands, selectedIndex, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed left-1/2 top-[15%] -translate-x-1/2 z-[101]",
              "w-[90vw] max-w-[560px]",
              "rounded-2xl overflow-hidden",
              "border border-white/[0.08]"
            )}
            style={{
              background:
                "linear-gradient(180deg, rgba(20,20,25,0.98), rgba(15,15,20,0.98))",
              boxShadow:
                "0 0 0 1px rgba(255,255,255,0.03), 0 25px 80px -20px rgba(0,0,0,0.6), 0 0 100px rgba(139,92,246,0.08)",
            }}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06]">
              <Search size={18} className="text-foreground-muted flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className={cn(
                  "flex-1 bg-transparent border-none outline-none",
                  "text-base text-foreground placeholder:text-foreground-subtle"
                )}
              />
              <div className="flex items-center gap-1 text-xs text-foreground-subtle">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] font-mono">
                  ESC
                </kbd>
                <span>to close</span>
              </div>
            </div>

            {/* Command List */}
            <div
              ref={listRef}
              className="max-h-[400px] overflow-y-auto py-2 px-2"
            >
              {Object.keys(groupedCommands).length === 0 ? (
                <div className="px-4 py-8 text-center text-foreground-muted">
                  <p className="text-sm">No commands found</p>
                  <p className="text-xs text-foreground-subtle mt-1">
                    Try a different search term
                  </p>
                </div>
              ) : (
                Object.entries(groupedCommands).map(([group, cmds]) => (
                  <div key={group} className="mb-2">
                    {/* Group Header */}
                    <div className="px-2 py-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-subtle">
                        {group}
                      </span>
                    </div>

                    {/* Commands */}
                    {cmds.map((cmd) => {
                      const globalIndex = flatFilteredCommands.findIndex(
                        (c) => c.id === cmd.id
                      );
                      const isSelected = globalIndex === selectedIndex;
                      const Icon = cmd.icon;

                      return (
                        <motion.button
                          key={cmd.id}
                          data-index={globalIndex}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-none",
                            "text-left transition-colors duration-100",
                            isSelected
                              ? "bg-white/[0.08]"
                              : "hover:bg-white/[0.04]"
                          )}
                        >
                          <div
                            className={cn(
                              "w-8 h-8 rounded-none flex items-center justify-center flex-shrink-0",
                              "bg-white/[0.04]",
                              isSelected && "bg-white/[0.08]"
                            )}
                          >
                            <Icon
                              size={16}
                              className={cn(
                                "transition-colors",
                                isSelected
                                  ? "text-foreground"
                                  : "text-foreground-muted"
                              )}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-medium truncate",
                                isSelected
                                  ? "text-foreground"
                                  : "text-foreground-muted"
                              )}
                            >
                              {cmd.label}
                            </p>
                            <p className="text-xs text-foreground-subtle truncate">
                              {cmd.description}
                            </p>
                          </div>

                          {cmd.badge && (
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-xs font-medium text-foreground-muted">
                              {cmd.badge}
                            </span>
                          )}

                          {isSelected && (
                            <CornerDownLeft
                              size={14}
                              className="text-foreground-subtle flex-shrink-0"
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer with keyboard hints */}
            <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-foreground-subtle">
                <div className="flex items-center gap-1">
                  <ArrowUp size={12} />
                  <ArrowDown size={12} />
                  <span>navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <CornerDownLeft size={12} />
                  <span>select</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-xs text-foreground-subtle">
                <Command size={12} />
                <span>K to open</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
