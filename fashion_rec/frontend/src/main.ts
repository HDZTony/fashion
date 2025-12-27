import './style.css'
import App from './App.vue'
import { ViteSSG } from 'vite-ssg'
import { createHead } from '@vueuse/head'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { routes, setupRouterGuards } from './router'
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

    // Setup Pinia with persistence plugin
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    app.use(pinia)

    setupRouterGuards(router)
  }
)
