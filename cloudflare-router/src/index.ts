/**
 * Cloudflare Worker for Frontend and Backend Version Routing
 * 
 * This worker routes users to different frontend and backend versions based on their
 * user_id stored in Supabase user_frontend_versions table.
 * 
 * Flow:
 * 1. Extract user_id from Supabase session cookie
 * 2. Query Supabase database for user's version
 * 3. Determine request type (frontend page or API request)
 * 4. Route to appropriate frontend or backend deployment
 */

import { createClient } from '@supabase/supabase-js'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  STABLE_FRONTEND_HOST: string
  V2_FRONTEND_HOST: string
  STABLE_BACKEND_URL: string
  V2_BACKEND_URL: string
}

/**
 * Extract user ID from Supabase session cookie
 * Cookie format: sb-<project-ref>-auth-token=<jwt-token>
 */
function extractUserIdFromCookie(request: Request): string | null {
  try {
    const cookies = request.headers.get('Cookie')
    if (!cookies) {
      return null
    }

    // Match Supabase auth token cookie pattern
    // Format: sb-<project-ref>-auth-token=<jwt-token>
    const match = cookies.match(/sb-[^-]+-auth-token=([^;]+)/)
    if (!match || !match[1]) {
      return null
    }

    const token = match[1]
    
    // Parse JWT to extract user_id (sub claim)
    // JWT format: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode base64 payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    
    // Return user_id (sub claim)
    return payload.sub || null
  } catch (error) {
    console.error('[Router] Error extracting user ID from cookie:', error)
    return null
  }
}

/**
 * Query Supabase to get user's frontend version
 */
async function getUserFrontendVersion(userId: string, env: Env): Promise<string> {
  try {
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const { data, error } = await supabase
      .from('user_frontend_versions')
      .select('version')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[Router] Supabase query error:', error)
      return 'stable' // Default to stable on error
    }

    // Return version if found, otherwise default to stable
    return data?.version || 'stable'
  } catch (error) {
    console.error('[Router] Error querying user version:', error)
    return 'stable' // Default to stable on error
  }
}

/**
 * Route request to appropriate frontend deployment
 */
function routeToFrontend(request: Request, hostname: string): Request {
  const url = new URL(request.url)
  url.hostname = hostname
  url.port = '' // Remove port if present

  // Create new request with updated URL
  // Preserve original method, headers, and body
  const headers = new Headers(request.headers)
  
  // Update Host header
  headers.set('Host', hostname)
  
  // Remove X-Forwarded-* headers that might interfere
  headers.delete('X-Forwarded-Host')
  headers.delete('X-Forwarded-Proto')

  return new Request(url.toString(), {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: request.redirect,
  })
}

/**
 * Route API request to appropriate backend deployment
 */
function routeToBackend(request: Request, backendUrl: string): Request {
  const url = new URL(request.url)
  const backendUrlObj = new URL(backendUrl)
  
  // Replace hostname and port with backend URL
  url.hostname = backendUrlObj.hostname
  url.port = backendUrlObj.port || ''
  url.protocol = backendUrlObj.protocol

  // Create new request with updated URL
  const headers = new Headers(request.headers)
  
  // Update Host header
  headers.set('Host', backendUrlObj.hostname)
  
  // Remove X-Forwarded-* headers that might interfere
  headers.delete('X-Forwarded-Host')
  headers.delete('X-Forwarded-Proto')

  return new Request(url.toString(), {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: request.redirect,
  })
}

/**
 * Check if request is an API request
 */
function isApiRequest(url: URL): boolean {
  // API requests typically start with /api/
  // Also handle other common API patterns
  const path = url.pathname
  return path.startsWith('/api/') || 
         path.startsWith('/health') ||
         path.startsWith('/outfit') ||
         path.startsWith('/try-on') ||
         path.startsWith('/items') ||
         path.startsWith('/looks') ||
         path.startsWith('/favorites') ||
         path.startsWith('/model-image') ||
         path.startsWith('/user-images') ||
         path.startsWith('/scene-image') ||
         path.startsWith('/tryon-history') ||
         path.startsWith('/lv-products') ||
         path.startsWith('/subscription')
}

/**
 * Main worker handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url)
      
      // Extract user ID from cookie
      const userId = extractUserIdFromCookie(request)
      
      // Determine user's version
      let version = 'stable'
      if (userId) {
        version = await getUserFrontendVersion(userId, env)
        console.log(`[Router] User ${userId} assigned version: ${version}`)
      } else {
        console.log('[Router] No user ID found, routing to stable')
      }

      // Check if this is an API request
      if (isApiRequest(url)) {
        // Route API request to appropriate backend
        const backendUrl = version === 'v2' 
          ? env.V2_BACKEND_URL 
          : env.STABLE_BACKEND_URL
        
        console.log(`[Router] Routing API request to ${backendUrl}`)
        const backendRequest = routeToBackend(request, backendUrl)
        const response = await fetch(backendRequest)
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      } else {
        // Route frontend request to appropriate frontend
        const frontendHost = version === 'v2' 
          ? env.V2_FRONTEND_HOST 
          : env.STABLE_FRONTEND_HOST
        
        console.log(`[Router] Routing frontend request to ${frontendHost}`)
        const frontendRequest = routeToFrontend(request, frontendHost)
        const response = await fetch(frontendRequest)
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        })
      }
    } catch (error) {
      console.error('[Router] Unexpected error:', error)
      
      // On any error, route to stable version as fallback
      try {
        const url = new URL(request.url)
        if (isApiRequest(url)) {
          const stableRequest = routeToBackend(request, env.STABLE_BACKEND_URL)
          return fetch(stableRequest)
        } else {
          const stableRequest = routeToFrontend(request, env.STABLE_FRONTEND_HOST)
          return fetch(stableRequest)
        }
      } catch (fallbackError) {
        console.error('[Router] Fallback routing failed:', fallbackError)
        return new Response('Internal Server Error', { status: 500 })
      }
    }
  },
}

