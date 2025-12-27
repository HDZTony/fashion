import axios from 'axios'
import { supabase } from './supabase'
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

  // Add interceptor to inject auth token from Supabase session
  client.interceptors.request.use(async (config) => {
    try {
      // Wait for session to be available (handles page refresh scenarios)
      // On page refresh, Supabase client may need time to initialize and recover session from storage
      let attempts = 0
      let session = null
      const maxAttempts = 10 // Increased attempts for page refresh scenarios
      const baseDelay = 100 // Base delay in ms
      
      while (attempts < maxAttempts && !session) {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.warn(`[API Client] Attempt ${attempts + 1}/${maxAttempts} - Failed to get Supabase session:`, error)
          if (attempts < maxAttempts - 1) {
            // Exponential backoff: wait longer on later attempts
            const delay = baseDelay * Math.min(attempts + 1, 5)
            await new Promise(resolve => setTimeout(resolve, delay))
          }
          attempts++
          continue
        }
        
        session = data.session
        
        // If session exists but token might be expired, try to refresh it
        if (session) {
          // Check if token is close to expiration (within 5 minutes)
          const expiresAt = session.expires_at
          if (expiresAt) {
            const now = Math.floor(Date.now() / 1000)
            const timeUntilExpiry = expiresAt - now
            // If token expires in less than 5 minutes, refresh it
            if (timeUntilExpiry < 300) {
              console.log('[API Client] Token expiring soon, refreshing session...')
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
              if (!refreshError && refreshData.session) {
                session = refreshData.session
                console.log('[API Client] Session refreshed successfully')
              } else {
                console.warn('[API Client] Failed to refresh session:', refreshError)
              }
            }
          }
          
          // If we have a session with token, break early
          if (session.access_token) {
            if (attempts > 0) {
              console.log(`[API Client] Session recovered after ${attempts + 1} attempt(s)`)
            }
            break
          }
        }
        
        if (!session && attempts < maxAttempts - 1) {
          // Exponential backoff: wait longer on later attempts
          const delay = baseDelay * Math.min(attempts + 1, 5)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        attempts++
      }
      
      const token = session?.access_token
      if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
        // Debug log (remove in production if needed)
        if (import.meta.env.DEV) {
          console.debug(`[API Client] Added auth token to ${config.method?.toUpperCase()} ${config.url}`)
        }
      } else {
        // If no token after retries, log warning but don't block the request
        // The backend will return 401, and the response interceptor will handle it
        console.warn('[API Client] No auth token available for request after retries:', config.method?.toUpperCase(), config.url, '- Request will likely fail with 401')
        // Don't add Authorization header if no token - let backend handle it
      }
    } catch (e) {
      console.warn('[API Client] Failed to get Supabase session for request:', e)
    }
    return config
  })

  // Add response interceptor to handle 401 errors
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config
      
      // If we get a 401 and haven't retried yet, try to get/refresh the session
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        
        try {
          // First, try to get the current session (might have recovered by now)
          let session = null
          let attempts = 0
          
          while (attempts < 3 && !session) {
            const { data, error: sessionError } = await supabase.auth.getSession()
            if (!sessionError && data.session?.access_token) {
              session = data.session
              break
            }
            if (attempts < 2) {
              await new Promise(resolve => setTimeout(resolve, 200))
            }
            attempts++
          }
          
          // If we have a session, use it; otherwise try to refresh
          if (!session) {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
            if (!refreshError && refreshData.session?.access_token) {
              session = refreshData.session
            }
          }
          
          if (session?.access_token) {
            console.log('[API Client] Retrying request with recovered/refreshed session')
            // Retry the request with new token
            originalRequest.headers.Authorization = `Bearer ${session.access_token}`
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

