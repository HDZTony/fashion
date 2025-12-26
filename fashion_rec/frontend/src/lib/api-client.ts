import axios from 'axios'
import { supabase } from './supabase'

/**
 * Create an axios instance with authentication interceptor.
 * This ensures that auth tokens are properly attached to requests,
 * especially after page refreshes when Supabase session may need time to recover.
 */
export function createAuthenticatedApiClient(baseURL: string) {
  const client = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Add interceptor to inject auth token from Supabase session
  client.interceptors.request.use(async (config) => {
    try {
      // Wait for session to be available (handles page refresh scenarios)
      let attempts = 0
      let session = null
      
      while (attempts < 5 && !session) {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.warn('[API Client] Failed to get Supabase session:', error)
          if (attempts < 4) {
            await new Promise(resolve => setTimeout(resolve, 200))
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
            break
          }
        }
        
        if (!session && attempts < 4) {
          // Wait longer for session to recover (Supabase may need more time on page refresh)
          await new Promise(resolve => setTimeout(resolve, 200))
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
        // If no token after retries, this will cause 401 - which is expected
        console.warn('[API Client] No auth token available for request:', config.method?.toUpperCase(), config.url)
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
      
      // If we get a 401 and haven't retried yet, try to refresh the session
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true
        
        try {
          // Try to refresh the session
          const { data, error: refreshError } = await supabase.auth.refreshSession()
          
          if (refreshError || !data.session) {
            console.warn('[API Client] Session refresh failed:', refreshError)
            // Clear any stale session
            await supabase.auth.signOut()
            throw error
          }
          
          // Retry the request with new token
          originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`
          return client(originalRequest)
        } catch (refreshErr) {
          console.warn('[API Client] Failed to refresh session:', refreshErr)
          throw error
        }
      }
      
      return Promise.reject(error)
    }
  )

  return client
}

