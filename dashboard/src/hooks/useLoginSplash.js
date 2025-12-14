import { useState, useEffect, useCallback } from "react";

const SPLASH_STORAGE_KEY = "relay_splash_shown";
const SPLASH_DURATION = 2800; // 2.8 seconds total

/**
 * Hook to manage the login splash intro animation state.
 * Shows splash only on first visit per session.
 * Respects prefers-reduced-motion.
 */
export function useLoginSplash() {
  const [showSplash, setShowSplash] = useState(() => {
    // Check if splash was already shown this session
    if (typeof window === "undefined") return false;
    const hasSeenSplash = sessionStorage.getItem(SPLASH_STORAGE_KEY);
    return !hasSeenSplash;
  });

  const [splashPhase, setSplashPhase] = useState(0);
  // Phase 0: Initial (hidden)
  // Phase 1: Logo appears (0-800ms)
  // Phase 2: Brand name slides in (800-1400ms)
  // Phase 3: Tagline whispers (1400-2200ms)
  // Phase 4: Crossfade out (2200-2800ms)

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const skipSplash = useCallback(() => {
    setShowSplash(false);
    sessionStorage.setItem(SPLASH_STORAGE_KEY, "true");
  }, []);

  useEffect(() => {
    if (!showSplash || prefersReducedMotion) {
      // Skip animation entirely
      if (prefersReducedMotion && showSplash) {
        skipSplash();
      }
      return;
    }

    // Progress through animation phases
    const timers = [
      setTimeout(() => setSplashPhase(1), 100), // Start logo animation
      setTimeout(() => setSplashPhase(2), 800), // Brand name
      setTimeout(() => setSplashPhase(3), 1400), // Tagline
      setTimeout(() => setSplashPhase(4), 2200), // Begin crossfade
      setTimeout(() => {
        skipSplash();
      }, SPLASH_DURATION),
    ];

    return () => timers.forEach(clearTimeout);
  }, [showSplash, prefersReducedMotion, skipSplash]);

  return {
    showSplash,
    splashPhase,
    skipSplash,
    prefersReducedMotion,
    splashDuration: SPLASH_DURATION,
  };
}
