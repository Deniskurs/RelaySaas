import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useUnsavedChangesContext } from "@/contexts/UnsavedChangesContext";
import { useMultiRefresh, useRefresh } from "@/hooks/useRefresh";
import { useSignalSounds } from "@/hooks/useSound";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import {
  transformPositions,
  transformSignals,
  transformStats,
} from "@/lib/transformers";

// Polling intervals (ms)
const POLL_INTERVAL_FAST = 10000;  // 10s for critical trading data
const POLL_INTERVAL_SLOW = 30000; // 30s for less critical data

// Lazy load heavy components that aren't needed on initial render
const SettingsPage = lazy(() => import("@/components/Settings/SettingsPage"));
const AdminPanel = lazy(() => import("@/components/Admin/AdminPanel"));
const PerformanceChart = lazy(() => import("@/components/PerformanceChart"));
const ProfilePage = lazy(() => import("@/components/Profile/ProfilePage"));
const PricingPageLazy = lazy(() => import("@/components/Plans").then(m => ({ default: m.PricingPage })));

import Sidebar, { SIDEBAR_EXPANDED_WIDTH, SIDEBAR_COLLAPSED_WIDTH, STORAGE_KEY } from "@/components/Navigation/Sidebar";
import UnsavedChangesDialog from "@/components/Settings/UnsavedChangesDialog";
import MobileTopBar from "@/components/Navigation/MobileTopBar";
import BottomTabBar from "@/components/Navigation/BottomTabBar";
import CommandPalette from "@/components/Navigation/CommandPalette";
import { useCommandPalette } from "@/components/Navigation/useCommandPalette";
import LiveFeed from "@/components/LiveFeed";
import OpenPositions from "@/components/OpenPositions";
import RecentSignals from "@/components/RecentSignals";
import HeroMetrics from "@/components/HeroMetrics";
import AlertBanner, { useAlertSystem } from "@/components/AlertBanner";
import SetupBanner from "@/components/SetupBanner";
import UserSetupBanner from "@/components/UserSetupBanner";
import {
  SoftUpgradeBanner,
  WarningUpgradeBanner,
  LimitReachedModal,
} from "@/components/Plans";
import { motion, AnimatePresence } from "framer-motion";

