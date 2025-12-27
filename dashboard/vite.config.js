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
        // Simpler chunk splitting - only isolate truly independent packages
        // Aggressive splitting can break React context sharing
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return; // Let Rollup handle app code
          }

          // Stripe - only loads on checkout page (~200KB saved on initial load)
          if (id.includes('@stripe/stripe-js') || id.includes('@stripe/react-stripe-js')) {
            return 'vendor-stripe';
          }

          // Recharts + D3 - only loads when PerformanceChart is shown (~300KB)
          if (id.includes('recharts') || id.includes('d3-')) {
            return 'vendor-charts';
          }

          // Everything else stays together to avoid React context issues
          return 'vendor';
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
