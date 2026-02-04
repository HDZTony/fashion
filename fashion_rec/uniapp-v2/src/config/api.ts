import { getApiUrl, getSubscriptionApiUrl } from '@fashion-rec/shared/api/config'

const isProd = (import.meta as unknown as { env?: Record<string, string> }).env?.NODE_ENV === 'production'
const envApiUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL

export const API_URL = getApiUrl({
  apiUrl: envApiUrl,
  isProduction: isProd,
})

export const SUBSCRIPTION_API_URL = getSubscriptionApiUrl({
  apiUrl: envApiUrl,
  isProduction: isProd,
})
