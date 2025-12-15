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
        // Only isolate Stripe - let Rollup handle other dependencies naturally
        manualChunks(id) {
          // Stripe packages - must stay isolated, only load on checkout
          // This is the critical optimization - prevents 200KB+ Stripe SDK from loading on every page
          if (id.includes('@stripe/stripe-js') || id.includes('@stripe/react-stripe-js')) {
            return 'vendor-stripe';
          }
          // Group all other node_modules into a single vendor chunk
          // This avoids circular dependency issues while still separating vendor from app code
          if (id.includes('node_modules')) {
            return 'vendor';
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
