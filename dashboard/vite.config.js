import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Warn if chunk > 500KB
    chunkSizeWarningLimit: 500,
    // Disable modulepreload to prevent all chunks loading on initial page load
    // This allows true lazy loading - chunks load only when routes are visited
    modulePreload: false,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and smaller initial bundle
        manualChunks: {
          // Core React runtime - rarely changes, great cache candidate
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries - animation and icons
          'vendor-ui': ['framer-motion', 'lucide-react'],
          // Stripe SDK - only needed on checkout page
          'vendor-stripe': ['@stripe/stripe-js', '@stripe/react-stripe-js'],
          // Charts - only used in dashboard stats
          'vendor-charts': ['recharts'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
