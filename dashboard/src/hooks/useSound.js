import { useEffect, useRef, useCallback, useState } from "react";

/**
 * useSound - Hook for playing notification sounds
 *
 * Uses Web Audio API for low-latency sound playback.
 * Sounds are generated programmatically (no external files needed).
 */

// Sound configurations - frequencies and durations for different events
const SOUND_CONFIGS = {
  received: {
    // Soft notification chime - two rising notes
    frequencies: [440, 554],
    durations: [0.1, 0.15],
    type: "sine",
    gain: 0.15,
  },
  pending: {
    // Attention bell - three notes with urgency
    frequencies: [587, 740, 880],
    durations: [0.08, 0.08, 0.15],
    type: "sine",
    gain: 0.2,
  },
  executed: {
    // Success confirmation - celebratory ascending arpeggio (C major chord)
    frequencies: [523, 659, 784, 1047],
    durations: [0.08, 0.08, 0.1, 0.25],
    type: "sine",
    gain: 0.18,
  },
  rejected: {
    // Error notification - descending notes
    frequencies: [400, 300],
    durations: [0.12, 0.2],
    type: "triangle",
    gain: 0.15,
  },
  failed: {
    // Same as rejected
    frequencies: [400, 300],
    durations: [0.12, 0.2],
    type: "triangle",
    gain: 0.15,
  },
};

/**
 * Play a sequence of tones using Web Audio API
 */
function playTones(audioContext, config) {
  if (!audioContext || audioContext.state === "closed") return;

  const { frequencies, durations, type, gain: gainValue } = config;
  let startTime = audioContext.currentTime;

  frequencies.forEach((freq, i) => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, startTime);

    // Envelope: quick attack, sustain, quick release
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gainValue, startTime + 0.01);
    gainNode.gain.setValueAtTime(gainValue, startTime + durations[i] - 0.02);
    gainNode.gain.linearRampToValueAtTime(0, startTime + durations[i]);

    oscillator.start(startTime);
    oscillator.stop(startTime + durations[i]);

    startTime += durations[i] * 0.8; // Slight overlap for smoother sound
  });
}

/**
 * useSound hook
 *
 * @param {boolean} enabled - Whether sounds are enabled
 * @returns {{ play: (soundType: string) => void }}
 */
export function useSound(enabled = false) {
  const audioContextRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize audio context on first user interaction
  const initAudio = useCallback(() => {
    if (!audioContextRef.current && enabled) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        setIsInitialized(true);
      } catch (e) {
        console.warn("Failed to initialize audio context:", e);
      }
    }
  }, [enabled]);

  // Resume audio context if suspended (browsers require user gesture)
  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      initAudio();
    }
    if (audioContextRef.current?.state === "suspended") {
      try {
        await audioContextRef.current.resume();
      } catch (e) {
        console.warn("Failed to resume audio context:", e);
      }
    }
  }, [initAudio]);

  // Play a sound by type
  const play = useCallback(
    async (soundType) => {
      if (!enabled) return;

      await ensureAudioContext();

      const config = SOUND_CONFIGS[soundType];
      if (!config) {
        console.warn(`Unknown sound type: ${soundType}`);
        return;
      }

      try {
        playTones(audioContextRef.current, config);
      } catch (e) {
        console.warn("Failed to play sound:", e);
      }
    },
    [enabled, ensureAudioContext]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Initialize on click (browsers require user gesture for audio)
  useEffect(() => {
    if (enabled && !isInitialized) {
      const handleInteraction = () => {
        initAudio();
        document.removeEventListener("click", handleInteraction);
        document.removeEventListener("keydown", handleInteraction);
      };

      document.addEventListener("click", handleInteraction);
      document.addEventListener("keydown", handleInteraction);

      return () => {
        document.removeEventListener("click", handleInteraction);
        document.removeEventListener("keydown", handleInteraction);
      };
    }
  }, [enabled, isInitialized, initAudio]);

  return { play, isInitialized };
}

/**
 * useSignalSounds - Higher-level hook for signal-specific sounds
 *
 * Automatically plays sounds based on signal status changes
 */
export function useSignalSounds(enabled = false) {
  const { play } = useSound(enabled);
  const previousStatusRef = useRef(new Map());

  const handleSignalUpdate = useCallback(
    (signal) => {
      if (!enabled || !signal?.id || !signal?.status) return;

      const prevStatus = previousStatusRef.current.get(signal.id);
      const newStatus = signal.status.toLowerCase();

      // Only play sound if status changed
      if (prevStatus === newStatus) return;

      previousStatusRef.current.set(signal.id, newStatus);

      // Map signal status to sound type
      switch (newStatus) {
        case "received":
          play("received");
          break;
        case "pending_confirmation":
          play("pending");
          break;
        case "executed":
          play("executed");
          break;
        case "rejected":
        case "failed":
          play("rejected");
          break;
        default:
          break;
      }
    },
    [enabled, play]
  );

  // Cleanup old entries periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      if (previousStatusRef.current.size > 100) {
        // Keep only the last 50 entries
        const entries = Array.from(previousStatusRef.current.entries());
        previousStatusRef.current = new Map(entries.slice(-50));
      }
    }, 60000);

    return () => clearInterval(cleanup);
  }, []);

  return { handleSignalUpdate, play };
}

export default useSound;
