import 'virtual:uno.css'

// Polyfill: localStorage / tabBar (must run before other imports)
import './polyfill-storage'
import './polyfill-tabbar'

import { createSSRApp } from 'vue'
import App from './App.vue'
import { createI18n } from 'vue-i18n'
import { messages } from '@fashion-rec/shared/i18n'
import { requestInterceptor } from './http/interceptor'
import { routeInterceptor } from './router/interceptor'

import store from './store'
import '@/style/index.scss'

// 应用国际化：按 uni-app 文档使用 vue-i18n@9.1.9，locale 从 uni.getLocale() 获取
const i18nConfig = {
  legacy: false,
  locale: uni.getLocale(),
  fallbackLocale: 'en',
  messages: {
    ...messages,
    'zh-Hans': messages.zh, // uni-app 使用 zh-Hans，映射到 shared 的 zh
  },
}
const i18n = createI18n(i18nConfig)

// 同步 uni.setLocale 与 vue-i18n：框架语言变化时更新应用 i18n
uni.onLocaleChange(() => {
  i18n.global.locale = uni.getLocale()
})

export function createApp() {
  const app = createSSRApp(App)
  app.use(store)
  app.use(i18n)
  app.use(routeInterceptor)
  app.use(requestInterceptor)

  return {
    app,
  }
}
