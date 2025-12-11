import {
  LayoutDashboard,
  BarChart2,
  Radio,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
  User,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const baseNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Radio, label: "Signals", id: "signals" },
  { icon: BarChart2, label: "Positions", id: "positions" },
  { icon: Wallet, label: "Account", id: "account" },
  { icon: Settings, label: "Settings", id: "settings" },
];

const adminNavItem = { icon: Shield, label: "Admin", id: "admin", isAdmin: true };

export default function Sidebar({ activeTab, onTabChange, onCollapsedChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  // Build nav items - include admin if user is admin
  const navItems = profile?.role === "admin"
    ? [...baseNavItems, adminNavItem]
    : baseNavItems;

  const handleCollapse = (value) => {
    setCollapsed(value);
    onCollapsedChange?.(value);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNavClick = (itemId) => {
    if (itemId === "admin") {
      navigate("/admin");
    } else {
      onTabChange(itemId);
    }
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
                onClick={() => handleNavClick(item.id)}
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

        {/* User Profile & Logout */}
        <div className="p-3 border-t border-border-subtle">
          {!collapsed ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="space-y-2"
            >
              {/* User info */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-surface-hover/50">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <User size={14} className="text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile?.full_name || user?.email?.split("@")[0] || "User"}
                  </p>
                  <p className="text-xs text-foreground-muted truncate">
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl",
                  "transition-all duration-200",
                  "text-foreground-muted hover:text-destructive hover:bg-destructive/10"
                )}
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">Sign Out</span>
              </button>
            </motion.div>
          ) : (
            <div className="space-y-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full flex justify-center p-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <User size={14} className="text-primary" />
                      )}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  {profile?.full_name || user?.email}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className={cn(
                      "w-full p-2.5 rounded-xl transition-all duration-200",
                      "text-foreground-subtle hover:text-destructive",
                      "hover:bg-destructive/10 active:scale-95",
                      "flex items-center justify-center"
                    )}
                  >
                    <LogOut size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">
                  Sign Out
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </motion.aside>
    </TooltipProvider>
  );
}
