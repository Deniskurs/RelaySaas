import { useEffect, useCallback, useRef } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Hook to manage unsaved changes warnings across different scenarios
 *
 * Handles three scenarios:
 * 1. Route navigation blocking (React Router)
 * 2. Browser close/refresh (beforeunload)
 * 3. Custom navigation (e.g., tab switches) - handled by parent component
 *
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 * @param {function} onSave - Callback to save changes
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableBrowserPrompt - Enable browser beforeunload warning (default: true)
 * @param {string} options.browserMessage - Custom message for browser prompt
 *
 * @returns {Object} - { blocker, shouldWarn }
 */
export function useUnsavedChanges(hasUnsavedChanges, onSave, options = {}) {
  const {
    enableBrowserPrompt = true,
    browserMessage = "You have unsaved changes. Are you sure you want to leave?",
  } = options;

  // Track if we're in the middle of a save operation
  const isSavingRef = useRef(false);

  // Block navigation when there are unsaved changes
  // React Router v6.4+ blocker API
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      !isSavingRef.current &&
      currentLocation.pathname !== nextLocation.pathname
  );

  // Browser close/refresh warning
  useEffect(() => {
    if (!enableBrowserPrompt || !hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (e) => {
      // Modern browsers ignore the custom message and show their own
      // But we still need to call preventDefault and set returnValue
      e.preventDefault();
      e.returnValue = browserMessage;
      return browserMessage;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges, enableBrowserPrompt, browserMessage]);

  // Helper to proceed with navigation after save/discard
  const proceedNavigation = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.proceed();
    }
  }, [blocker]);

  // Helper to cancel navigation
  const cancelNavigation = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.reset();
    }
  }, [blocker]);

  // Helper to save and proceed
  const saveAndProceed = useCallback(async () => {
    isSavingRef.current = true;
    try {
      await onSave();
      proceedNavigation();
    } catch (error) {
      console.error("Failed to save changes:", error);
      // Don't proceed if save failed
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave, proceedNavigation]);

  return {
    blocker,
    shouldWarn: hasUnsavedChanges,
    proceedNavigation,
    cancelNavigation,
    saveAndProceed,
  };
}

/**
 * Hook specifically for tab switching within Settings page
 *
 * Returns a handler that can be used to intercept tab changes
 * and show the unsaved changes dialog if needed.
 *
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 * @param {function} onShowDialog - Callback to show the dialog
 *
 * @returns {function} - Handler for tab change that returns boolean (allow change or not)
 */
export function useTabChangeWarning(hasUnsavedChanges, onShowDialog) {
  const pendingTabRef = useRef(null);

  const handleTabChange = useCallback(
    (newTab, currentTab) => {
      if (hasUnsavedChanges && newTab !== currentTab) {
        pendingTabRef.current = newTab;
        onShowDialog();
        return false; // Block the tab change
      }
      return true; // Allow the tab change
    },
    [hasUnsavedChanges, onShowDialog]
  );

  const getPendingTab = useCallback(() => {
    return pendingTabRef.current;
  }, []);

  const clearPendingTab = useCallback(() => {
    pendingTabRef.current = null;
  }, []);

  return {
    handleTabChange,
    getPendingTab,
    clearPendingTab,
  };
}
