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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
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
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
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

  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarWidth }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40",
        "border-r border-white/[0.04]"
      )}
      style={{
        background: "linear-gradient(180deg, rgba(15,15,20,0.98), rgba(10,10,15,0.98))",
        backdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset -1px 0 0 rgba(255,255,255,0.03), 4px 0 30px rgba(0,0,0,0.2)",
      }}
    >
      {/* Header: Logo + Collapse Toggle */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/[0.04]">
        <motion.div
          className="flex items-center gap-3 cursor-pointer group overflow-hidden"
          onClick={() => onTabChange("dashboard")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="relative flex-shrink-0">
            <div className="w-8 h-8 overflow-hidden relative z-10">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: "radial-gradient(circle, rgba(139,92,246,0.4), transparent 70%)",
                filter: "blur(8px)",
              }}
            />
          </div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="text-lg font-semibold tracking-tight text-foreground whitespace-nowrap font-serif"
              >
                SignalCopier
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "w-6 h-6 flex items-center justify-center",
            "text-foreground-subtle hover:text-foreground",
            "hover:bg-white/[0.06] transition-colors",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </motion.button>
      </div>

      {/* Search Trigger */}
      <div className="px-3 py-3">
        <motion.button
          onClick={onOpenCommandPalette}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2",
            "bg-white/[0.03] hover:bg-white/[0.06]",
            "border border-white/[0.04] hover:border-white/[0.08]",
            "text-foreground-muted hover:text-foreground",
            "transition-all duration-200",
            isCollapsed && "justify-center px-0"
          )}
        >
          <Search size={16} className="flex-shrink-0" />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex items-center justify-between"
              >
                <span className="text-sm">Search</span>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white/[0.06] text-[10px] font-medium text-foreground-subtle">
                  <Command size={10} />
                  <span>K</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
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
                "relative w-full flex items-center gap-3 px-3 py-2.5",
                "text-sm font-medium transition-colors duration-150",
                isCollapsed && "justify-center px-0",
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
                    background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.08))",
                    borderLeft: "2px solid rgba(139,92,246,0.6)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <Icon size={18} className="relative z-10 flex-shrink-0" />

              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative z-10"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

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
              "relative w-full flex items-center gap-3 px-3 py-2.5",
              "text-sm font-medium transition-colors duration-150",
              isCollapsed && "justify-center px-0",
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
                  background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.08))",
                  borderLeft: "2px solid rgba(139,92,246,0.6)",
                }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Shield size={18} className="relative z-10 flex-shrink-0" />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative z-10"
                >
                  Admin
                </motion.span>
              )}
            </AnimatePresence>

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

      {/* Status Section */}
      <div className="px-3 py-3 border-t border-white/[0.04] space-y-2">
        {/* Connection Status */}
        <div className={cn(
          "flex items-center gap-3 px-3 py-2",
          isCollapsed && "justify-center px-0"
        )}>
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
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-foreground-muted"
              >
                {isConnected ? "Live" : "Offline"}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Pause/Resume Button */}
        <motion.button
          onClick={isPaused ? onResume : onPause}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5",
            "text-sm font-medium transition-all duration-200",
            isCollapsed && "justify-center px-0",
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
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {isPaused ? "Resume" : "Active"}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* User Section */}
      <div className="px-3 py-3 border-t border-white/[0.04]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2",
                "bg-white/[0.02] hover:bg-white/[0.05]",
                "border border-white/[0.03] hover:border-white/[0.06]",
                "transition-all duration-200",
                isCollapsed && "justify-center px-0"
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
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
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
              </AnimatePresence>
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
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
            }}
          >
            {/* User Info Header */}
            <div className="px-2 py-2 mb-1">
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name || user?.email?.split("@")[0] || "User"}
              </p>
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
