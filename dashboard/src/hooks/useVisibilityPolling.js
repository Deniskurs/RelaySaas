import { useEffect, useRef, useCallback, useState } from "react";

/**
 * useVisibilityPolling - A hook that manages polling with page visibility awareness
 *
 * Key features:
 * - Pauses polling when tab is hidden (saves CPU/battery on mobile)
 * - Resumes polling immediately when tab becomes visible
 * - Executes callback immediately on visibility restore for fresh data
 * - Properly cleans up intervals to prevent memory leaks
 * - Can be conditionally enabled/disabled via the `enabled` parameter
 *
 * @param {Function} callback - The async function to call at each interval
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether polling is active (default: true)
 * @param {boolean} options.runOnMount - Run callback immediately on mount (default: true)
 * @param {boolean} options.runOnVisible - Run callback when tab becomes visible (default: true)
 */
export function useVisibilityPolling(callback, intervalMs, options = {}) {
  const {
    enabled = true,
    runOnMount = true,
    runOnVisible = true
  } = options;

  const intervalRef = useRef(null);
  const callbackRef = useRef(callback);
  const isVisibleRef = useRef(!document.hidden);

  // Keep callback ref updated to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const startPolling = useCallback(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Only start if enabled and visible
    if (enabled && isVisibleRef.current) {
      intervalRef.current = setInterval(() => {
        callbackRef.current();
      }, intervalMs);
    }
  }, [enabled, intervalMs]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Handle visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      const wasHidden = !isVisibleRef.current;
      isVisibleRef.current = isVisible;

      if (isVisible && enabled) {
        // Tab became visible - restart polling
        startPolling();

        // Fetch fresh data immediately when returning to tab
        if (wasHidden && runOnVisible) {
          callbackRef.current();
        }
      } else {
        // Tab hidden - stop polling to save resources
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, startPolling, stopPolling, runOnVisible]);

  // Main polling effect
  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    // Run immediately on mount if requested
    if (runOnMount && isVisibleRef.current) {
      callbackRef.current();
    }

    // Start polling if tab is visible
    if (isVisibleRef.current) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [enabled, startPolling, stopPolling, runOnMount]);

  // Return control functions for manual triggering
  return {
    refresh: useCallback(() => callbackRef.current(), []),
    isPolling: enabled && isVisibleRef.current
  };
}

/**
 * useConditionalPolling - Polls only when a specific condition is true
 * Useful for polling that should only run during certain states (e.g., provisioning)
 *
 * @param {Function} callback - The async function to call
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {boolean} condition - Only poll when this is true
 * @param {Object} options - Additional options
 */
export function useConditionalPolling(callback, intervalMs, condition, options = {}) {
  return useVisibilityPolling(callback, intervalMs, {
    ...options,
    enabled: condition,
    runOnMount: condition && (options.runOnMount ?? true),
  });
}

/**
 * usePageVisibility - Simple hook to track page visibility state
 * @returns {boolean} - Whether the page is currently visible
 */
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return isVisible;
}
