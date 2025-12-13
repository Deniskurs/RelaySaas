import { useState, useEffect, useCallback, useMemo } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useMultiRefresh } from "@/hooks/useRefresh";
import {
  transformPositions,
  transformSignals,
  transformStats,
} from "@/lib/transformers";
import Sidebar, { SIDEBAR_EXPANDED_WIDTH, SIDEBAR_COLLAPSED_WIDTH, STORAGE_KEY } from "@/components/Navigation/Sidebar";
import MobileTopBar from "@/components/Navigation/MobileTopBar";
import BottomTabBar from "@/components/Navigation/BottomTabBar";
import CommandPalette from "@/components/Navigation/CommandPalette";
import { useCommandPalette } from "@/components/Navigation/useCommandPalette";
import LiveFeed from "@/components/LiveFeed";
import OpenPositions from "@/components/OpenPositions";
import RecentSignals from "@/components/RecentSignals";
import HeroMetrics from "@/components/HeroMetrics";
import AlertBanner, { useAlertSystem } from "@/components/AlertBanner";
import PerformanceChart from "@/components/PerformanceChart";
import SettingsPage from "@/components/Settings/SettingsPage";
import AdminPanel from "@/components/Admin/AdminPanel";
import SetupBanner from "@/components/SetupBanner";
import UserSetupBanner from "@/components/UserSetupBanner";
import ProfilePage from "@/components/Profile/ProfilePage";
import { PricingPage } from "@/components/Plans";
import {
  SoftUpgradeBanner,
  WarningUpgradeBanner,
  LimitReachedModal,
} from "@/components/Plans";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function Dashboard() {
  const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
    window.location.host
  }/ws`;
  const { events, isConnected, lastMessage } = useWebSocket(wsUrl);
  const { fetchData, postData } = useApi();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { isRefreshing, refreshAll } = useMultiRefresh();

  const [account, setAccount] = useState({
    balance: 0,
    equity: 0,
    margin: 0,
    freeMargin: 0,
  });
  const [stats, setStats] = useState(null);
  const [signals, setSignals] = useState([]);
  const [openTrades, setOpenTrades] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState(null);

  // Track sidebar collapsed state for layout
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : false;
  });

  // Listen for sidebar collapse changes
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      setSidebarCollapsed(stored ? JSON.parse(stored) : false);
    };

    // Poll for changes since storage events don't fire in same window
    const interval = setInterval(handleStorageChange, 100);
    return () => clearInterval(interval);
  }, []);

  // Command palette keyboard shortcut
  useCommandPalette(() => setCommandPaletteOpen(true));

  // Initial data fetch
  useEffect(() => {
    const loadData = async (showLoader = false) => {
      if (showLoader) setIsLoading(true);

      try {
        const [
          statsData,
          signalsData,
          positionsData,
          settingsData,
          accountData,
        ] = await Promise.all([
          fetchData("/stats"),
          fetchData("/signals?limit=20"),
          fetchData("/positions"),
          fetchData("/settings"),
          fetchData("/account"),
        ]);

        if (statsData) setStats(transformStats(statsData));
        if (signalsData) setSignals(transformSignals(signalsData));
        if (positionsData) setOpenTrades(transformPositions(positionsData));
        if (settingsData) setIsPaused(settingsData.paused);
        if (accountData) setAccount(accountData);
      } finally {
        setIsLoading(false);
      }
    };

    loadData(true);
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Telegram connection status polling
  useEffect(() => {
    const loadTelegramStatus = async () => {
      try {
        const status = await fetchData("/telegram/connection-status");
        if (status) setTelegramStatus(status);
      } catch (e) {
        // Silently fail - endpoint may not be available
      }
    };

    loadTelegramStatus();
    const interval = setInterval(loadTelegramStatus, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Handle WebSocket updates
  useEffect(() => {
    if (!lastMessage) return;

    const { type, data } = lastMessage;

    switch (type) {
      case "account.updated":
        setAccount(data);
        // Positions are updated along with account info
        fetchData("/positions").then(
          (d) => d && setOpenTrades(transformPositions(d))
        );
        break;
      case "signal.received":
      case "signal.parsed":
      case "signal.validated":
      case "signal.executed":
      case "signal.failed":
      case "signal.skipped":
        fetchData("/signals?limit=20").then(
          (d) => d && setSignals(transformSignals(d))
        );
        fetchData("/stats").then((d) => d && setStats(transformStats(d)));
        break;
      case "trade.opened":
      case "trade.closed":
      case "trade.updated":
        fetchData("/positions").then(
          (d) => d && setOpenTrades(transformPositions(d))
        );
        fetchData("/stats").then((d) => d && setStats(transformStats(d)));
        break;
    }
  }, [lastMessage, fetchData]);

  const handlePause = async () => {
    await postData("/control/pause");
    setIsPaused(true);
  };

  const handleResume = async () => {
    await postData("/control/resume");
    setIsPaused(false);
  };

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [liveFeedExpanded, setLiveFeedExpanded] = useState(false);

  // Alert system for critical events
  const { alerts } = useAlertSystem({
    telegramStatus,
    mt5Connected: isConnected,
    account,
    recentFailures: signals.filter(s =>
      s.status?.toLowerCase() === "failed" &&
      s.timestamp &&
      Date.now() - new Date(s.timestamp).getTime() < 5 * 60 * 1000
    ).map(s => ({ timestamp: s.timestamp, reason: s.failureReason })),
  });

  // Get pending signals that need action
  const pendingSignals = useMemo(() =>
    signals.filter(s => s.status?.toLowerCase() === "pending_confirmation"),
    [signals]
  );

  const handleTelegramReconnect = async () => {
    if (isReconnecting) return; // Prevent multiple clicks
    setIsReconnecting(true);
    try {
      await postData("/admin/telegram/reconnect");
      // Refresh status after reconnect attempt
      const status = await fetchData("/telegram/connection-status");
      if (status) setTelegramStatus(status);
    } catch (e) {
      console.error("Reconnect failed:", e);
    } finally {
      // Add delay before allowing another reconnect
      setTimeout(() => setIsReconnecting(false), 3000);
    }
  };

  // Refresh all data - used by command palette
  const handleRefresh = useCallback(async () => {
    await refreshAll([
      {
        name: "Stats",
        operation: async () => {
          const data = await fetchData("/stats");
          if (data) setStats(transformStats(data));
          return data;
        },
      },
      {
        name: "Signals",
        operation: async () => {
          const data = await fetchData("/signals?limit=20");
          if (data) setSignals(transformSignals(data));
          return data;
        },
      },
      {
        name: "Positions",
        operation: async () => {
          const data = await fetchData("/positions");
          if (data) setOpenTrades(transformPositions(data));
          return data;
        },
      },
      {
        name: "Account",
        operation: async () => {
          const data = await fetchData("/account");
          if (data) setAccount(data);
          return data;
        },
      },
    ]);
  }, [fetchData, refreshAll]);

  // Handle alert actions
  const handleAlertAction = (actionId, alert) => {
    switch (actionId) {
      case "reconnect":
        handleTelegramReconnect();
        break;
      case "settings":
        setActiveTab("settings");
        break;
      case "view_signals":
        setActiveTab("signals");
        break;
      default:
        break;
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* CRITICAL ALERTS - Sticky at top */}
      <AlertBanner
        alerts={alerts}
        onAction={handleAlertAction}
        onDismiss={(alertId) => console.log("Dismissed:", alertId)}
      />

      {/* Setup Banner - shows if system not configured (admin only) */}
      <SetupBanner onNavigateToAdmin={() => setActiveTab("admin")} />

      {/* User Setup Banner - shows if user's personal setup incomplete (all users) */}
      <UserSetupBanner onNavigateToSettings={() => setActiveTab("settings")} />

      {/* HERO METRICS - Most important info first */}
      <HeroMetrics
        stats={stats}
        account={account}
        openTrades={openTrades}
      />

      {/* ACTIVE MONITORING - 2 Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Positions - Left Column */}
        <div>
          <OpenPositions trades={openTrades} isLoading={isLoading} />
        </div>

        {/* Recent/Pending Signals - Right Column */}
        <div>
          <RecentSignals
            signals={pendingSignals.length > 0 ? pendingSignals : signals.slice(0, 5)}
            isLoading={isLoading}
            onRefresh={() =>
              fetchData("/signals?limit=20").then(
                (d) => d && setSignals(transformSignals(d))
              )
            }
            telegramStatus={telegramStatus}
            onReconnect={handleTelegramReconnect}
            isReconnecting={isReconnecting}
            onNavigateSettings={() => setActiveTab("settings")}
          />
        </div>
      </div>

      {/* PERFORMANCE - Full Width Chart */}
      <PerformanceChart stats={stats} isLoading={isLoading} />

      {/* SYSTEM HEALTH - Collapsible Live Feed */}
      <div className="border border-white/[0.06] rounded-none bg-black/40 backdrop-blur-sm overflow-hidden">
        <button
          onClick={() => setLiveFeedExpanded(!liveFeedExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground/90">
              System Activity
            </span>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-success" : "bg-destructive"}`} />
              <span className="text-xs text-foreground-muted">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {events.length > 0 && (
              <span className="text-xs text-foreground-muted font-mono">
                {events.length} events
              </span>
            )}
            {liveFeedExpanded ? (
              <ChevronUp size={16} className="text-foreground-muted" />
            ) : (
              <ChevronDown size={16} className="text-foreground-muted" />
            )}
          </div>
        </button>

        <AnimatePresence>
          {liveFeedExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="border-t border-white/[0.06] overflow-hidden"
            >
              <LiveFeed events={events} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (activeTab) {
      case "settings":
        return <SettingsPage />;
      case "signals":
        return (
          <RecentSignals
            signals={signals}
            isLoading={isLoading}
            onRefresh={() =>
              fetchData("/signals?limit=20").then(
                (d) => d && setSignals(transformSignals(d))
              )
            }
            telegramStatus={telegramStatus}
            onReconnect={handleTelegramReconnect}
            isReconnecting={isReconnecting}
            onNavigateSettings={() => setActiveTab("settings")}
            fullPage
          />
        );
      case "positions":
        return (
          <OpenPositions trades={openTrades} isLoading={isLoading} fullPage />
        );
      case "account":
        return (
          <div className="space-y-6">
            <AccountCard account={account} />
            <PerformanceChart stats={stats} isLoading={isLoading} />
          </div>
        );
      case "profile":
        return <ProfilePage />;
      case "pricing":
        return (
          <PricingPage
            onSelectPlan={(planId) => {
              console.log("Selected plan:", planId);
              // TODO: Integrate with Stripe checkout
            }}
          />
        );
      case "admin":
        return isAdmin ? <AdminPanel /> : renderDashboard();
      case "dashboard":
      default:
        return renderDashboard();
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case "settings":
        return "Settings";
      case "signals":
        return "Signal History";
      case "positions":
        return "Open Positions";
      case "account":
        return "Account";
      case "profile":
        return "Profile";
      case "pricing":
        return "Pricing Plans";
      case "admin":
        return "Admin Dashboard";
      default:
        return "Trading Dashboard";
    }
  };

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      {/* Desktop Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
        isConnected={isConnected}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* Mobile Top Bar */}
      <MobileTopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isConnected={isConnected}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onTabChange={setActiveTab}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
        onRefresh={handleRefresh}
      />

      {/* Main Content */}
      <motion.div
        initial={false}
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:block"
      >
        <motion.main
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="px-6 py-6 min-h-screen max-w-[1600px]"
        >
          {renderPage()}
        </motion.main>
      </motion.div>

      {/* Mobile Main Content */}
      <motion.main
        key={`mobile-${activeTab}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="lg:hidden px-4 py-4 pb-24 min-h-screen"
      >
        {renderPage()}
      </motion.main>
    </div>
  );
}
