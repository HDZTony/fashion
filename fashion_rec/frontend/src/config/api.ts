/**
 * Unified API Configuration - uses shared config with Vite env.
 * Source of truth for URL resolution: @fashion-rec/shared
 */
import { getApiUrl, getSubscriptionApiUrl } from '@fashion-rec/shared'

const envApiUrl = import.meta.env.VITE_API_URL
const isProdMode = import.meta.env.PROD || import.meta.env.MODE === 'production'

export const API_URL = getApiUrl({
  apiUrl: envApiUrl,
  isProduction: isProdMode,
})

export const SUBSCRIPTION_API_URL = getSubscriptionApiUrl({
  apiUrl: envApiUrl,
  subscriptionApiUrl: import.meta.env.VITE_SUBSCRIPTION_API_URL,
  isProduction: isProdMode,
})

export const isDevelopment = import.meta.env.DEV
export const isProduction = import.meta.env.PROD
