import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Save,
  RotateCcw,
  AlertCircle,
  Check,
  Loader2,
  Plug,
  Zap,
  BarChart3,
  Settings2,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useApi } from "@/hooks/useApi";
import { useRefresh } from "@/hooks/useRefresh";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import UnsavedChangesDialog from "./UnsavedChangesDialog";

// Tab components
import ConnectionsTab from "./tabs/ConnectionsTab";
import QuickSettingsTab from "./tabs/QuickSettingsTab";
import LotSizingTab from "./tabs/LotSizingTab";
import TradeExecutionTab from "./tabs/TradeExecutionTab";
import AdvancedTab from "./tabs/AdvancedTab";

const TABS = [
  { id: "connections", label: "Connections", icon: Plug },
  { id: "quick", label: "Quick Settings", icon: Zap },
  { id: "lot-sizing", label: "Lot Sizing", icon: BarChart3 },
  { id: "execution", label: "Execution", icon: Settings2 },
  { id: "advanced", label: "Advanced", icon: Wrench },
];

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    settings,
    isLoading,
    isSaving,
    error,
    updateSettings,
  } = useSettings();
  const { currencyData } = useCurrency();
  const [localSettings, setLocalSettings] = useState(settings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Tab state with URL sync
  const [activeTab, setActiveTab] = useState(() => {
    const urlTab = searchParams.get("tab");
    const savedTab = localStorage.getItem("settings-active-tab");
    return urlTab || savedTab || "connections";
  });

  // Sync tab to URL and localStorage
  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true });
    localStorage.setItem("settings-active-tab", activeTab);
  }, [activeTab, setSearchParams]);

  // Refresh hook for account data - tries to reconnect
  const { isRefreshing: isRefreshingAccount, refresh: refreshAccount } = useRefresh({
    loadingMessage: "Reconnecting services...",
    successMessage: "All services connected",
    errorMessage: "Connection issue",
  });

  // Telegram credentials state
  const [telegramCreds, setTelegramCreds] = useState({
    telegram_api_id: "",
    telegram_api_hash: "",
    telegram_phone: "",
    telegram_connected: false,
  });
  const [telegramCredsOriginal, setTelegramCredsOriginal] = useState(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramError, setTelegramError] = useState("");
  const [hasTelegramChanges, setHasTelegramChanges] = useState(false);
  const [configStatus, setConfigStatus] = useState({});

  // MetaTrader credentials state
  const [mtCreds, setMtCreds] = useState({
    mt_login: "",
    mt_server: "",
    mt_platform: "mt5",
    metaapi_account_id: "",
    mt_connected: false,
  });

  useEffect(() => {
    setLocalSettings(settings);
    setHasChanges(false);
  }, [settings]);

  // Load user credentials from the user credentials endpoint
  const { fetchData, postData } = useApi();

  const loadUserCredentials = async () => {
    setTelegramLoading(true);
    try {
      // Fetch from user credentials endpoint - this is where onboarding saved credentials
      const userCreds = await fetchData("/user/credentials");

      if (userCreds) {
        // Track which sensitive fields are already set (for showing "Set" badges)
        setConfigStatus({
          telegram_api_hash_set: userCreds.telegram_api_hash_set || false,
          telegram_api_hash_preview: "",
          metaapi_token_set: false,
        });

        // Load Telegram credentials from user's onboarding data
        const telegramCredsData = {
          telegram_api_id: userCreds.telegram_api_id || "",
          telegram_api_hash: userCreds.telegram_api_hash || "",
          telegram_phone: userCreds.telegram_phone || "",
          telegram_connected: userCreds.telegram_connected || false,
        };
        setTelegramCreds(telegramCredsData);
        setTelegramCredsOriginal(telegramCredsData);

        // Load MetaTrader credentials from user's onboarding data
        setMtCreds({
          mt_login: userCreds.mt_login || "",
          mt_server: userCreds.mt_server || "",
          mt_platform: userCreds.mt_platform || "mt5",
          metaapi_account_id: userCreds.metaapi_account_id || "",
          mt_connected: userCreds.mt_connected || false,
        });
      }
      return userCreds;
    } catch (e) {
      console.error("Error loading user credentials:", e);
      throw e;
    } finally {
      setTelegramLoading(false);
    }
  };

  useEffect(() => {
    loadUserCredentials();
  }, [fetchData]);

  // Handle account data refresh - attempts to reconnect if disconnected
  const handleRefreshAccountData = async () => {
    await refreshAccount(async () => {
      // Try to reconnect the user's connections
      let connectResult = null;
      try {
        connectResult = await postData("/system/connect-me");
        console.log("Connect result:", connectResult);
      } catch (e) {
        console.log("Connect-me error:", e);
        throw new Error("Failed to reconnect - check server logs");
      }

      // Check if connect-me succeeded
      if (connectResult?.status === "failed") {
        throw new Error(connectResult.error || "Connection failed - check credentials");
      }

      // Use the LIVE status from connect-me result
      const telegramOk = connectResult?.telegram_connected;
      const mtOk = connectResult?.metaapi_connected;

      // Fetch updated credentials for display
      await loadUserCredentials();

      if (!telegramOk && !mtOk) {
        throw new Error("Both connections failed - check your credentials");
      } else if (!telegramOk) {
        throw new Error("Telegram listener failed to start");
      } else if (!mtOk) {
        throw new Error("MetaTrader connection failed - check MetaAPI token in Admin");
      }

      return { telegram_connected: telegramOk, metaapi_connected: mtOk };
    });
  };

  const updateLocal = (key, value) => {
    console.log("[SettingsPage] updateLocal:", key, "=", value);
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const updateTelegramCred = (key, value) => {
    setTelegramCreds((prev) => ({ ...prev, [key]: value }));
    setHasTelegramChanges(true);
    setSaveSuccess(false);
    setTelegramError("");
  };

  const handleSave = async () => {
    console.log("[SettingsPage] handleSave called");
    console.log("[SettingsPage] localSettings:", localSettings);
    console.log("[SettingsPage] telegram_channel_ids:", localSettings.telegram_channel_ids);
    const success = await updateSettings(localSettings);
    if (success) {
      setHasChanges(false);
    }
    return success;
  };

  const handleSaveTelegram = async () => {
    // Validation
    if (telegramCreds.telegram_api_id && !/^\d+$/.test(telegramCreds.telegram_api_id)) {
      setTelegramError("API ID must be a number");
      return false;
    }

    if (telegramCreds.telegram_phone && !/^\+?\d{10,15}$/.test(telegramCreds.telegram_phone.replace(/\s/g, ""))) {
      setTelegramError("Please enter a valid phone number with country code");
      return false;
    }

    setTelegramSaving(true);
    setTelegramError("");

    try {
      // Save to user credentials via onboarding endpoint
      const result = await postData("/onboarding/telegram", {
        api_id: telegramCreds.telegram_api_id,
        api_hash: telegramCreds.telegram_api_hash,
        phone: telegramCreds.telegram_phone,
      });

      if (!result || !result.success) {
        setTelegramError(result?.message || "Failed to save Telegram credentials");
        return false;
      }

      setTelegramCredsOriginal({ ...telegramCreds });
      setHasTelegramChanges(false);
      return true;
    } catch (e) {
      setTelegramError("An unexpected error occurred");
      return false;
    } finally {
      setTelegramSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setHasChanges(false);
  };

  const handleResetTelegram = () => {
    if (telegramCredsOriginal) {
      setTelegramCreds({ ...telegramCredsOriginal });
    }
    setHasTelegramChanges(false);
    setTelegramError("");
  };

  const anyChanges = hasChanges || hasTelegramChanges;
  const anySaving = isSaving || telegramSaving;

  // Save and Reset handlers (defined first for use in hooks below)
  const handleSaveAll = useCallback(async () => {
    let allSuccess = true;

    if (hasChanges) {
      const success = await handleSave();
      if (!success) allSuccess = false;
    }
    if (hasTelegramChanges) {
      const success = await handleSaveTelegram();
      if (!success) allSuccess = false;
    }

    if (allSuccess) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
    return allSuccess;
  }, [hasChanges, hasTelegramChanges]);

  const handleResetAll = useCallback(() => {
    handleReset();
    handleResetTelegram();
  }, []);

  // Unsaved changes warning state
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingTab, setPendingTab] = useState(null);

  // Hook for browser close/refresh warning
  useUnsavedChanges(anyChanges, handleSaveAll);

  // Handle tab change with unsaved changes check
  const handleTabChange = useCallback((newTab) => {
    if (anyChanges && newTab !== activeTab) {
      setPendingTab(newTab);
      setShowUnsavedDialog(true);
    } else {
      setActiveTab(newTab);
    }
  }, [anyChanges, activeTab]);

  // Dialog action handlers
  const handleDialogSave = async () => {
    const success = await handleSaveAll();
    if (!success) return; // Don't proceed if save failed

    setShowUnsavedDialog(false);

    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handleDialogDiscard = () => {
    handleResetAll();
    setShowUnsavedDialog(false);

    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  };

  const handleDialogCancel = () => {
    setShowUnsavedDialog(false);
    setPendingTab(null);
  };

  // Determine connection status for tab badges
  const connectionsNeedAttention = !telegramCreds.telegram_connected || !mtCreds.mt_connected;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between py-8 mb-2 shrink-0">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.02em]">
            Settings
          </h1>
          <p className="text-sm text-foreground-muted/80 italic mt-1">
            Configure your trading parameters and integrations
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {(error || telegramError) && (
            <span className="text-sm text-rose-400 flex items-center gap-1.5 bg-rose-500/10 px-3 py-1.5 rounded-none">
              <AlertCircle size={14} />
              <span className="italic">{error || telegramError}</span>
            </span>
          )}
          {saveSuccess && (
            <span className={cn(
              "text-sm text-emerald-400 flex items-center gap-1.5",
              "bg-emerald-500/10 px-3 py-2 rounded-sm",
              "border-l-2 border-accent-gold",
              "animate-in fade-in slide-in-from-right-2"
            )}>
              <Check size={14} />
              <span className="italic">Saved</span>
            </span>
          )}
          {anyChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAll}
              className="text-foreground-muted hover:text-foreground hover:bg-white/[0.05] h-9 px-3"
            >
              <RotateCcw size={14} className="mr-1.5" />
              Reset
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={!anyChanges || anySaving}
            className={cn(
              "h-10 px-5 rounded-none font-medium",
              "bg-foreground text-background",
              "hover:shadow-[0_4px_12px_rgba(255,255,255,0.15)]",
              "active:scale-[0.98]",
              "disabled:opacity-40 disabled:bg-white/[0.08] disabled:text-foreground-muted disabled:shadow-none",
              "transition-all duration-200"
            )}
          >
            {anySaving ? (
              <Loader2 size={14} className="mr-1.5 animate-spin" />
            ) : (
              <Save size={14} className="mr-1.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="flex-1 flex flex-col min-h-0"
      >
        {/* Tab List with horizontal scroll for mobile */}
        <div className="shrink-0 -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <TabsList className={cn(
            "inline-flex h-12 items-center gap-1 p-1",
            "bg-white/[0.02] border border-white/[0.06] rounded-none",
            "min-w-full sm:min-w-0"
          )}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const showBadge = tab.id === "connections" && connectionsNeedAttention;

              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2 rounded-none",
                    "text-sm font-medium whitespace-nowrap",
                    "text-foreground-muted/70",
                    "hover:text-foreground hover:bg-white/[0.03]",
                    "data-[state=active]:text-foreground data-[state=active]:bg-white/[0.06]",
                    "data-[state=active]:shadow-[inset_0_-2px_0_rgba(255,255,255,0.3)]",
                    "transition-all duration-200"
                  )}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  {showBadge && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center",
                        "text-[9px] font-bold rounded-full",
                        "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      )}
                    >
                      !
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto mt-6 pb-8">
          <TabsContent value="connections" className="m-0">
            <ConnectionsTab
              telegramCreds={telegramCreds}
              onTelegramCredsChange={updateTelegramCred}
              channels={localSettings.telegram_channel_ids || []}
              onChannelsChange={(v) => updateLocal("telegram_channel_ids", v)}
              mtCreds={mtCreds}
              isLoading={telegramLoading}
              configStatus={configStatus}
              isRefreshing={isRefreshingAccount}
              onRefresh={handleRefreshAccountData}
            />
          </TabsContent>

          <TabsContent value="quick" className="m-0">
            <QuickSettingsTab
              settings={localSettings}
              onSettingChange={updateLocal}
            />
          </TabsContent>

          <TabsContent value="lot-sizing" className="m-0">
            <LotSizingTab
              settings={localSettings}
              onSettingChange={updateLocal}
              currencySymbol={currencyData.symbol}
            />
          </TabsContent>

          <TabsContent value="execution" className="m-0">
            <TradeExecutionTab
              settings={localSettings}
              onSettingChange={updateLocal}
              currencySymbol={currencyData.symbol}
            />
          </TabsContent>

          <TabsContent value="advanced" className="m-0">
            <AdvancedTab
              settings={localSettings}
              onImportSettings={(imported) => {
                setLocalSettings(prev => ({ ...prev, ...imported }));
                setHasChanges(true);
                setSaveSuccess(false);
              }}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Unsaved Changes Warning Dialog */}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
        isSaving={anySaving}
      />
    </div>
  );
}
