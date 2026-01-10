import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import zh from './locales/zh.json'

// 从 localStorage 获取保存的语言设置，默认为浏览器语言或英文
const getDefaultLocale = (): string => {
  if (typeof window === 'undefined') return 'en'
  
  const saved = localStorage.getItem('fashion_rec_locale')
  if (saved && (saved === 'en' || saved === 'zh')) {
    return saved
  }
  
  // 检测浏览器语言
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) {
    return 'zh'
  }
  
  return 'en'
}

export const i18n = createI18n({
  legacy: false, // 使用 Composition API 模式
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages: {
    en,
    zh,
  },
})

// 导出切换语言的辅助函数
export const setLocale = (locale: 'en' | 'zh') => {
  i18n.global.locale.value = locale
  if (typeof window !== 'undefined') {
    localStorage.setItem('fashion_rec_locale', locale)
  }
}
