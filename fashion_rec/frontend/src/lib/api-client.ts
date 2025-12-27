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
  // Priority: localStorage (fastest) -> Supabase session -> reject request
  client.interceptors.request.use(async (config) => {
    try {
      // STEP 1: First, try localStorage backup (fastest path)
      // This is critical for page refresh scenarios where Supabase client may not be initialized yet
      // Token is stored in localStorage during login (see Login.vue, Callback.vue, useAuthState.ts)
      let token: string | null = null
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('auth_token')
        if (token) {
          config.headers = config.headers || {}
          config.headers.Authorization = `Bearer ${token}`
          // #region agent log
          if (typeof window !== 'undefined') {
            fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:29',message:'Using token from localStorage (fast path)',data:{method:config.method,url:config.url,hasAuthHeader:!!config.headers?.Authorization},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          }
          // #endregion
          if (import.meta.env.DEV) {
            console.debug(`[API Client] Using token from localStorage for ${config.method?.toUpperCase()} ${config.url}`)
          }
          return config
        }
      }
      
      // STEP 2: If no token in localStorage, try Supabase session (with retry logic)
      // This handles cases where localStorage token was cleared but session still exists
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
                // Sync refreshed token to localStorage
                if (typeof window !== 'undefined' && session.access_token) {
                  localStorage.setItem('auth_token', session.access_token)
                }
                console.log('[API Client] Session refreshed successfully')
              } else {
                console.warn('[API Client] Failed to refresh session:', refreshError)
              }
            }
          }
          
          // If we have a session with token, sync to localStorage and break early
          if (session.access_token) {
            // Sync token to localStorage for future fast access
            if (typeof window !== 'undefined') {
              localStorage.setItem('auth_token', session.access_token)
            }
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
      
      token = session?.access_token || null
      
      // STEP 3: If we still don't have a token after all retries, wait a bit more and try one final time
      // This handles edge cases where Supabase client takes longer to initialize on page refresh
      if (!token) {
        console.warn(`[API Client] No auth token available after ${maxAttempts} attempts, waiting 500ms for final attempt...`)
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Final attempt: try getSession one more time
        try {
          const { data } = await supabase.auth.getSession()
          if (data.session?.access_token) {
            token = data.session.access_token
            // Sync to localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem('auth_token', token)
            }
            console.log(`[API Client] Found token from getSession after final wait for ${config.method?.toUpperCase()} ${config.url}`)
          }
        } catch (finalError) {
          console.warn(`[API Client] Final getSession attempt failed:`, finalError)
        }
        
        // Final fallback: try localStorage one more time (in case useAuthState synced it during retries)
        if (!token && typeof window !== 'undefined') {
          const finalBackupToken = localStorage.getItem('auth_token')
          if (finalBackupToken) {
            token = finalBackupToken as string
            console.log(`[API Client] Found token in localStorage after final wait for ${config.method?.toUpperCase()} ${config.url}`)
          }
        }
      }
      
      // STEP 4: Add token to request or reject
      if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
        // #region agent log
        if (typeof window !== 'undefined') {
          fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:108',message:'Using token from getSession',data:{method:config.method,url:config.url,hasAuthHeader:!!config.headers?.Authorization},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        }
        // #endregion
        if (import.meta.env.DEV) {
          console.debug(`[API Client] Added auth token to ${config.method?.toUpperCase()} ${config.url}`)
        }
      } else {
        // If no token after all attempts, reject the request to prevent 401
        // This ensures we don't send unauthenticated requests to the backend
        console.error('[API Client] No auth token available for request after all attempts:', config.method?.toUpperCase(), config.url, '- Rejecting request')
        // #region agent log
        if (typeof window !== 'undefined') {
          fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:119',message:'Rejecting request - no token',data:{method:config.method,url:config.url,hasLocalStorageToken:!!(typeof window!=='undefined'?localStorage.getItem('auth_token'):null)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
        }
        // #endregion
        return Promise.reject(new Error('Authentication token not available. Please refresh the page or log in again.'))
      }
    } catch (e) {
      console.warn('[API Client] Failed to get Supabase session for request:', e)
      // Last resort: try localStorage backup even on error
      if (typeof window !== 'undefined') {
        const backupToken = localStorage.getItem('auth_token')
        if (backupToken) {
          config.headers = config.headers || {}
          config.headers.Authorization = `Bearer ${backupToken}`
          console.log(`[API Client] Using backup token from localStorage after error for ${config.method?.toUpperCase()} ${config.url}`)
          // #region agent log
          if (typeof window !== 'undefined') {
            fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:131',message:'Using backup token after error',data:{method:config.method,url:config.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
          }
          // #endregion
          return config
        }
      }
      // If no backup token, reject the request
      console.error(`[API Client] No backup token available in localStorage after exception. Rejecting request for ${config.method?.toUpperCase()} ${config.url}`)
      // #region agent log
      if (typeof window !== 'undefined') {
        fetch('http://127.0.0.1:7242/ingest/a26e042c-3ee7-44f0-bb50-a1b971ea28f9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api-client.ts:140',message:'No backup token after error - rejecting request',data:{method:config.method,url:config.url,error:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
      }
      // #endregion
      return Promise.reject(new Error('Authentication token not available after exception. Please refresh the page or log in again.'))
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

