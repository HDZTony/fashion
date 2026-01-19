import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  // Core Web Vitals optimizations
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          // Split vendor chunks for better caching
          if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) {
            return 'vue-vendor'
          }
          if (id.includes('reka-ui') || id.includes('lucide-vue-next')) {
            return 'ui-vendor'
          }
          if (id.includes('axios') || id.includes('@vueuse') || id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'utils-vendor'
          }
        },
      },
    },
    // Enable source maps for production debugging
    sourcemap: false,
    // Optimize chunk size
    chunkSizeWarningLimit: 600,
  },
})
