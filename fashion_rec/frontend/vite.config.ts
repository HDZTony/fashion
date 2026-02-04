import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { includedRoutes as ssgIncludedRoutes } from './src/ssg-routes'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  ssgOptions: {
    includedRoutes: () => ssgIncludedRoutes,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@fashion-rec/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@fashion-rec/shared/i18n': path.resolve(__dirname, '../shared/src/i18n/index.ts'),
      '@fashion-rec/shared/api/client': path.resolve(__dirname, '../shared/src/api/client.ts'),
      '@fashion-rec/shared/api/config': path.resolve(__dirname, '../shared/src/api/config.ts'),
      '@fashion-rec/shared/types': path.resolve(__dirname, '../shared/src/types.ts'),
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
