import { useState, useEffect, useCallback } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  transformPositions,
  transformSignals,
  transformStats,
} from "@/lib/transformers";
import PremiumTopBar from "@/components/Navigation/PremiumTopBar";
import CommandPalette from "@/components/Navigation/CommandPalette";
import { useCommandPalette } from "@/components/Navigation/useCommandPalette";
import LiveFeed from "@/components/LiveFeed";
import OpenPositions from "@/components/OpenPositions";
import RecentSignals from "@/components/RecentSignals";
import StatsBar from "@/components/StatsBar";
import AccountCard from "@/components/AccountCard";
import PerformanceChart from "@/components/PerformanceChart";
import SettingsPage from "@/components/Settings/SettingsPage";
import AdminPanel from "@/components/Admin/AdminPanel";
import SetupBanner from "@/components/SetupBanner";
import ProfilePage from "@/components/Profile/ProfilePage";
import { motion } from "framer-motion";

export default function Dashboard() {
  const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
    window.location.host
  }/ws`;
  const { events, isConnected, lastMessage } = useWebSocket(wsUrl);
  const { fetchData, postData } = useApi();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

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
    const [statsData, signalsData, positionsData, accountData] =
      await Promise.all([
        fetchData("/stats"),
        fetchData("/signals?limit=20"),
        fetchData("/positions"),
        fetchData("/account"),
      ]);

    if (statsData) setStats(transformStats(statsData));
    if (signalsData) setSignals(transformSignals(signalsData));
    if (positionsData) setOpenTrades(transformPositions(positionsData));
    if (accountData) setAccount(accountData);
  }, [fetchData]);

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Setup Banner - shows if system not configured */}
      <SetupBanner onNavigateToAdmin={() => setActiveTab("admin")} />

      {/* Top Section: Account Overview */}
      <section>
        <AccountCard account={account} />
        {stats && <StatsBar stats={stats} />}
      </section>

      {/* Main Grid - 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Column 1: Recent Signals (Detailed) */}
        <div className="lg:col-span-1">
          <RecentSignals
            signals={signals}
            isLoading={isLoading}
            onRefresh={() =>
              fetchData("/signals?limit=20").then(
                (d) => d && setSignals(transformSignals(d))
              )
            }
            telegramStatus={telegramStatus}
            onReconnect={isAdmin ? handleTelegramReconnect : null}
            isReconnecting={isReconnecting}
          />
        </div>

        {/* Column 2: Open Positions */}
        <div className="lg:col-span-1">
          <OpenPositions trades={openTrades} isLoading={isLoading} />
        </div>

        {/* Column 3: Activity (Live Feed) */}
        <div className="lg:col-span-2 xl:col-span-1">
          <LiveFeed events={events} />
        </div>
      </div>

      {/* Performance - Full Width Below */}
      <PerformanceChart stats={stats} isLoading={isLoading} />
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
            onReconnect={isAdmin ? handleTelegramReconnect : null}
            isReconnecting={isReconnecting}
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
      case "admin":
        return "Admin Dashboard";
      default:
        return "Trading Dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      {/* Premium Top Navigation */}
      <PremiumTopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
        isConnected={isConnected}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
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
      <motion.main
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="px-4 md:px-6 py-6 max-w-[1600px] mx-auto min-h-[calc(100vh-64px)]"
      >
        {renderPage()}
      </motion.main>
    </div>
  );
}
