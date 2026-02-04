/**
 * Shared i18n messages for fashion-rec.
 * Each app (frontend / uniapp) should create its own createI18n with these messages.
 */
import en from './locales/en.json'
import zh from './locales/zh.json'

export const messages = {
  en,
  zh,
} as const

export type Locale = keyof typeof messages
