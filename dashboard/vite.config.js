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
        // Function-based chunk splitting for precise control
        // This ensures Stripe SDK is truly isolated and only loaded on checkout
        manualChunks(id) {
          // Stripe packages - must stay isolated, only load on checkout
          if (id.includes('@stripe/stripe-js') || id.includes('@stripe/react-stripe-js')) {
            return 'vendor-stripe';
          }
          // Core React runtime - rarely changes, great cache candidate
          if (id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          // UI libraries - animation and icons
          if (id.includes('node_modules/framer-motion') ||
              id.includes('node_modules/lucide-react')) {
            return 'vendor-ui';
          }
          // Charts - only used in dashboard stats
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }
          // Supabase client
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase';
          }
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
