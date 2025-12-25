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
      
      while (attempts < 3 && !session) {
        const { data, error } = await supabase.auth.getSession()
        if (error) {
          console.warn('Failed to get Supabase session:', error)
          break
        }
        session = data.session
        
        if (!session && attempts < 2) {
          // Wait a bit for session to recover (Supabase may need time on page refresh)
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        attempts++
      }
      
      const token = session?.access_token
      if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
      } else {
        // If no token after retries, this will cause 401 - which is expected
        console.warn('No auth token available for request')
      }
    } catch (e) {
      console.warn('Failed to get Supabase session for request:', e)
    }
    return config
  })

  return client
}

