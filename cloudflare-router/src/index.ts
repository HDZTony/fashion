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
    console.log(`[Router] Cached version ${version} for user ${userId}`)
  } catch (error) {
    console.error('[Router] Error caching user version:', error)
  }
}

/**
 * Query Supabase to get user's frontend version
 */
async function getUserFrontendVersionFromDB(userId: string, env: Env): Promise<string> {
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
 * Get user version with KV cache
 */
async function getUserVersion(userId: string, env: Env): Promise<string> {
  // 1. Try KV cache first
  const cached = await getUserVersionFromCache(userId, env)
  if (cached) {
    console.log(`[Router] Cache hit for user ${userId}: ${cached}`)
    return cached
  }

  // 2. Cache miss, query database
  console.log(`[Router] Cache miss for user ${userId}, querying database`)
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

    console.log(`[Router] Set version ${version} for user ${userId}`)
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
 */
function isApiRequest(url: URL): boolean {
  // API requests typically start with /api/
  // Also handle other common API patterns
  const path = url.pathname
  
  // List of all API endpoints from backend (main.py)
  // This ensures all API requests are routed to backend, not frontend
  // NOTE: Root path '/' should route to frontend, not backend
  return path.startsWith('/api/') || 
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

      // Handle API endpoint for setting user version
      if (path === '/api/router/set-version' && request.method === 'POST') {
        const userId = extractUserIdFromCookie(request)
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        try {
          const body = await request.json() as { version: string }
          const { version } = body

          if (!version || (version !== 'stable' && version !== 'v2')) {
            return new Response(JSON.stringify({ error: 'Invalid version' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const success = await setUserVersion(userId, version, env)
          if (success) {
            return new Response(JSON.stringify({ success: true, version }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          } else {
            return new Response(JSON.stringify({ error: 'Failed to set version' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            })
          }
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Invalid request body' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
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
        console.log(`[Router] User ${userId} assigned version: ${version} for path: ${path}`)
      } else if (userId && isApiRequest(url)) {
        // API requests also use user's version
        version = await getUserVersion(userId, env)
        console.log(`[Router] User ${userId} API request, assigned version: ${version}`)
      } else {
        // Unauthenticated users always use stable
        console.log('[Router] No user ID found, routing to stable')
      }

      // Check if this is an API request
      if (isApiRequest(url)) {
        // Route API request to appropriate backend
        const backendUrl = version === 'v2' 
          ? env.V2_BACKEND_URL 
          : env.STABLE_BACKEND_URL
        
        // Log all headers for debugging (especially Authorization)
        const allHeaders: Record<string, string> = {}
        request.headers.forEach((value, key) => {
          allHeaders[key] = value
        })
        console.log(`[Router] API request ${path} - All headers:`, JSON.stringify(Object.keys(allHeaders)))
        
        // Log Authorization header status for debugging (case-insensitive check)
        const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
        console.log(`[Router] API request ${path} - Authorization header: ${authHeader ? 'Present (' + authHeader.substring(0, 30) + '...)' : 'Missing'}`)
        if (authHeader) {
          console.log(`[Router] Authorization header full value: ${authHeader}`)
        }
        
        console.log(`[Router] Routing API request to ${backendUrl}`)
        const backendRequest = routeToBackend(request, backendUrl)
        
        // Verify Authorization header is preserved in forwarded request
        const forwardedAuthHeader = backendRequest.headers.get('Authorization') || backendRequest.headers.get('authorization')
        console.log(`[Router] Forwarded request Authorization header: ${forwardedAuthHeader ? 'Present (' + forwardedAuthHeader.substring(0, 30) + '...)' : 'Missing'}`)
        if (forwardedAuthHeader) {
          console.log(`[Router] Forwarded Authorization header full value: ${forwardedAuthHeader}`)
        }
        
        // Log all forwarded headers
        const forwardedHeaders: Record<string, string> = {}
        backendRequest.headers.forEach((value, key) => {
          forwardedHeaders[key] = value
        })
        console.log(`[Router] Forwarded request headers:`, JSON.stringify(Object.keys(forwardedHeaders)))
        
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
