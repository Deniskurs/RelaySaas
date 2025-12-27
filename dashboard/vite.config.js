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
        // Split vendors into logical groups for better caching and loading
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return; // Let Rollup handle app code
          }

          // Stripe packages - must stay isolated, only load on checkout (~200KB)
          if (id.includes('@stripe/stripe-js') || id.includes('@stripe/react-stripe-js')) {
            return 'vendor-stripe';
          }

          // Recharts - only needed for PerformanceChart (~150KB)
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }

          // Framer Motion - animations (~180KB)
          if (id.includes('framer-motion')) {
            return 'vendor-motion';
          }

          // Radix UI components (~200KB total, used everywhere)
          if (id.includes('@radix-ui')) {
            return 'vendor-ui';
          }

          // Supabase - auth and database (~100KB)
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }

          // React core - needed immediately (~150KB)
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
            return 'vendor-react';
          }

          // Everything else goes to vendor-misc
          return 'vendor-misc';
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
