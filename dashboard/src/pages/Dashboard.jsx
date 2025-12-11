import { useState, useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useApi } from "@/hooks/useApi";
import { transformPositions, transformSignals, transformStats } from "@/lib/transformers";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import Sidebar from "@/components/Layout/Sidebar";
import LiveFeed from "@/components/LiveFeed";
import OpenPositions from "@/components/OpenPositions";
import RecentSignals from "@/components/RecentSignals";
import StatsBar from "@/components/StatsBar";
import AccountCard from "@/components/AccountCard";
import PerformanceChart from "@/components/PerformanceChart";
import SettingsPage from "@/components/Settings/SettingsPage";

export default function Dashboard() {
  const wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
    window.location.host
  }/ws`;
  const { events, isConnected, lastMessage } = useWebSocket(wsUrl);
  const { fetchData, postData } = useApi();

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initial data fetch
  useEffect(() => {
    const loadData = async (showLoader = false) => {
      if (showLoader) setIsLoading(true);

      try {
        const [statsData, signalsData, positionsData, settingsData, accountData] =
          await Promise.all([
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

  // Handle WebSocket updates
  useEffect(() => {
    if (!lastMessage) return;

    const { type, data } = lastMessage;

    switch (type) {
      case "account.updated":
        setAccount(data);
        // Positions are updated along with account info
        fetchData("/positions").then((d) => d && setOpenTrades(transformPositions(d)));
        break;
      case "signal.received":
      case "signal.parsed":
      case "signal.validated":
      case "signal.executed":
      case "signal.failed":
      case "signal.skipped":
        fetchData("/signals?limit=20").then((d) => d && setSignals(transformSignals(d)));
        fetchData("/stats").then((d) => d && setStats(transformStats(d)));
        break;
      case "trade.opened":
      case "trade.closed":
      case "trade.updated":
        fetchData("/positions").then((d) => d && setOpenTrades(transformPositions(d)));
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

  const renderDashboard = () => (
    <div className="space-y-6">
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
            onRefresh={() => fetchData("/signals?limit=20").then((d) => d && setSignals(transformSignals(d)))}
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
            onRefresh={() => fetchData("/signals?limit=20").then((d) => d && setSignals(transformSignals(d)))}
            fullPage
          />
        );
      case "positions":
        return <OpenPositions trades={openTrades} isLoading={isLoading} fullPage />;
      case "account":
        return (
          <div className="space-y-6">
            <AccountCard account={account} />
            <PerformanceChart stats={stats} isLoading={isLoading} />
          </div>
        );
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
      default:
        return "Trading Dashboard";
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onCollapsedChange={setSidebarCollapsed}
      />
      <div
        className="flex-1 transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
      >
        <DashboardLayout
          title={getPageTitle()}
          isPaused={isPaused}
          onPause={handlePause}
          onResume={handleResume}
          isConnected={isConnected}
        >
          {renderPage()}
        </DashboardLayout>
      </div>
    </div>
  );
}
