import './style.css'
import App from './App.vue'
import { ViteSSG } from 'vite-ssg'
import { createHead } from '@vueuse/head'
import { routes, setupRouterGuards } from './router'

export const createApp = ViteSSG(
  App,
  {
    routes,
    base: import.meta.env.BASE_URL,
  },
  ({ app, router }) => {
    const head = createHead()
    app.use(head)
    setupRouterGuards(router)
  }
)
