import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Settings,
  Search,
  Command,
  PauseCircle,
  PlayCircle,
  User,
  LogOut,
  Shield,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Settings, label: "Settings", id: "settings" },
];

export default function PremiumTopBar({
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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);

  const isAdmin = profile?.role === "admin";

  // Mouse tracking for premium hover glow
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (headerRef.current && isHovering) {
        const rect = headerRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isHovering]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleNavClick = (id) => {
    onTabChange(id);
    setMobileMenuOpen(false);
  };

  return (
    <header
      ref={headerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "h-16 sticky top-0 z-50",
        "flex items-center justify-between px-4 md:px-6",
        "border-b border-white/[0.04]"
      )}
      style={{
        background:
          "linear-gradient(180deg, rgba(15,15,20,0.92), rgba(10,10,15,0.88))",
        backdropFilter: "blur(20px) saturate(180%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 30px rgba(0,0,0,0.3)",
      }}
    >
      {/* Mouse-following gradient glow */}
      <AnimatePresence>
        {isHovering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 pointer-events-none overflow-hidden rounded-none"
            style={{
              background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(255,255,255,0.02), transparent 40%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Left Section: Logo + Nav */}
      <div className="flex items-center gap-6">
        {/* Logo */}
        <motion.div
          className="flex items-center gap-2.5 cursor-pointer group"
          onClick={() => onTabChange("dashboard")}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-none overflow-hidden relative z-10">
              <img
                src="/logo.png"
                alt="Logo"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Logo glow on hover */}
            <motion.div
              className="absolute inset-0 rounded-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background:
                  "radial-gradient(circle, rgba(41,161,156,0.3), transparent 70%)",
                filter: "blur(8px)",
              }}
            />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground hidden sm:block">
            Relay
          </span>
        </motion.div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item, index) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;

            return (
              <motion.button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.05,
                  duration: 0.3,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={cn(
                  "relative px-3.5 py-2 rounded-none flex items-center gap-2",
                  "text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "text-foreground"
                    : "text-foreground-muted hover:text-foreground"
                )}
              >
                {/* Animated pill background */}
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-none"
                    style={{
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderLeft: "2px solid rgba(41, 161, 156, 0.6)",
                      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}

                <Icon size={16} className="relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </motion.button>
            );
          })}

          {/* Admin nav item - conditional */}
          {isAdmin && (
            <motion.button
              onClick={() => handleNavClick("admin")}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: navItems.length * 0.05,
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={cn(
                "relative px-3.5 py-2 rounded-none flex items-center gap-2",
                "text-sm font-medium transition-colors duration-200",
                activeTab === "admin"
                  ? "text-foreground"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              {activeTab === "admin" && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-none"
                  style={{
                    background: "rgba(255, 255, 255, 0.06)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderLeft: "2px solid rgba(41, 161, 156, 0.6)",
                    boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              <Shield size={16} className="relative z-10" />
              <span className="relative z-10">Admin</span>
            </motion.button>
          )}
        </nav>
      </div>

      {/* Right Section: Search, Status, User */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Command Palette Trigger */}
        <motion.button
          onClick={onOpenCommandPalette}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-none",
            "bg-white/[0.04] hover:bg-white/[0.08]",
            "border border-white/[0.06] hover:border-white/[0.1]",
            "text-foreground-muted hover:text-foreground",
            "transition-all duration-200 group"
          )}
        >
          <Search size={14} />
          <span className="text-xs font-medium">Search</span>
          <div
            className={cn(
              "flex items-center gap-0.5 px-1.5 py-0.5 rounded",
              "bg-white/[0.06] group-hover:bg-white/[0.1]",
              "text-[10px] font-medium text-foreground-subtle"
            )}
          >
            <Command size={10} />
            <span>K</span>
          </div>
        </motion.button>

        {/* Subtle divider */}
        <div className="hidden md:block h-5 w-px bg-white/[0.06]" />

        {/* Connection Status - SpaceX style */}
        <div className="hidden md:flex items-center gap-2">
          <div className="relative">
            <motion.div
              className={cn(
                "w-2 h-2 rounded-none",
                isConnected ? "bg-emerald-400" : "bg-neutral-500"
              )}
            />
            {isConnected && (
              <motion.div
                className="absolute inset-0 rounded-none bg-emerald-400"
                animate={{
                  scale: [1, 2, 2],
                  opacity: [0.6, 0, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
            )}
          </div>
          <span className="text-xs text-foreground-muted">
            {isConnected ? "Live" : "Offline"}
          </span>
        </div>

        {/* Pause/Resume Button */}
        <AnimatePresence mode="wait">
          <motion.button
            key={isPaused ? "paused" : "active"}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            onClick={isPaused ? onResume : onPause}
            className={cn(
              "hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-none",
              "text-xs font-medium transition-all duration-200",
              isPaused
                ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                : "bg-white/[0.04] text-foreground-muted hover:text-foreground hover:bg-white/[0.08] border border-white/[0.06]"
            )}
          >
            {isPaused ? (
              <>
                <PlayCircle size={14} />
                <span>Resume</span>
              </>
            ) : (
              <>
                <PauseCircle size={14} />
                <span>Active</span>
              </>
            )}
          </motion.button>
        </AnimatePresence>

        {/* Subtle divider */}
        <div className="hidden md:block h-5 w-px bg-white/[0.06]" />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-none",
                "bg-white/[0.03] hover:bg-white/[0.06]",
                "border border-white/[0.04] hover:border-white/[0.08]",
                "transition-all duration-200"
              )}
            >
              <div className="w-7 h-7 rounded-none bg-white/10 flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-7 h-7 rounded-none object-cover"
                  />
                ) : (
                  <User size={14} className="text-foreground-muted" />
                )}
              </div>
              <ChevronDown
                size={14}
                className="text-foreground-subtle hidden sm:block"
              />
            </motion.button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className={cn(
              "w-56 p-2",
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
              className="gap-2 py-2 cursor-pointer rounded-none focus:bg-white/[0.06]"
            >
              <User size={14} className="text-foreground-muted" />
              <span>Profile</span>
            </DropdownMenuItem>

            {/* Currency Submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2 py-2 cursor-pointer rounded-none focus:bg-white/[0.06]">
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
                      className="gap-2 py-1.5 cursor-pointer rounded-none"
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

            {/* Admin - conditional */}
            {isAdmin && (
              <DropdownMenuItem
                onClick={() => onTabChange("admin")}
                className="gap-2 py-2 cursor-pointer rounded-none focus:bg-white/[0.06]"
              >
                <Shield size={14} className="text-foreground-muted" />
                <span>Admin Panel</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator className="bg-white/[0.06]" />

            {/* Logout */}
            <DropdownMenuItem
              onClick={handleLogout}
              className="gap-2 py-2 cursor-pointer rounded-none text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mobile Menu Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button
              className={cn(
                "md:hidden p-2 rounded-none",
                "text-foreground-muted hover:text-foreground",
                "hover:bg-white/[0.06] transition-colors"
              )}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className={cn(
              "w-72 p-0",
              "bg-[rgba(10,10,15,0.98)] backdrop-blur-xl",
              "border-l border-white/[0.06]"
            )}
          >
            {/* Mobile Nav Items */}
            <div className="p-4 space-y-1 mt-8">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-none",
                      "text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-white/[0.08] text-foreground border border-white/[0.1]"
                        : "text-foreground-muted hover:text-foreground hover:bg-white/[0.04]"
                    )}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {isAdmin && (
                <button
                  onClick={() => handleNavClick("admin")}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-none",
                    "text-sm font-medium transition-all duration-200",
                    activeTab === "admin"
                      ? "bg-white/[0.08] text-foreground border border-white/[0.1]"
                      : "text-foreground-muted hover:text-foreground hover:bg-white/[0.04]"
                  )}
                >
                  <Shield size={18} />
                  <span>Admin</span>
                </button>
              )}
            </div>

            {/* Mobile Status Section */}
            <div className="p-4 border-t border-white/[0.06] space-y-3">
              {/* Connection */}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-foreground-muted">Status</span>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-none",
                      isConnected ? "bg-emerald-400" : "bg-neutral-500"
                    )}
                  />
                  <span className="text-sm text-foreground">
                    {isConnected ? "Live" : "Offline"}
                  </span>
                </div>
              </div>

              {/* Trading Toggle */}
              <button
                onClick={isPaused ? onResume : onPause}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-none",
                  "text-sm font-medium transition-all",
                  isPaused
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-white/[0.04] text-foreground border border-white/[0.06]"
                )}
              >
                <span>Trading</span>
                <span>{isPaused ? "Paused" : "Active"}</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
