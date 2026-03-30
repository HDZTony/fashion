import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { includedRoutes as ssgIncludedRoutes } from './src/ssg-routes'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), '')
  // Must match fashion_rec/backend/run.py (uvicorn port, default 8001)
  const chatkitApiBase =
    (env.CHATKIT_API_BASE && env.CHATKIT_API_BASE.trim()) ||
    (process.env.CHATKIT_API_BASE && process.env.CHATKIT_API_BASE.trim()) ||
    'http://127.0.0.1:8001'

  return {
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
    proxy: {
      '/chatkit': {
        target: chatkitApiBase,
        changeOrigin: true,
      },
    },
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
  }
})
