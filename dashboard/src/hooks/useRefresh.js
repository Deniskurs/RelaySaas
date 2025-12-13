import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

/**
 * Custom hook for managing refresh operations with user feedback
 *
 * Provides:
 * - Loading state management
 * - Toast notifications for status updates
 * - Error handling
 * - Success/failure feedback
 *
 * @param {Object} options - Configuration options
 * @param {string} options.successMessage - Message to show on success
 * @param {string} options.errorMessage - Message to show on error
 * @param {string} options.loadingMessage - Message to show while loading
 * @param {boolean} options.showToasts - Whether to show toast notifications (default: true)
 * @returns {Object} - { isRefreshing, refresh }
 */
export function useRefresh({
  successMessage = "Refreshed successfully",
  errorMessage = "Refresh failed",
  loadingMessage = "Refreshing...",
  showToasts = true,
} = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { addToast } = useToast();

  const refresh = useCallback(
    async (asyncOperation) => {
      if (isRefreshing) return; // Prevent concurrent refreshes

      setIsRefreshing(true);
      let toastId = null;

      try {
        // Show loading toast
        if (showToasts) {
          toastId = addToast({
            variant: "loading",
            icon: Loader2,
            title: loadingMessage,
            duration: 0, // Don't auto-dismiss while loading
          });
        }

        // Execute the async operation
        const result = await asyncOperation();

        // Show success toast
        if (showToasts) {
          addToast({
            variant: "success",
            icon: CheckCircle2,
            title: successMessage,
            duration: 3000,
          });
        }

        return { success: true, data: result };
      } catch (error) {
        console.error("Refresh error:", error);

        // Show error toast
        if (showToasts) {
          addToast({
            variant: "error",
            icon: XCircle,
            title: errorMessage,
            description: error.message || "Please try again",
            duration: 5000,
          });
        }

        return { success: false, error };
      } finally {
        setIsRefreshing(false);
      }
    },
    [isRefreshing, addToast, successMessage, errorMessage, loadingMessage, showToasts]
  );

  return { isRefreshing, refresh };
}

/**
 * Hook for managing multiple refresh operations
 * Useful when you need to refresh several data sources simultaneously
 */
export function useMultiRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { addToast } = useToast();

  const refreshAll = useCallback(
    async (operations) => {
      if (isRefreshing) return;

      setIsRefreshing(true);
      setProgress({ current: 0, total: operations.length });

      const toastId = addToast({
        variant: "loading",
        icon: Loader2,
        title: "Refreshing data...",
        description: `0 of ${operations.length} complete`,
        duration: 0,
      });

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < operations.length; i++) {
        try {
          const result = await operations[i].operation();
          results.push({ name: operations[i].name, success: true, data: result });
          successCount++;
        } catch (error) {
          results.push({ name: operations[i].name, success: false, error });
          errorCount++;
        }

        setProgress({ current: i + 1, total: operations.length });
      }

      setIsRefreshing(false);

      // Show final result
      if (errorCount === 0) {
        addToast({
          variant: "success",
          icon: CheckCircle2,
          title: "All data refreshed",
          description: `${successCount} items updated successfully`,
          duration: 3000,
        });
      } else if (successCount === 0) {
        addToast({
          variant: "error",
          icon: XCircle,
          title: "Refresh failed",
          description: `Failed to refresh ${errorCount} items`,
          duration: 5000,
        });
      } else {
        addToast({
          variant: "warning",
          icon: RefreshCw,
          title: "Partial refresh",
          description: `${successCount} succeeded, ${errorCount} failed`,
          duration: 5000,
        });
      }

      return results;
    },
    [isRefreshing, addToast]
  );

  return { isRefreshing, progress, refreshAll };
}
