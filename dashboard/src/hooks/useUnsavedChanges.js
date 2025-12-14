import { useEffect, useCallback } from "react";

/**
 * Hook to manage unsaved changes warnings
 *
 * Handles:
 * 1. Browser close/refresh (beforeunload)
 * 2. Custom navigation (e.g., tab switches) - handled by parent component
 *
 * Note: Route blocking via useBlocker requires a data router (createBrowserRouter).
 * This app uses BrowserRouter, so route blocking is not supported.
 * Tab switching warnings are handled directly in SettingsPage.
 *
 * @param {boolean} hasUnsavedChanges - Whether there are unsaved changes
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableBrowserPrompt - Enable browser beforeunload warning (default: true)
 * @param {string} options.browserMessage - Custom message for browser prompt
 *
 * @returns {Object} - { shouldWarn }
 */
export function useUnsavedChanges(hasUnsavedChanges, onSave, options = {}) {
  const {
    enableBrowserPrompt = true,
    browserMessage = "You have unsaved changes. Are you sure you want to leave?",
  } = options;

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

  return {
    shouldWarn: hasUnsavedChanges,
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
  const pendingTabRef = { current: null };

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
