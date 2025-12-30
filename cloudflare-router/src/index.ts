/**
 * Cloudflare Worker for Frontend and Backend Version Routing
 * 
 * Optimized version with KV caching and lazy routing:
 * - Version is determined when user first accesses /studio
 * - Caches user version in KV to avoid database queries
 * - All authenticated pages use the determined version (not just /studio)
 * - Unauthenticated pages always use stable
 * 
 * Flow:
 * 1. Extract user_id from Supabase session cookie
 * 2. If authenticated: Check KV cache for version, if not found query Supabase and cache
 * 3. If not authenticated: Route to stable
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
  USER_VERSIONS: KVNamespace
}

/**
 * Extract user ID from JWT token
 * JWT format: header.payload.signature
 */
function extractUserIdFromToken(token: string): string | null {
  try {
    // Parse JWT to extract user_id (sub claim)
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode base64 payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    
    // Return user_id (sub claim)
    return payload.sub || null
  } catch (error) {
    console.error('[Router] Error parsing JWT token:', error)
    return null
  }
}

/**
 * Extract user ID from request
 * Tries Authorization header first (Bearer token), then Cookie
 */
function extractUserIdFromCookie(request: Request): string | null {
  // 1. Try Authorization header first (Bearer token)
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
  if (authHeader) {
    // Extract token from "Bearer <token>" format
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    if (match && match[1]) {
      const userId = extractUserIdFromToken(match[1])
      if (userId) {
        return userId
      }
    }
  }

  // 2. Fallback to Cookie header
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
    const userId = extractUserIdFromToken(token)
    if (userId) {
      return userId
    }
  } catch (error) {
    console.error('[Router] Error extracting user ID from cookie:', error)
  }

  return null
}

/**
 * Get user version from KV cache
 */
async function getUserVersionFromCache(userId: string, env: Env): Promise<string | null> {
  try {
    const cached = await env.USER_VERSIONS.get(userId)
    return cached || null
  } catch (error) {
    console.error('[Router] Error reading from KV cache:', error)
    return null
  }
}

/**
 * Cache user version in KV
 */
async function cacheUserVersion(userId: string, version: string, env: Env): Promise<void> {
  try {
    // Cache for 30 days (2592000 seconds)
    await env.USER_VERSIONS.put(userId, version, {
      expirationTtl: 2592000
    })
  } catch (error) {
    console.error('[Router] Error caching user version:', error)
  }
}

/**
 * Query Supabase to get user's frontend version
 */
