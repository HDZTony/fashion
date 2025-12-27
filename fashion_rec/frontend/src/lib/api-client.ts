import axios from 'axios'
import { supabase } from './supabase'
import { useAuthStore } from '../stores/auth'
import { API_URL, SUBSCRIPTION_API_URL } from '../config/api'

/**
 * Create an axios instance with authentication interceptor.
 * This ensures that auth tokens are properly attached to requests,
 * especially after page refreshes when Supabase session may need time to recover.
 */
export function createAuthenticatedApiClient(baseURL: string, timeout?: number) {
  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: timeout || 30000, // Default 30 seconds, can be overridden per request
  })

  // Add interceptor to inject auth token from Pinia auth store
  // Priority: localStorage (fastest) -> Pinia store -> reject request
  // Note: In SSR, this interceptor will skip token injection (no token available)
  client.interceptors.request.use(async (config) => {
    // Skip token injection in SSR (server-side rendering)
    // SSR should only render public pages that don't require authentication
    if (typeof window === 'undefined') {
      return config
    }

    try {
      // STEP 1: First, try localStorage backup (fastest path)
      // This is critical for page refresh scenarios where Pinia store may not be initialized yet
      let token: string | null = null
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('auth_token')
        if (token) {
          config.headers = config.headers || {}
          config.headers.Authorization = `Bearer ${token}`
          if (import.meta.env.DEV) {
            console.debug(`[API Client] Using token from localStorage for ${config.method?.toUpperCase()} ${config.url}`)
          }
          return config
        }
      }
      
      // STEP 2: Try Pinia auth store (with retry logic for page refresh scenarios)
      const authStore = useAuthStore()
      
      // Wait for store to load if still loading
      if (authStore.isLoading) {
        await authStore.loadSession()
      }
      
      // Get token from store
      token = authStore.accessToken
      
      // STEP 3: If no token from store, try refreshing session
      if (!token) {
        console.warn(`[API Client] No token in store, attempting to refresh session...`)
        await authStore.refreshSession()
        token = authStore.accessToken
      }
      
      // STEP 4: Final fallback - try localStorage one more time
      if (!token && typeof window !== 'undefined') {
        const finalBackupToken = localStorage.getItem('auth_token')
        if (finalBackupToken) {
          token = finalBackupToken
          console.log(`[API Client] Found token in localStorage after store check for ${config.method?.toUpperCase()} ${config.url}`)
        }
      }
      
      // STEP 5: Add token to request or reject
      if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
        if (import.meta.env.DEV) {
          console.debug(`[API Client] Added auth token to ${config.method?.toUpperCase()} ${config.url}`)
        }
      } else {
        // If no token after all attempts, reject the request to prevent 401
        console.error('[API Client] No auth token available for request after all attempts:', config.method?.toUpperCase(), config.url, '- Rejecting request')
        return Promise.reject(new Error('Authentication token not available. Please refresh the page or log in again.'))
      }
    } catch (e) {
      console.warn('[API Client] Failed to get auth token for request:', e)
      // Last resort: try localStorage backup even on error
      if (typeof window !== 'undefined') {
        const backupToken = localStorage.getItem('auth_token')
        if (backupToken) {
          config.headers = config.headers || {}
          config.headers.Authorization = `Bearer ${backupToken}`
          console.log(`[API Client] Using backup token from localStorage after error for ${config.method?.toUpperCase()} ${config.url}`)
          return config
        }
      }
      // If no backup token, reject the request
      console.error(`[API Client] No backup token available in localStorage after exception. Rejecting request for ${config.method?.toUpperCase()} ${config.url}`)
      return Promise.reject(new Error('Authentication token not available after exception. Please refresh the page or log in again.'))
    }
    return config
  })

  // Add response interceptor to handle 401 errors
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      
      // If we get a 401 and haven't retried yet, try to refresh the session
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        
        try {
          const authStore = useAuthStore()
          
          // Try to refresh the session
          await authStore.refreshSession()
          
          const token = authStore.accessToken
          
          if (token) {
            console.log('[API Client] Retrying request with refreshed session from auth store')
            // Retry the request with new token
            originalRequest.headers.Authorization = `Bearer ${token}`
            return client(originalRequest)
          } else {
            console.warn('[API Client] No session available after 401, cannot retry')
            // Clear any stale session
            await supabase.auth.signOut()
            throw error
          }
        } catch (refreshErr) {
          console.warn('[API Client] Failed to recover session after 401:', refreshErr)
          throw error
        }
      }
      
      return Promise.reject(error)
    }
  )

  return client
}

/**
 * Default API client instance using unified API_URL configuration.
 * Use this for all API requests to ensure consistency across development and production.
 * 
 * For file uploads that need longer timeout, specify timeout in the request config:
 *   await apiClient.post('/upload', formData, { timeout: 300000 }) // 5 minutes
 * 
 * @example
 *   import { apiClient } from '@/lib/api-client'
 *   const response = await apiClient.get('/items')
 */
export const apiClient = createAuthenticatedApiClient(API_URL)

/**
 * API client with extended timeout for file uploads and long-running operations.
 * Use this for upload operations that may take several minutes.
 */
export const uploadApiClient = createAuthenticatedApiClient(API_URL, 300000) // 5 minutes

/**
 * API client with very long timeout for URL uploads that require download + processing.
 * Use this for URL uploads that may take up to 10 minutes.
 */
export const longUploadApiClient = createAuthenticatedApiClient(API_URL, 600000) // 10 minutes

/**
 * Subscription service API client.
 * Use this for subscription-related API calls.
 */
export const subscriptionClient = createAuthenticatedApiClient(SUBSCRIPTION_API_URL)

