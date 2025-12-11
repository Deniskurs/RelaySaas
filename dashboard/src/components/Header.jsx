import { Activity, Pause, Play, Settings, Wifi, WifiOff } from 'lucide-react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

export default function Header({ isConnected, isPaused, onPause, onResume }) {
  return (
    <header className="sticky top-0 z-50 glass-card border-b border-white/5">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Signal Copier</h1>
              <p className="text-xs text-gray-500">Telegram → MT5</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
              isConnected ? "bg-accent-green/10 text-accent-green" : "bg-accent-red/10 text-accent-red"
            )}>
              <motion.div
                animate={{ scale: isConnected ? [1, 1.2, 1] : 1 }}
                transition={{ repeat: isConnected ? Infinity : 0, duration: 2 }}
              >
                {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              </motion.div>
              <span className="font-medium">{isConnected ? 'Live' : 'Disconnected'}</span>
            </div>

            <button
              onClick={isPaused ? onResume : onPause}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                isPaused
                  ? "bg-accent-green hover:bg-accent-green/80 text-white"
                  : "bg-accent-yellow/10 hover:bg-accent-yellow/20 text-accent-yellow"
              )}
            >
              {isPaused ? (
                <>
                  <Play className="w-4 h-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
