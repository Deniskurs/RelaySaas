import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PLAN_LIMITS } from "@/components/Plans/UsageMeter";

/**
 * Hook for plan limits and upgrade prompts
 * Manages limit checking and modal states
 */
export function usePlanLimits() {
  const { profile } = useAuth();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitType, setLimitType] = useState(null); // 'signals' | 'accounts' | 'channels'

  // Current tier and limits
  const tier = profile?.subscription_tier?.toLowerCase() || "free";
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.free;

  // Usage data (would come from API in production)
  const usage = useMemo(() => ({
    signalsToday: profile?.signals_used_today || 0,
    accounts: 1, // TODO: Get from API
    channels: 1, // TODO: Get from API
  }), [profile?.signals_used_today]);

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

  // Pro Day status
  const proDay = useMemo(() => ({
    eligible: profile?.pro_day_eligible || false,
    active: profile?.pro_day_expires_at
      ? new Date(profile.pro_day_expires_at) > new Date()
      : false,
    hoursRemaining: profile?.pro_day_expires_at
      ? Math.max(0, (new Date(profile.pro_day_expires_at) - new Date()) / (1000 * 60 * 60))
      : 0,
  }), [profile]);

  // Is user on a paid plan?
  const isPaid = tier === "pro" || tier === "premium";

  return {
    tier,
    limits,
    usage,
    usagePercentage,
    isLimitReached,
    checkLimit,
    showWarning,
    proDay,
    isPaid,
    // Modal state
    showLimitModal,
    limitType,
    closeLimitModal: () => setShowLimitModal(false),
  };
}

export default usePlanLimits;
