import { motion, AnimatePresence } from "framer-motion";
import { Logo, BrandName } from "./Brand";
import { Button } from "@/components/ui/button";

// Apple-style easing
const appleEase = [0.16, 1, 0.3, 1];

/**
 * Premium splash intro animation for the login page.
 * Displays a refined brand moment before revealing the login form.
 */
export function SplashIntro({ showSplash, splashPhase, onSkip }) {
  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: appleEase }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[hsl(240_10%_2%)]"
        >
          {/* Centered brand content */}
          <div className="flex flex-col items-center gap-6">
            {/* Phase 1: Logo materializes */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={
                splashPhase >= 1
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.8 }
              }
              transition={{ duration: 0.8, ease: appleEase }}
            >
              <Logo size={64} />
            </motion.div>

            {/* Phase 2: Brand name + connection line */}
            <div className="flex flex-col items-center gap-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={
                  splashPhase >= 2
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: -20 }
                }
                transition={{ duration: 0.6, ease: appleEase }}
              >
                <BrandName className="scale-125" />
              </motion.div>

              {/* Connection line - signal metaphor */}
              <motion.div
                className="h-[1px] bg-gradient-to-r from-accent-teal via-accent-teal/50 to-transparent"
                initial={{ width: 0, opacity: 0 }}
                animate={
                  splashPhase >= 2
                    ? { width: 120, opacity: 0.6 }
                    : { width: 0, opacity: 0 }
                }
                transition={{ duration: 0.8, ease: appleEase, delay: 0.2 }}
              />
            </div>

            {/* Phase 3: Tagline whisper */}
            <motion.p
              className="font-serif font-light text-foreground-muted text-base tracking-wide"
              initial={{ opacity: 0, y: 10 }}
              animate={
                splashPhase >= 3
                  ? { opacity: 0.7, y: 0 }
                  : { opacity: 0, y: 10 }
              }
              transition={{ duration: 0.8, ease: appleEase }}
            >
              Signal Infrastructure
            </motion.p>
          </div>

          {/* Skip button - appears after 1s */}
          <motion.div
            className="absolute bottom-8 right-8"
            initial={{ opacity: 0 }}
            animate={splashPhase >= 2 ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="text-foreground-subtle/60 hover:text-foreground-subtle text-xs tracking-wider"
            >
              Skip
            </Button>
          </motion.div>

          {/* Subtle ambient glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-accent-teal/5 blur-[150px]"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={
                splashPhase >= 1
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.8 }
              }
              transition={{ duration: 1.5, ease: appleEase }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SplashIntro;
