import { motion } from "framer-motion";
import { User, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useNavigate } from "react-router-dom";
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
import { LogOut, Shield, CreditCard } from "lucide-react";
import { Logo, BrandName } from "../Brand/Brand";

export default function MobileTopBar({
  activeTab,
  onTabChange,
  isConnected,
  onOpenCommandPalette,
  pendingSignalsCount = 0,
}) {
  const { user, profile, logout } = useAuth();
  const { currency, setCurrency, currencies } = useCurrency();
  const navigate = useNavigate();
  const isAdmin = profile?.role === "admin";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case "settings":
        return "Settings";
      case "profile":
        return "Profile";
      case "admin":
        return "Admin";
      default:
        return "Relay";
    }
  };

  return (
    <header
      className={cn(
        "lg:hidden h-14 sticky top-0 z-50",
        "flex items-center justify-between px-4",
        "border-b border-white/[0.04]"
      )}
      style={{
        background:
          "linear-gradient(180deg, rgba(15,15,20,0.95), rgba(10,10,15,0.92))",
        backdropFilter: "blur(20px) saturate(180%)",
        boxShadow:
          "inset 0 -1px 0 rgba(255,255,255,0.03), 0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      {/* Left: Logo/Title */}
      <motion.div
        className="flex items-center gap-2.5 cursor-pointer relative"
        onClick={() => onTabChange("dashboard")}
        whileTap={{ scale: 0.98 }}
      >
        <div className="w-7 h-7 relative flex items-center justify-center">
          <Logo size={28} />
          {/* Pending Signal Notification Badge */}
          {pendingSignalsCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-primary text-white text-[9px] font-bold rounded-full px-1 border border-black/50 shadow-lg"
            >
              {pendingSignalsCount > 9 ? "9+" : pendingSignalsCount}
            </motion.div>
          )}
        </div>
        <div className="flex flex-col">
          {/* If we are on a specific page that isn't dashboard, we might want to show that title,
               but for branding consistency "Relay" should always be visible or at least the Logo.
               The previous code showed getPageTitle(). Let's keep showing the specific page title
               but styled better, OR show BrandName if it's the dashboard.

               Actually, the user wants "Relay" branding. Let's start with showing BrandName
               and maybe the page title in a different way or just stick to BrandName for now
               to maximize the "premium brand" feeling.

               If I look at getPageTitle logic:
               case "settings": return "Settings";
               ...
               default: return "Relay";

               So if it's not a special page, it shows Relay.

               Let's render BrandName if activeTab is dashboard, otherwise the page title
               BUT styled nicely.
           */}
          {activeTab === "dashboard" ? (
            <BrandName className="items-start" />
          ) : (
            <span className="text-sm font-semibold tracking-tight text-foreground uppercase">
              {getPageTitle()}
            </span>
          )}
        </div>
      </motion.div>

      {/* Right: Status, Search, User */}
      <div className="flex items-center gap-3">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
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
          <span className="text-[10px] text-foreground-subtle uppercase tracking-wide">
            {isConnected ? "Live" : "Off"}
          </span>
        </div>

        {/* Search Button - 44px touch target for accessibility */}
        <motion.button
          onClick={onOpenCommandPalette}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "w-10 h-10 flex items-center justify-center",
            "bg-white/[0.04] hover:bg-white/[0.08]",
            "border border-white/[0.04]",
            "text-foreground-muted"
          )}
          aria-label="Open search"
        >
          <Search size={18} />
        </motion.button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className={cn(
                "flex items-center gap-1.5 p-1",
                "bg-white/[0.03] hover:bg-white/[0.06]",
                "border border-white/[0.04]",
                "transition-all duration-200"
              )}
            >
              <div className="w-7 h-7 bg-white/10 flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-7 h-7 object-cover"
                  />
                ) : (
                  <User size={14} className="text-foreground-muted" />
                )}
              </div>
              <ChevronDown size={12} className="text-foreground-subtle" />
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
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
          >
            {/* User Info */}
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

            {/* Plans & Pricing */}
            <DropdownMenuItem
              onClick={() => onTabChange("pricing")}
              className="gap-2 py-2 cursor-pointer focus:bg-white/[0.06]"
            >
              <CreditCard size={14} className="text-foreground-muted" />
              <span>Plans & Pricing</span>
            </DropdownMenuItem>

            {/* Currency */}
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

            {/* Admin */}
            {isAdmin && (
              <DropdownMenuItem
                onClick={() => onTabChange("admin")}
                className="gap-2 py-2 cursor-pointer focus:bg-white/[0.06]"
              >
                <Shield size={14} className="text-foreground-muted" />
                <span>Admin Panel</span>
              </DropdownMenuItem>
            )}

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
    </header>
  );
}