async function getUserFrontendVersionFromDB(userId: string, env: Env): Promise<string> {
  try {
    /**
     * Create Supabase client with explicit configuration.
     * 
     * For service role key in Cloudflare Worker environment:
     * - persistSession: false (no localStorage in Worker)
     * - autoRefreshToken: false (service role key doesn't expire)
     * - detectSessionInUrl: false (not needed for service role)
     */
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false, // No localStorage in Cloudflare Worker
          autoRefreshToken: false, // Service role key doesn't expire
          detectSessionInUrl: false, // Not needed for service role
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
 * Get user version with KV cache
 */
async function getUserVersion(userId: string, env: Env): Promise<string> {
  // 1. Try KV cache first
  const cached = await getUserVersionFromCache(userId, env)
  if (cached) {
    return cached
  }

  // 2. Cache miss, query database
  const version = await getUserFrontendVersionFromDB(userId, env)
  
  // 3. Cache the result
  await cacheUserVersion(userId, version, env)
  
  return version
}

/**
 * Set user version (for API endpoint)
 */
async function setUserVersion(userId: string, version: string, env: Env): Promise<boolean> {
  try {
    // Validate version
    if (version !== 'stable' && version !== 'v2') {
      return false
    }

    // 1. Update database
    /**
     * Create Supabase client with explicit configuration.
     * 
     * For service role key in Cloudflare Worker environment:
     * - persistSession: false (no localStorage in Worker)
     * - autoRefreshToken: false (service role key doesn't expire)
     * - detectSessionInUrl: false (not needed for service role)
     */
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false, // No localStorage in Cloudflare Worker
          autoRefreshToken: false, // Service role key doesn't expire
          detectSessionInUrl: false, // Not needed for service role
        },
      }
    )

    const { error } = await supabase
      .from('user_frontend_versions')
      .upsert({
        user_id: userId,
        version: version,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (error) {
      console.error('[Router] Error updating user version in DB:', error)
      return false
    }

    // 2. Update KV cache
    await cacheUserVersion(userId, version, env)

    return true
  } catch (error) {
    console.error('[Router] Error setting user version:', error)
    return false
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
  // CRITICAL: Preserve all headers including Authorization
  const headers = new Headers(request.headers)
  
  // Update Host header
  headers.set('Host', backendUrlObj.hostname)
  
  // Remove X-Forwarded-* headers that might interfere
  headers.delete('X-Forwarded-Host')
  headers.delete('X-Forwarded-Proto')
  
  // Ensure Authorization header is explicitly preserved (defensive programming)
  const authHeader = request.headers.get('Authorization')
  if (authHeader) {
    headers.set('Authorization', authHeader)
  }

  return new Request(url.toString(), {
    method: request.method,
    headers: headers,
    body: request.body,
    redirect: request.redirect,
  })
}

/**
 * Check if request is an API request
 * 
 * IMPORTANT: We need to distinguish between:
 * 1. Browser page requests (should route to frontend)
 * 2. JavaScript API requests (should route to backend)
 * 
 * Strategy:
 * - Check Accept header: browser page requests usually include "text/html"
 * - API requests usually include "application/json" or don't have Accept header
 * - Path-based check as fallback
 */
function isApiRequest(url: URL, request: Request): boolean {
  const path = url.pathname
  
  // Check Accept header first (most reliable way to distinguish)
  const acceptHeader = request.headers.get('Accept') || ''
  const isHtmlRequest = acceptHeader.includes('text/html')
  
  // If it's an HTML request (browser page navigation), route to frontend
  // Exception: /api/* paths are always API requests
  if (isHtmlRequest && !path.startsWith('/api/')) {
    console.log(`[Router] isApiRequest: false (HTML request for ${path})`)
    return false
  }
  
  // List of all API endpoints from backend (main.py)
  // This ensures all API requests are routed to backend, not frontend
  // NOTE: Root path '/' should route to frontend, not backend
  const isApi = path.startsWith('/api/') || 
         path.startsWith('/health') ||
         path.startsWith('/outfit') ||
         path.startsWith('/try-on') ||
         path.startsWith('/items') ||
         path.startsWith('/upload') ||
         path.startsWith('/looks') ||
         path.startsWith('/favorites') ||
         path.startsWith('/model-image') ||
         path.startsWith('/user-images') ||
         path.startsWith('/scene-image') ||
         path.startsWith('/tryon-history') ||
         path.startsWith('/lv-products') ||
         path.startsWith('/subscription') ||
         path.startsWith('/cleanup-expired-files')
  
  console.log(`[Router] isApiRequest: ${isApi} for path ${path}, Accept: ${acceptHeader}`)
  return isApi
}

/**
 * Check if path requires version routing
 * All authenticated pages use the user's determined version
 * Only unauthenticated pages use stable
 */
function requiresVersionRouting(path: string, userId: string | null): boolean {
  // If user is authenticated, use their determined version for all pages
  // If not authenticated, use stable for all pages
  return userId !== null
}

/**
 * Main worker handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url)
      const path = url.pathname

      // Helper function to get CORS headers
      const getCorsHeaders = (origin: string | null) => {
        // If request has origin, use it; otherwise use wildcard (for non-credential requests)
        const allowOrigin = origin || '*'
        const headers: Record<string, string> = {
          'Access-Control-Allow-Origin': allowOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        }
        // Only add credentials header if we're using a specific origin (not wildcard)
        if (origin) {
          headers['Access-Control-Allow-Credentials'] = 'true'
        }
        return headers
      }

      // Handle CORS preflight for router API endpoints
      if ((path === '/api/router/get-version' || path === '/api/router/set-version') && request.method === 'OPTIONS') {
        const origin = request.headers.get('Origin')
        return new Response(null, {
          status: 204,
          headers: getCorsHeaders(origin)
        })
      }

      // Handle API endpoint for getting user version
      if (path === '/api/router/get-version' && request.method === 'GET') {
        const userId = extractUserIdFromCookie(request)
        const origin = request.headers.get('Origin')
        const corsHeaders = getCorsHeaders(origin)

        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        try {
          const version = await getUserVersion(userId, env)
          return new Response(JSON.stringify({ version }), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        } catch (error) {
          console.error('[Router] Error getting user version:', error)
          return new Response(JSON.stringify({ error: 'Failed to get version' }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Handle API endpoint for setting user version
      if (path === '/api/router/set-version' && request.method === 'POST') {
        const origin = request.headers.get('Origin')
        const corsHeaders = getCorsHeaders(origin)
        
        const userId = extractUserIdFromCookie(request)
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        try {
          const body = await request.json() as { version: string }
          const { version } = body

          if (!version || (version !== 'stable' && version !== 'v2')) {
            return new Response(JSON.stringify({ error: 'Invalid version' }), {
              status: 400,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          const success = await setUserVersion(userId, version, env)
          if (success) {
            return new Response(JSON.stringify({ success: true, version }), {
              status: 200,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          } else {
            return new Response(JSON.stringify({ error: 'Failed to set version' }), {
              status: 500,
              headers: { 
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Invalid request body' }), {
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // Extract user ID from cookie
      const userId = extractUserIdFromCookie(request)
      
      // Determine user's version
      let version = 'stable' // Default to stable
      
      // If user is authenticated, check their version (from KV cache or database)
      // This ensures all pages use the version determined when they first accessed /studio
      if (userId && requiresVersionRouting(path, userId)) {
        version = await getUserVersion(userId, env)
      } else if (userId && isApiRequest(url, request)) {
        // API requests also use user's version
        version = await getUserVersion(userId, env)
      }

      // Check if this is an API request
      const isApi = isApiRequest(url, request)
      console.log(`[Router] Request ${request.method} ${path} - isApiRequest: ${isApi}, version: ${version}`)
      
      if (isApi) {
        // Route API request to appropriate backend
        const backendUrl = version === 'v2' 
          ? env.V2_BACKEND_URL 
          : env.STABLE_BACKEND_URL
        
        // Validate backend URL
        if (!backendUrl || !backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
          console.error(`[Router] Invalid backend URL: ${backendUrl}`)
          return new Response(JSON.stringify({ 
            error: 'Backend configuration error', 
            detail: 'Backend URL is not configured correctly',
            path: path
          }), {
            status: 500,
            statusText: 'Internal Server Error',
            headers: {
              'Content-Type': 'application/json',
            }
          })
        }
        
        console.log(`[Router] Routing API request ${request.method} ${path} to backend: ${backendUrl} (version: ${version})`)
        const backendRequest = routeToBackend(request, backendUrl)
        console.log(`[Router] Backend request URL: ${backendRequest.url}, method: ${backendRequest.method}, hasAuth: ${!!backendRequest.headers.get('Authorization')}`)
        
        const fetchStartTime = Date.now()
        
        // Add timeout to backend fetch using AbortController
        // For try-on and upload operations, use longer timeout (4 minutes to be under frontend's 5min timeout)
        // For other operations, use 25 seconds (to be under frontend's 30s timeout)
        const isTryOnRequest = path === '/try-on'
        const isUploadRequest = path === '/upload'
        const timeoutMs = (isTryOnRequest || isUploadRequest) ? 240000 : 25000 // 4 minutes for try-on/upload, 25 seconds for others
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => {
          abortController.abort()
        }, timeoutMs)
        
        let response: Response
        try {
          // Create a new request with abort signal
          const requestWithSignal = new Request(backendRequest, {
            signal: abortController.signal
          })
          
          response = await fetch(requestWithSignal)
          
          // Clear timeout if request completed successfully
          clearTimeout(timeoutId)
        } catch (fetchError: any) {
          // Clear timeout in case of error
          clearTimeout(timeoutId)
          
          const errorDuration = Date.now() - fetchStartTime
          console.error(`[Router] Backend fetch failed for ${backendRequest.url} after ${errorDuration}ms:`, fetchError)
          console.error(`[Router] Error details - name: ${fetchError?.name}, message: ${fetchError?.message}, stack: ${fetchError?.stack}`)
          
          // Determine error type and status code
          let errorDetail = fetchError.message || 'Request timeout or connection error'
          let statusCode = 504
          let statusText = 'Gateway Timeout'
          const backendHost = new URL(backendRequest.url).hostname
          
          if (fetchError.name === 'AbortError') {
            errorDetail = `Backend fetch timeout after ${timeoutMs}ms. The backend at ${backendHost} did not respond in time. 

Possible causes:
1. Backend service is not running - Check Fly.io dashboard to verify the service is active
2. Backend is slow or overloaded - Check Fly.io logs for performance issues
3. Network connectivity issues - Verify Cloudflare Worker can reach Fly.io
4. Backend URL might be incorrect - Current URL: ${backendUrl}

Troubleshooting steps:
- Check Fly.io app status: flyctl status (for ${backendHost})
- Check Fly.io logs: flyctl logs (for ${backendHost})
- Test backend directly: curl https://${backendHost}/health
- Verify backend URL in Cloudflare Worker secrets`
            statusCode = 504
            statusText = 'Gateway Timeout'
            console.error(`[Router] Timeout waiting for backend ${backendHost} to respond to ${path} after ${errorDuration}ms`)
            console.error(`[Router] Backend URL used: ${backendUrl}`)
            console.error(`[Router] Full request URL: ${backendRequest.url}`)
          } else if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
            errorDetail = `Cannot connect to backend at ${backendHost}. Please check: 1) The backend URL is correct, 2) The backend service is running, 3) Network connectivity is available.`
            statusCode = 502
            statusText = 'Bad Gateway'
            console.error(`[Router] Network error connecting to backend ${backendHost}`)
          } else if (fetchError.message?.includes('DNS')) {
            errorDetail = `DNS resolution failed for ${backendHost}. Please check if the backend URL is correct.`
            statusCode = 502
            statusText = 'Bad Gateway'
            console.error(`[Router] DNS resolution failed for backend ${backendHost}`)
          }
          
          // Return error response with CORS headers
          const origin = request.headers.get('Origin')
          const corsHeaders = getCorsHeaders(origin)
          
          return new Response(JSON.stringify({ 
            error: 'Backend request failed', 
            detail: errorDetail,
            path: path,
            backend_host: new URL(backendRequest.url).hostname
          }), {
            status: statusCode,
            statusText: statusText,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
        
        const fetchDuration = Date.now() - fetchStartTime
        console.log(`[Router] Backend response received: status ${response.status} in ${fetchDuration}ms for ${path}`)
        
        // Add CORS headers to backend response
        const origin = request.headers.get('Origin')
        const corsHeaders = getCorsHeaders(origin)
        
        // Merge backend headers with CORS headers
        // CORS headers take precedence to ensure proper CORS handling
        const responseHeaders = new Headers(response.headers)
        for (const [key, value] of Object.entries(corsHeaders)) {
          responseHeaders.set(key, value)
        }
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        })
      } else {
        // Route frontend request to appropriate frontend
        const frontendHost = version === 'v2' 
          ? env.V2_FRONTEND_HOST 
          : env.STABLE_FRONTEND_HOST
        
        console.log(`[Router] Routing frontend request to: ${frontendHost}`)
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
        if (isApiRequest(url, request)) {
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
