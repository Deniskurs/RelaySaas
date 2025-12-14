import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  Shield,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  PauseCircle,
  PlayCircle,
  Search,
  Command,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Logo, BrandName } from "../Brand/Brand";
import { PlanBadge, UsageMeter } from "@/components/Plans";

const SIDEBAR_EXPANDED_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const STORAGE_KEY = "sidebar-collapsed";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Settings, label: "Settings", id: "settings" },
];

export default function Sidebar({
  activeTab,
  onTabChange,
  isPaused,
  onPause,
  onResume,
  isConnected,
  onOpenCommandPalette,
}) {
  const { user, profile, logout } = useAuth();
  const { currency, setCurrency, currencies } = useCurrency();
  const { usage, effectiveTier, isPaid } = usePlanLimits();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : false;
  });
  const [isHoveringNav, setIsHoveringNav] = useState(null);

  const isAdmin = profile?.role === "admin";

  // Persist collapse state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Keyboard shortcuts for collapse toggle
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (e.key === "[" || e.key === "]") {
        setIsCollapsed((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNavClick = (id) => {
    onTabChange(id);
  };

  const sidebarWidth = isCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_EXPANDED_WIDTH;

  // Shared transition config for synchronized animations
  const sidebarTransition = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={sidebarTransition}
      className={cn(
        "hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40",
        "border-r border-white/[0.04]"
      )}
      style={{
        background:
          "linear-gradient(180deg, rgba(15,15,20,0.98), rgba(10,10,15,0.98))",
        backdropFilter: "blur(20px) saturate(180%)",
        boxShadow:
          "inset -1px 0 0 rgba(255,255,255,0.03), 4px 0 30px rgba(0,0,0,0.2)",
      }}
    >
      {/* Header: Logo + Collapse Toggle */}
      <div
        className={cn(
          "h-16 flex items-center border-b border-white/[0.04]",
          isCollapsed ? "justify-center px-0" : "justify-between px-4"
        )}
      >
        {/* When collapsed: Logo becomes expand trigger */}
        {/* When collapsed: Logo becomes expand trigger */}
        {isCollapsed ? (
          <motion.button
            onClick={() => setIsCollapsed(false)}
            className="relative w-10 h-10 flex items-center justify-center group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Logo */}
            <div className="w-8 h-8 relative z-10 transition-opacity duration-200 group-hover:opacity-100">
              <Logo size={32} />
            </div>
            {/* Expand icon overlay on hover */}
            <motion.div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
              <div className="bg-black/80 rounded-full p-1 backdrop-blur-sm">
                <ChevronRight size={14} className="text-white" />
              </div>
            </motion.div>
            {/* Glow effect */}
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(41,161,156,0.25), transparent 70%)",
                filter: "blur(8px)",
              }}
            />
          </motion.button>
        ) : (
          <>
            {/* When expanded: Logo goes to dashboard */}
            <motion.div
              className="flex items-center gap-3 cursor-pointer group overflow-visible"
              onClick={() => onTabChange("dashboard")}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative flex-shrink-0">
                <div className="w-8 h-8 relative z-10">
                  <Logo size={32} />
                </div>
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(41,161,156,0.3), transparent 70%)",
                    filter: "blur(8px)",
                  }}
                />
              </div>
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.05 }}
              >
                <BrandName />
              </motion.div>
            </motion.div>

            {/* Collapse button */}
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsCollapsed(true)}
              className={cn(
                "w-6 h-6 flex items-center justify-center",
                "text-foreground-subtle hover:text-foreground",
                "hover:bg-white/[0.06] transition-colors"
              )}
            >
              <ChevronLeft size={14} />
            </motion.button>
          </>
        )}
      </div>

      {/* Search Trigger */}
      <div className="px-3 py-3">
        <motion.button
          onClick={onOpenCommandPalette}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full flex items-center gap-3 py-2 overflow-hidden",
            "bg-white/[0.03] hover:bg-white/[0.06]",
            "border border-white/[0.04] hover:border-white/[0.08]",
            "text-foreground-muted hover:text-foreground",
            "transition-all duration-200",
            isCollapsed ? "justify-center px-2" : "px-3"
          )}
        >
          <Search size={16} className="flex-shrink-0" />
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              className="flex-1 flex items-center justify-between"
            >
              <span className="text-sm">Search</span>
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/[0.06] text-[10px] font-medium text-foreground-subtle">
                <Command size={10} />
                <span>K</span>
              </div>
            </motion.div>
          )}
        </motion.button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <motion.button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              onMouseEnter={() => setIsHoveringNav(item.id)}
              onMouseLeave={() => setIsHoveringNav(null)}
              className={cn(
                "relative w-full flex items-center gap-3 py-2.5 overflow-hidden",
                "text-sm font-medium transition-colors duration-150",
                isCollapsed ? "justify-center px-2" : "px-3",
                isActive
                  ? "text-foreground"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0"
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    borderLeft: "2px solid rgba(41, 161, 156, 0.6)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <Icon size={18} className="relative z-10 flex-shrink-0" />

              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="relative z-10 whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}

              {/* Tooltip for collapsed state */}
              {isCollapsed && isHoveringNav === item.id && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "absolute left-full ml-2 px-2 py-1",
                    "bg-[rgba(20,20,25,0.95)] border border-white/[0.08]",
                    "text-sm text-foreground whitespace-nowrap z-50"
                  )}
                >
                  {item.label}
                </motion.div>
              )}
            </motion.button>
          );
        })}

        {/* Admin nav item */}
        {isAdmin && (
          <motion.button
            onClick={() => handleNavClick("admin")}
            onMouseEnter={() => setIsHoveringNav("admin")}
            onMouseLeave={() => setIsHoveringNav(null)}
            className={cn(
              "relative w-full flex items-center gap-3 py-2.5 overflow-hidden",
              "text-sm font-medium transition-colors duration-150",
              isCollapsed ? "justify-center px-2" : "px-3",
              activeTab === "admin"
                ? "text-foreground"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            {activeTab === "admin" && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  borderLeft: "2px solid rgba(41, 161, 156, 0.6)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Shield size={18} className="relative z-10 flex-shrink-0" />
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className="relative z-10 whitespace-nowrap"
              >
                Admin
              </motion.span>
            )}

            {isCollapsed && isHoveringNav === "admin" && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "absolute left-full ml-2 px-2 py-1",
                  "bg-[rgba(20,20,25,0.95)] border border-white/[0.08]",
                  "text-sm text-foreground whitespace-nowrap z-50"
                )}
              >
                Admin
              </motion.div>
            )}
          </motion.button>
        )}
      </nav>

      {/* Usage Meter Section (Free users) */}
      {!isCollapsed && !isPaid && (
        <div className="px-3 py-3 border-t border-white/[0.04] overflow-hidden">
          <UsageMeter
            signalsUsedThisMonth={usage.signalsThisMonth}
            mtAccountsConnected={usage.accounts}
            telegramChannelsActive={usage.channels}
            variant="compact"
            onUpgrade={() => onTabChange("pricing")}
          />
        </div>
      )}

      {/* Status Section */}
      <div className="px-3 py-3 border-t border-white/[0.04] space-y-2 overflow-hidden">
        {/* Connection Status */}
        <div
          className={cn(
            "flex items-center gap-3 py-2",
            isCollapsed ? "justify-center px-2" : "px-3"
          )}
        >
          <div className="relative flex-shrink-0">
            <motion.div
              className={cn(
                "w-2 h-2",
                isConnected ? "bg-success" : "bg-muted-foreground"
              )}
            />
            {isConnected && (
              <motion.div
                className="absolute inset-0 bg-success"
                animate={{ scale: [1, 2, 2], opacity: [0.6, 0, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
            )}
          </div>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="text-xs text-foreground-muted whitespace-nowrap"
            >
              {isConnected ? "Live" : "Offline"}
            </motion.span>
          )}
        </div>

        {/* Pause/Resume Button */}
        <motion.button
          onClick={isPaused ? onResume : onPause}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full flex items-center gap-3 py-2.5 overflow-hidden",
            "text-sm font-medium transition-all duration-200",
            isCollapsed ? "justify-center px-2" : "px-3",
            isPaused
              ? "bg-success/10 text-success border border-success/20"
              : "bg-white/[0.03] text-foreground-muted hover:text-foreground border border-white/[0.04] hover:bg-white/[0.06]"
          )}
        >
          {isPaused ? (
            <PlayCircle size={18} className="flex-shrink-0" />
          ) : (
            <PauseCircle size={18} className="flex-shrink-0" />
          )}
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="whitespace-nowrap"
            >
              {isPaused ? "Resume" : "Active"}
            </motion.span>
          )}
        </motion.button>
      </div>

      {/* User Section */}
      <div className="px-3 py-3 border-t border-white/[0.04] overflow-hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full flex items-center gap-3 py-2 overflow-hidden",
                "bg-white/[0.02] hover:bg-white/[0.05]",
                "border border-white/[0.03] hover:border-white/[0.06]",
                "transition-all duration-200",
                isCollapsed ? "justify-center px-2" : "px-2"
              )}
            >
              <div className="w-8 h-8 bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-8 h-8 object-cover"
                  />
                ) : (
                  <User size={16} className="text-foreground-muted" />
                )}
              </div>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 text-left overflow-hidden"
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile?.full_name || user?.email?.split("@")[0] || "User"}
                  </p>
                  <p className="text-xs text-foreground-subtle truncate">
                    {user?.email}
                  </p>
                </motion.div>
              )}
            </motion.button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side="right"
            align="end"
            className={cn(
              "w-56 p-2 ml-2",
              "bg-[rgba(15,15,20,0.95)] backdrop-blur-xl",
              "border border-white/[0.06]"
            )}
            style={{
              boxShadow:
                "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
            }}
          >
            {/* User Info Header */}
            <div className="px-2 py-2 mb-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.full_name || user?.email?.split("@")[0] || "User"}
                </p>
                <PlanBadge size="sm" showDropdown={false} />
              </div>
              <p className="text-xs text-foreground-muted truncate">
                {user?.email}
              </p>
            </div>

            <DropdownMenuSeparator className="bg-white/[0.06]" />

            {/* Profile */}
            <DropdownMenuItem
              onClick={() => onTabChange("profile")}
              className="gap-2 py-2 cursor-pointer focus:bg-white/[0.06]"
            >
              <User size={14} className="text-foreground-muted" />
              <span>Profile</span>
            </DropdownMenuItem>

            {/* Plans */}
            <DropdownMenuItem
              onClick={() => onTabChange("pricing")}
              className="gap-2 py-2 cursor-pointer focus:bg-white/[0.06]"
            >
              <Sparkles size={14} className="text-foreground-muted" />
              <span>Plans & Pricing</span>
            </DropdownMenuItem>

            {/* Currency Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 py-2 cursor-pointer focus:bg-white/[0.06]">
                <span className="w-4 h-4 flex items-center justify-center text-xs font-medium text-foreground-muted">
                  {currencies[currency]?.symbol}
                </span>
                <span>Currency</span>
                <span className="ml-auto text-xs text-foreground-subtle">
                  {currency}
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent
                className={cn(
                  "p-1",
                  "bg-[rgba(15,15,20,0.95)] backdrop-blur-xl",
                  "border border-white/[0.06]"
                )}
              >
                <DropdownMenuRadioGroup
                  value={currency}
                  onValueChange={setCurrency}
                >
                  {Object.values(currencies).map((curr) => (
                    <DropdownMenuRadioItem
                      key={curr.code}
                      value={curr.code}
                      className="gap-2 py-1.5 cursor-pointer"
                    >
                      <span className="w-4 text-center text-xs">
                        {curr.symbol}
                      </span>
                      <span>{curr.code}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator className="bg-white/[0.06]" />

            {/* Logout */}
            <DropdownMenuItem
              onClick={handleLogout}
              className="gap-2 py-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.aside>
  );
}

// Export width constants for layout calculations
export { SIDEBAR_EXPANDED_WIDTH, SIDEBAR_COLLAPSED_WIDTH, STORAGE_KEY };