// Lightweight loading fallback for lazy components
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
  </div>
);
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
  const [activeTab, setActiveTabInternal] = useState("dashboard");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Unsaved changes context for blocking navigation
  const unsavedChangesContext = useUnsavedChangesContext();

  // Use ref to always get fresh context values in event handlers
  const unsavedChangesRef = useRef(unsavedChangesContext);
  useEffect(() => {
    unsavedChangesRef.current = unsavedChangesContext;
  }, [unsavedChangesContext]);

  // Hide splash when dashboard data finishes loading
  useEffect(() => {
    if (!isLoading) {
      window.__hideSplash?.();
    }
  }, [isLoading]);

  // State for unsaved changes dialog
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);
  const [isSavingFromDialog, setIsSavingFromDialog] = useState(false);

  // Wrapped tab change that checks for unsaved changes
  // Uses ref to ensure we always read the latest context value
  const setActiveTab = useCallback((newTab) => {
    const { hasUnsavedChanges } = unsavedChangesRef.current;
    // If we're on settings and have unsaved changes, block navigation
    if (activeTab === "settings" && hasUnsavedChanges && newTab !== "settings") {
      setPendingTab(newTab);
      setShowUnsavedDialog(true);
      return; // Don't change tab yet - show dialog
    }
    setActiveTabInternal(newTab);
  }, [activeTab]);

  // Dialog handlers - use ref to get fresh callback references
  const handleDialogSave = async () => {
    const { onSave } = unsavedChangesRef.current;
    if (onSave) {
      setIsSavingFromDialog(true);
      try {
        await onSave();
        setShowUnsavedDialog(false);
        if (pendingTab) {
          setActiveTabInternal(pendingTab);
          setPendingTab(null);
        }
      } finally {
        setIsSavingFromDialog(false);
      }
    }
  };

  const handleDialogDiscard = () => {
    const { onDiscard } = unsavedChangesRef.current;
    if (onDiscard) {
      onDiscard();
    }
    setShowUnsavedDialog(false);
    if (pendingTab) {
      setActiveTabInternal(pendingTab);
      setPendingTab(null);
    }
  };

  const handleDialogCancel = () => {
    setShowUnsavedDialog(false);
    setPendingTab(null);
  };
  const [telegramStatus, setTelegramStatus] = useState(null);

  // Sound notifications (disabled by default, user can enable)
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem("signalSoundsEnabled") === "true";
  });
  const { handleSignalUpdate, play: playSound } = useSignalSounds(soundEnabled);

  const handleSoundToggle = useCallback(() => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem("signalSoundsEnabled", newValue.toString());
    // Play a test sound when enabling
    if (newValue) {
      playSound("received");
    }
  }, [soundEnabled, playSound]);

  // Track sidebar collapsed state for layout
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : false;
  });

  // Listen for sidebar collapse changes via custom event (more efficient than polling)
  useEffect(() => {
    const handleSidebarChange = (e) => {
      setSidebarCollapsed(e.detail?.collapsed ?? false);
    };

    // Also handle storage event for cross-tab sync
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY) {
        setSidebarCollapsed(e.newValue ? JSON.parse(e.newValue) : false);
      }
    };

    window.addEventListener('sidebar-collapse', handleSidebarChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('sidebar-collapse', handleSidebarChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Command palette keyboard shortcut
  useCommandPalette(() => setCommandPaletteOpen(true));

  // Load all data function
  const loadData = useCallback(async (showLoader = false) => {
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
  }, [fetchData]);

  // Initial data fetch on mount (visibility polling handles the rest)
  useEffect(() => {
    window.__setSplashProgress?.(80);
    loadData(true);
  }, [loadData]);

  // Main data polling - pauses when tab is hidden to save CPU/battery
  useVisibilityPolling(
    useCallback(() => loadData(false), [loadData]),
    POLL_INTERVAL_FAST,
    { runOnMount: false, runOnVisible: true }
  );

  // Telegram status loading function
  const loadTelegramStatus = useCallback(async () => {
    try {
      const status = await fetchData("/telegram/connection-status");
      if (status) setTelegramStatus(status);
    } catch (e) {
      // Silently fail - endpoint may not be available
    }
  }, [fetchData]);

  // Telegram connection status polling - pauses when tab is hidden
  useVisibilityPolling(loadTelegramStatus, POLL_INTERVAL_FAST, {
    runOnMount: true,
    runOnVisible: true
  });

  // Debounced fetch refs to avoid rapid re-fetching
  const pendingFetchRef = useRef({ signals: null, positions: null, stats: null });

  // Debounced fetch helper - batches rapid updates into single fetch
  const debouncedFetch = useCallback((key, fetchFn, delayMs = 500) => {
    if (pendingFetchRef.current[key]) {
      clearTimeout(pendingFetchRef.current[key]);
    }
    pendingFetchRef.current[key] = setTimeout(() => {
      fetchFn();
      pendingFetchRef.current[key] = null;
    }, delayMs);
  }, []);

  // Handle WebSocket updates - use event data directly for instant updates
  useEffect(() => {
    if (!lastMessage) return;

    const { type, data } = lastMessage;

    switch (type) {
      case "account.updated":
        // Use account data directly - instant update
        if (data) setAccount(data);
        // Debounce positions fetch (account update often means position changes)
        debouncedFetch('positions', () =>
          fetchData("/positions").then(d => d && setOpenTrades(transformPositions(d)))
        );
        break;

      case "signal.received":
      case "signal.parsed":
      case "signal.validated":
      case "signal.pending_confirmation":
      case "signal.executed":
      case "signal.failed":
      case "signal.skipped":
        // Trigger sound notification immediately (critical for UX)
        if (data) {
          const statusFromType = type.replace("signal.", "");
          handleSignalUpdate({ ...data, status: statusFromType });

          // INSTANT UPDATE: Insert/update signal in state directly
          setSignals(prev => {
            const signalId = data.id || data.signal_id;
            const newSignal = { ...data, status: statusFromType };

            // Check if signal already exists
            const existingIndex = prev.findIndex(s =>
              s.id === signalId || s.signal_id === signalId
            );

            if (existingIndex >= 0) {
              // Update existing signal
              const updated = [...prev];
              updated[existingIndex] = { ...updated[existingIndex], ...newSignal };
              return updated;
            } else {
              // Add new signal at the beginning
              return [newSignal, ...prev].slice(0, 20);
            }
          });
        }

        // Background fetch to ensure consistency (debounced)
        debouncedFetch('signals', () =>
          fetchData("/signals?limit=20").then(d => d && setSignals(transformSignals(d)))
        , 1000);
        debouncedFetch('stats', () =>
          fetchData("/stats").then(d => d && setStats(transformStats(d)))
        , 1500);
        break;

      case "trade.opened":
      case "trade.closed":
      case "trade.updated":
        // For trades, use event data if available for instant feedback
        if (data && type === "trade.opened") {
          setOpenTrades(prev => [data, ...prev]);
        } else if (data && type === "trade.closed") {
          setOpenTrades(prev => prev.filter(t =>
            t.ticket !== data.ticket && t.id !== data.id
          ));
        } else if (data && type === "trade.updated") {
          setOpenTrades(prev => prev.map(t =>
            (t.ticket === data.ticket || t.id === data.id) ? { ...t, ...data } : t
          ));
        }

        // Background fetch to ensure consistency (debounced)
        debouncedFetch('positions', () =>
          fetchData("/positions").then(d => d && setOpenTrades(transformPositions(d)))
        , 500);
        debouncedFetch('stats', () =>
          fetchData("/stats").then(d => d && setStats(transformStats(d)))
        , 1000);
        break;
    }
  }, [lastMessage, fetchData, handleSignalUpdate, debouncedFetch]);

  const handlePause = async () => {
    await postData("/control/pause");
    setIsPaused(true);
  };

  const handleResume = async () => {
    await postData("/control/resume");
    setIsPaused(false);
  };

  const [liveFeedExpanded, setLiveFeedExpanded] = useState(false);

  // Reconnect hook with toast feedback
  const { isRefreshing: isReconnecting, refresh: doReconnect } = useRefresh({
    loadingMessage: "Reconnecting Telegram...",
    successMessage: "Telegram connected",
    errorMessage: "Connection failed",
  });

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
    await doReconnect(async () => {
      // Try multi-tenant reconnect first
      try {
        await postData("/system/connect-me");
      } catch (e) {
        // Fall back to admin reconnect for single-user mode
        await postData("/admin/telegram/reconnect");
      }

      // Fetch updated status
      const status = await fetchData("/telegram/connection-status");
      if (status) setTelegramStatus(status);

      // Check if actually connected
      if (!status?.connected) {
        throw new Error("Still disconnected - check your Telegram session");
      }

      return status;
    });
  };

  // Refresh stats only - used by Performance sync button
  const handleStatsRefresh = useCallback(async () => {
    const data = await fetchData("/stats");
    if (data) setStats(transformStats(data));
  }, []);

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

      {/* ACTIVE MONITORING - 2 Column Grid (desktop) / Reversed on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent/Pending Signals - PRIORITY on mobile (order-1), Right Column on desktop */}
        <div className="order-1 lg:order-2">
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
            soundEnabled={soundEnabled}
            onSoundToggle={handleSoundToggle}
            playSound={playSound}
            pendingCount={pendingSignals.length}
            hasPendingSignals={pendingSignals.length > 0}
          />
        </div>

        {/* Open Positions - Secondary on mobile (order-2), Left Column on desktop */}
        <div className="order-2 lg:order-1">
          <OpenPositions trades={openTrades} isLoading={isLoading} />
        </div>
      </div>

      {/* PERFORMANCE - Full Width Chart (lazy loaded) */}
      <Suspense fallback={<PageLoader />}>
        <PerformanceChart stats={stats} isLoading={isLoading} onStatsRefresh={handleStatsRefresh} />
      </Suspense>

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
        return (
          <Suspense fallback={<PageLoader />}>
            <SettingsPage />
          </Suspense>
        );
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
            soundEnabled={soundEnabled}
            onSoundToggle={handleSoundToggle}
            playSound={playSound}
            fullPage
          />
        );
      case "positions":
        return (
          <OpenPositions trades={openTrades} isLoading={isLoading} fullPage />
        );
      case "account":
        return (
          <Suspense fallback={<PageLoader />}>
            <div className="space-y-6">
              <AccountCard account={account} openTrades={openTrades} />
              <PerformanceChart stats={stats} isLoading={isLoading} onStatsRefresh={handleStatsRefresh} />
            </div>
          </Suspense>
        );
      case "profile":
        return (
          <Suspense fallback={<PageLoader />}>
            <ProfilePage />
          </Suspense>
        );
      case "pricing":
        return (
          <Suspense fallback={<PageLoader />}>
            <PricingPageLazy
              onSelectPlan={(planId) => {
                console.log("Selected plan:", planId);
                // TODO: Integrate with Stripe checkout
              }}
            />
          </Suspense>
        );
      case "admin":
        return isAdmin ? (
          <Suspense fallback={<PageLoader />}>
            <AdminPanel />
          </Suspense>
        ) : renderDashboard();
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
        pendingSignalsCount={pendingSignals.length}
      />

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isPaused={isPaused}
        onPause={handlePause}
        onResume={handleResume}
        pendingSignalsCount={pendingSignals.length}
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

      {/* Unsaved Changes Dialog (for navigating away from Settings) */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
        isSaving={isSavingFromDialog}
      />
    </div>
  );
}
