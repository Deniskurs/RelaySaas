import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook for coordinating Telegram reconnection across browser tabs.
 * Uses BroadcastChannel API to prevent multiple tabs from triggering
 * simultaneous reconnections which can corrupt Telegram sessions.
 *
 * @param {string} userId - The user's ID for creating a user-specific channel
 * @returns {object} - { isOtherTabReconnecting, notifyReconnectStarted, notifyReconnectCompleted }
 */
export function useTelegramReconnectCoordination(userId) {
  const [isOtherTabReconnecting, setIsOtherTabReconnecting] = useState(false);
  const channelRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Skip if no userId or BroadcastChannel not supported
    if (!userId || typeof BroadcastChannel === 'undefined') {
      return;
    }

    // Create a user-specific channel to avoid conflicts between users
    const channel = new BroadcastChannel(`telegram-reconnect-${userId}`);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      if (event.data.type === 'RECONNECT_STARTED') {
        setIsOtherTabReconnecting(true);

        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        // Auto-clear after the backend cooldown period (12s to be safe, backend is 10s)
        timeoutRef.current = setTimeout(() => {
          setIsOtherTabReconnecting(false);
        }, 12000);
      } else if (event.data.type === 'RECONNECT_COMPLETED') {
        // Clear the flag immediately when reconnection completes
        setIsOtherTabReconnecting(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      }
    };

    return () => {
      channel.close();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [userId]);

  /**
   * Call this before starting a reconnection to notify other tabs
   */
  const notifyReconnectStarted = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'RECONNECT_STARTED', timestamp: Date.now() });
    }
  }, []);

  /**
   * Call this after reconnection completes (success or failure) to notify other tabs
   */
  const notifyReconnectCompleted = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'RECONNECT_COMPLETED', timestamp: Date.now() });
    }
  }, []);

  return {
    isOtherTabReconnecting,
    notifyReconnectStarted,
    notifyReconnectCompleted,
  };
}
