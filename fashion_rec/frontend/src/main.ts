import './style.css'
import App from './App.vue'
import { ViteSSG } from 'vite-ssg'
import { createHead } from '@vueuse/head'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { routes, setupRouterGuards } from './router'
import { i18n } from './i18n'
// Import apiClient to ensure interceptors are registered immediately when the module loads
// This is critical for page refresh scenarios where requests might be made before components mount
import './lib/api-client'

export const createApp = ViteSSG(
  App,
  {
    routes,
    base: import.meta.env.BASE_URL,
  },
  ({ app, router }) => {
    const head = createHead()
    app.use(head)

    // Setup i18n
    app.use(i18n)

    // Setup Pinia with persistence plugin
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    app.use(pinia)

    // CRITICAL: Initialize auth store immediately (synchronously)
    // The store will restore token from localStorage immediately, then load session asynchronously
    // This ensures token is available even before async loadSession() completes
    if (typeof window !== 'undefined') {
      // Import and initialize store immediately
      // The store's accessToken getter has localStorage fallback, so token is available immediately
      import('./stores/auth').then(({ useAuthStore }) => {
        useAuthStore()
        // Store initialization happens in the store definition itself
        // The accessToken getter will return localStorage token immediately if session not loaded yet
      })
    }

    setupRouterGuards(router)
  }
)
