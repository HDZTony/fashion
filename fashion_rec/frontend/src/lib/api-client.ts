import { createAuthenticatedApiClient } from '@fashion-rec/shared'
import { supabase } from './supabase'
import { useAuthStore } from '../stores/auth'
import { API_URL, SUBSCRIPTION_API_URL } from '../config/api'
import { getTokenFromCookie } from './cookie-storage'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return getTokenFromCookie() || localStorage.getItem('auth_token') || (useAuthStore().accessToken as string | null) || null
}

export function createAuthenticatedApiClientWeb(baseURL: string, timeout?: number) {
  const client = createAuthenticatedApiClient({
    baseURL,
    getToken,
    timeout: timeout ?? 30000,
    on401: async () => {
      const authStore = useAuthStore()
      await authStore.refreshSession()
      if (!authStore.accessToken) {
        await supabase.auth.signOut()
      }
    },
  })

  // SSR: skip; browser: wait for auth store then ensure token for protected requests
  // Guest-allowed paths: no token required (backend applies IP rate limit for try-on/outfit)
  const guestAllowedPaths = [
    '/try-on',
    '/outfit',
    '/model-image',
    '/background-image',
    '/guest-quota',
    '/chatkit',
  ]
  const isGuestAllowed = (url: string) => guestAllowedPaths.some((p) => url.includes(p))

  client.interceptors.request.use(async (config) => {
    if (typeof window === 'undefined') return config
    const url = typeof config.url === 'string' ? config.url : ''
    let token = getToken()
    if (!token && useAuthStore().isLoading && !isGuestAllowed(url)) {
      let attempts = 0
      const maxAttempts = 10
      while (attempts < maxAttempts && useAuthStore().isLoading && !token) {
        await new Promise((r) => setTimeout(r, 100 * Math.min(attempts + 1, 5)))
        await useAuthStore().loadSession()
        token = getToken()
        attempts++
      }
    }
    token = token || localStorage.getItem('auth_token')
    if (!token && !isGuestAllowed(url)) {
      return Promise.reject(
        new Error('Authentication token not available. Please refresh the page or log in again.')
      )
    }
    return config
  })

  return client
}

export const apiClient = createAuthenticatedApiClientWeb(API_URL)
export const uploadApiClient = createAuthenticatedApiClientWeb(API_URL, 300000)
export const longUploadApiClient = createAuthenticatedApiClientWeb(API_URL, 600000)
export const subscriptionClient = createAuthenticatedApiClientWeb(SUBSCRIPTION_API_URL, 60000)
