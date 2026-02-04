import { createI18n } from 'vue-i18n'
import { messages } from '@fashion-rec/shared'

const getDefaultLocale = (): string => {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem('fashion-rec_locale')
  if (saved && (saved === 'en' || saved === 'zh')) return saved
  const browserLang = navigator.language.toLowerCase()
  if (browserLang.startsWith('zh')) return 'zh'
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages,
})

export const setLocale = (locale: 'en' | 'zh') => {
  i18n.global.locale.value = locale
  if (typeof window !== 'undefined') {
    localStorage.setItem('fashion-rec_locale', locale)
  }
}
