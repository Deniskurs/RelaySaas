import { useState, useCallback, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { PLAN_LIMITS } from "@/components/Plans/UsageMeter";

/**
 * Hook for plan limits and upgrade prompts
 * Fetches real usage data from API and manages limit checking
 */
export function usePlanLimits() {
  const { profile } = useAuth();
  const { fetchData, postData } = useApi();

  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitType, setLimitType] = useState(null); // 'signals' | 'accounts' | 'channels'

  // API-fetched usage data
  const [usageData, setUsageData] = useState(null);
  const [proDayStatus, setProDayStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch usage data from API
  const refreshUsage = useCallback(async () => {
    try {
      const data = await fetchData("/plans/usage");
      if (data) {
        setUsageData(data);
      }
    } catch (e) {
      console.error("Failed to fetch usage data:", e);
    }
  }, [fetchData]);

  // Fetch Pro Day status
  const refreshProDayStatus = useCallback(async () => {
    try {
      const data = await fetchData("/plans/pro-day/status");
      if (data) {
        setProDayStatus(data);
      }
    } catch (e) {
      console.error("Failed to fetch Pro Day status:", e);
    }
  }, [fetchData]);

  // Track user activity for Pro Day eligibility
  const trackActivity = useCallback(async () => {
    try {
      await postData("/plans/activity/track");
    } catch (e) {
      // Silent fail - not critical
    }
  }, [postData]);

  // Activate Pro Day
  const activateProDay = useCallback(async () => {
    try {
      const result = await postData("/plans/pro-day/activate");
      if (result?.success) {
        // Refresh both usage (for effective tier) and pro day status
        await Promise.all([refreshUsage(), refreshProDayStatus()]);
        return result;
      }
      return null;
    } catch (e) {
      console.error("Failed to activate Pro Day:", e);
      return null;
    }
  }, [postData, refreshUsage, refreshProDayStatus]);

  // Initial load and periodic refresh
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([refreshUsage(), refreshProDayStatus()]);
      setIsLoading(false);

      // Track activity on page load
      trackActivity();
    };

    loadData();

    // Refresh usage every 30 seconds
    const interval = setInterval(refreshUsage, 30000);
    return () => clearInterval(interval);
  }, [refreshUsage, refreshProDayStatus, trackActivity]);

  // Current tier and limits (from API or fallback to profile)
  const tier = usageData?.tier || profile?.subscription_tier?.toLowerCase() || "free";
  const effectiveTier = usageData?.effective_tier || tier;
  const limits = PLAN_LIMITS[effectiveTier] || PLAN_LIMITS.free;

  // Usage data - from API or fallback to profile
  const usage = useMemo(() => ({
    signalsToday: usageData?.signals_today ?? profile?.signals_used_today ?? 0,
    accounts: usageData?.accounts_connected ?? 1,
    channels: usageData?.channels_active ?? 1,
  }), [usageData, profile]);

  // Check if limit is reached
  const isLimitReached = useCallback((type) => {
    switch (type) {
      case "signals":
        return limits.signalsPerDay !== null && usage.signalsToday >= limits.signalsPerDay;
      case "accounts":
        return limits.mtAccounts !== null && usage.accounts >= limits.mtAccounts;
      case "channels":
        return limits.telegramChannels !== null && usage.channels >= limits.telegramChannels;
      default:
        return false;
    }
  }, [limits, usage]);

  // Check and show modal if limit reached
  const checkLimit = useCallback((type) => {
    if (isLimitReached(type)) {
      setLimitType(type);
      setShowLimitModal(true);
      return false; // Limit reached, action blocked
    }
    return true; // OK to proceed
  }, [isLimitReached]);

  // Check limit via API (for more accurate, server-side check)
  const checkLimitAsync = useCallback(async (type) => {
    try {
      const result = await fetchData(`/plans/limits/check?limit_type=${type}`);
      if (result && !result.allowed) {
        setLimitType(type);
        setShowLimitModal(true);
        return false;
      }
      return true;
    } catch (e) {
      // Fallback to client-side check
      return checkLimit(type);
    }
  }, [fetchData, checkLimit]);

  // Usage percentages
  const usagePercentage = useMemo(() => ({
    signals: limits.signalsPerDay
      ? Math.min((usage.signalsToday / limits.signalsPerDay) * 100, 100)
      : 0,
    accounts: limits.mtAccounts
      ? Math.min((usage.accounts / limits.mtAccounts) * 100, 100)
      : 0,
    channels: limits.telegramChannels
      ? Math.min((usage.channels / limits.telegramChannels) * 100, 100)
      : 0,
  }), [limits, usage]);

  // Should show warning banner (80% threshold)
  const showWarning = useMemo(() => ({
    signals: usagePercentage.signals >= 80 && usagePercentage.signals < 100,
    accounts: usagePercentage.accounts >= 80 && usagePercentage.accounts < 100,
    channels: usagePercentage.channels >= 80 && usagePercentage.channels < 100,
  }), [usagePercentage]);

  // Pro Day status - from API or fallback to profile
  const proDay = useMemo(() => {
    if (proDayStatus) {
      return {
        eligible: proDayStatus.eligible,
        active: proDayStatus.active,
        hoursRemaining: proDayStatus.hours_remaining,
        expiresAt: proDayStatus.expires_at,
        consecutiveActiveDays: proDayStatus.consecutive_active_days,
      };
    }
    // Fallback to profile data
    return {
      eligible: profile?.pro_day_eligible || false,
      active: profile?.pro_day_expires_at
        ? new Date(profile.pro_day_expires_at) > new Date()
        : false,
      hoursRemaining: profile?.pro_day_expires_at
        ? Math.max(0, (new Date(profile.pro_day_expires_at) - new Date()) / (1000 * 60 * 60))
        : 0,
      expiresAt: profile?.pro_day_expires_at,
      consecutiveActiveDays: profile?.consecutive_active_days || 0,
    };
  }, [proDayStatus, profile]);

  // Is user on a paid plan?
  const isPaid = effectiveTier === "pro" || effectiveTier === "premium";

  // Hours until signal reset (midnight UTC)
  const hoursUntilReset = useMemo(() => {
    const now = new Date();
    const midnight = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    return Math.ceil((midnight - now) / (1000 * 60 * 60));
  }, []);

  return {
    // Tier info
    tier,
    effectiveTier,
    limits,
    isPaid,

    // Usage data
    usage,
    usagePercentage,
    isLoading,

    // Limit checking
    isLimitReached,
    checkLimit,
    checkLimitAsync,
    showWarning,
    hoursUntilReset,

    // Pro Day
    proDay,
    activateProDay,

    // Modal state
    showLimitModal,
    limitType,
    closeLimitModal: () => setShowLimitModal(false),

    // Refresh
    refreshUsage,
  };
}

export default usePlanLimits;
