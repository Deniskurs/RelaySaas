import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useApi } from "@/hooks/useApi";

const SettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  // Risk Management
  max_risk_percent: 2.0,
  max_lot_size: 0.1,
  max_open_trades: 5,
  // Lot Sizing
  lot_reference_balance: 500.0,
  lot_reference_size_gold: 0.04,
  lot_reference_size_default: 0.01,
  // Execution
  auto_accept_symbols: ["XAUUSD", "GOLD"],
  gold_market_threshold: 3.0,
  split_tps: true,
  tp_split_ratios: [0.5, 0.3, 0.2],
  enable_breakeven: true,
  // Broker
  symbol_suffix: "",
  // System
  paused: false,
  // Telegram
  telegram_channel_ids: [],
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const { fetchData, putData } = useApi();

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchData("/settings");
      if (data) {
        setSettings(data);
      }
    } catch (e) {
      setError("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, [fetchData]);

  const updateSettings = useCallback(async (updates) => {
    setIsSaving(true);
    setError(null);
    try {
      const data = await putData("/settings", updates);
      if (data) {
        setSettings(data);
        return true;
      }
      return false;
    } catch (e) {
      setError("Failed to save settings");
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [putData]);

  const updateSetting = useCallback(async (key, value) => {
    return updateSettings({ [key]: value });
  }, [updateSettings]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        isLoading,
        isSaving,
        error,
        updateSettings,
        updateSetting,
        reloadSettings: loadSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
