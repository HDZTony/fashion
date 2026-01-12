/**
 * Cloudflare Worker for Blog API
 * 
 * Provides CRUD operations for blog posts stored in Supabase.
 * Handles authentication via JWT tokens from cookies or Authorization headers.
 */

import { createClient } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  blog_media?: R2Bucket // Optional: Keep for backward compatibility
  R2_PUBLIC_URL?: string // Optional: Custom R2 public URL (e.g., https://media.yourdomain.com)
  // S3 API configuration (for direct R2 access)
  R2_ENDPOINT_URL?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_BUCKET_NAME?: string
}

interface BlogPost {
  id: string
  user_id: string
  title: string
  content: string
  tags: string[]
  status: 'draft' | 'published'
  created_at: string
  updated_at: string
}

/**
 * Extract user ID from JWT token
 */
function extractUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.sub || null
  } catch (error) {
    console.error('[Blog] Error parsing JWT token:', error)
    return null
  }
}

/**
 * Extract user ID from request (Authorization header or Cookie)
 */
function extractUserIdFromRequest(request: Request): string | null {
  // 1. Try Authorization header first
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization')
  if (authHeader) {
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
    const match = cookies.match(/sb-[^-]+-auth-token=([^;]+)/)
    if (!match || !match[1]) {
      return null
    }
    const token = match[1]
    return extractUserIdFromToken(token)
  } catch (error) {
    console.error('[Blog] Error extracting user ID from cookie:', error)
  }

  return null
}

/**
 * Get CORS headers
 */
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowOrigin = origin || '*'
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
  if (origin) {
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  return headers
}

/**
 * Create Supabase client
 */
function createSupabaseClient(env: Env) {
  return createClient(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}

/**
 * Create S3 client for R2 (using S3 API)
 */
function createR2S3Client(env: Env): S3Client | null {
  if (!env.R2_ENDPOINT_URL || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    return null
  }

  return new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT_URL,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true, // Required for R2
  })
}

/**
 * Main worker handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method
    const origin = request.headers.get('Origin')
    const corsHeaders = getCorsHeaders(origin)

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      })
    }

    // Create Supabase client
    const supabase = createSupabaseClient(env)

    try {
      // GET /posts - List blog posts
      if (path === '/posts' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const status = url.searchParams.get('status') || 'published'
        const userId = extractUserIdFromRequest(request)

        let query = supabase
          .from('blog_posts')
          .select('id, title, content, tags, status, media_urls, created_at, updated_at, user_id')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        // If not authenticated or requesting published posts, only show published
        if (!userId || status === 'published') {
          query = query.eq('status', 'published')
        } else {
          // Authenticated users can see their own drafts
          query = query.or(`status.eq.published,user_id.eq.${userId}`)
        }

        const { data, error } = await query

        if (error) {
          throw error
        }

        return new Response(JSON.stringify({ posts: data || [] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        })
      }

      // GET /posts/:id - Get single post
      const postIdMatch = path.match(/^\/posts\/([^\/]+)$/)
      if (postIdMatch && method === 'GET') {
        const postId = postIdMatch[1]
        const userId = extractUserIdFromRequest(request)

        const { data: post, error } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('id', postId)
          .maybeSingle()

        if (error) {
          throw error
        }

        if (!post) {
          return new Response(JSON.stringify({ error: 'Post not found' }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        // Permission check: only published posts or author can view
        if (post.status !== 'published' && (!userId || post.user_id !== userId)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        return new Response(JSON.stringify(post), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        })
      }

      // POST /posts - Create post
      if (path === '/posts' && method === 'POST') {
        const userId = extractUserIdFromRequest(request)
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const body = await request.json() as {
          title: string
          content: string
          tags?: string[]
          status?: string
          media_urls?: Array<{ url: string; type: 'image' | 'video'; thumbnail?: string }>
        }

        const { title, content, tags = [], status = 'draft', media_urls = [] } = body

        if (!title || !content) {
          return new Response(JSON.stringify({ error: 'Title and content are required' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        if (status !== 'draft' && status !== 'published') {
          return new Response(JSON.stringify({ error: 'Status must be draft or published' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const { data, error } = await supabase
          .from('blog_posts')
          .insert({
            user_id: userId,
            title,
            content,
            tags,
            status,
            media_urls: media_urls.length > 0 ? media_urls : null
          })
          .select()
          .single()

        if (error) {
          throw error
        }

        return new Response(JSON.stringify(data), {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        })
      }

      // PUT /posts/:id - Update post
      if (postIdMatch && method === 'PUT') {
        const postId = postIdMatch[1]
        const userId = extractUserIdFromRequest(request)

        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        // Check if post exists and belongs to user
        const { data: existingPost, error: checkError } = await supabase
          .from('blog_posts')
          .select('user_id')
          .eq('id', postId)
          .single()

        if (checkError || !existingPost) {
          return new Response(JSON.stringify({ error: 'Post not found' }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        if (existingPost.user_id !== userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const body = await request.json() as {
          title?: string
          content?: string
          tags?: string[]
          status?: string
          media_urls?: Array<{ url: string; type: 'image' | 'video'; thumbnail?: string }>
        }

        // Validate status if provided
        if (body.status && body.status !== 'draft' && body.status !== 'published') {
          return new Response(JSON.stringify({ error: 'Status must be draft or published' }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const { data, error } = await supabase
          .from('blog_posts')
          .update({
            ...body,
            updated_at: new Date().toISOString()
          })
          .eq('id', postId)
          .select()
          .single()

        if (error) {
          throw error
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        })
      }

      // POST /media/upload - Upload image or video
      if (path === '/media/upload' && method === 'POST') {
        const userId = extractUserIdFromRequest(request)
        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        // Check storage availability: prefer S3 API, fallback to Workers binding
        const s3Client = createR2S3Client(env)
        const useS3API = s3Client !== null && env.R2_BUCKET_NAME
        
        if (!useS3API && !env.blog_media) {
          console.error('[Blog] No R2 storage available')
          return new Response(JSON.stringify({ 
            error: 'Storage service unavailable',
            detail: 'Either configure R2 S3 API (R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) or R2 bucket binding in wrangler.toml'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
        
        if (useS3API) {
          console.log('[Blog] Using S3 API for R2 (direct connection)')
        } else {
          console.log('[Blog] Using Workers R2 binding (may use local simulation in dev)')
        }

        try {
          const formData = await request.formData()
          const file = formData.get('file') as File | null
          const mediaType = formData.get('type') as string | null // 'image' or 'video'

          if (!file) {
            return new Response(JSON.stringify({ error: 'No file provided' }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }

          // Validate file type
          const fileType = mediaType || (file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null)
          if (!fileType || (fileType !== 'image' && fileType !== 'video')) {
            return new Response(JSON.stringify({ error: 'Invalid file type. Only images and videos are supported.' }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            })
          }


          // Generate unique filename
          const timestamp = Date.now()
          const randomId = crypto.randomUUID().substring(0, 8)
          const extension = file.name.split('.').pop() || (fileType === 'image' ? 'jpg' : 'mp4')
          const filename = `${userId}/${fileType}_${timestamp}_${randomId}.${extension}`

          // Upload to R2
          console.log(`[Blog] Starting upload to R2: ${filename}, size: ${file.size} bytes`)
          
          const fileBuffer = await file.arrayBuffer()
          console.log(`[Blog] File buffer created: ${fileBuffer.byteLength} bytes`)
          
          if (fileBuffer.byteLength === 0) {
            throw new Error('File buffer is empty')
          }
          
          // Upload using S3 API or Workers binding
          let uploadedSize: number = fileBuffer.byteLength
          
          if (useS3API && s3Client) {
            // Use S3 API (direct R2 connection)
            try {
              const bucketName = env.R2_BUCKET_NAME!
              
              const putCommand = new PutObjectCommand({
                Bucket: bucketName,
                Key: filename,
                Body: new Uint8Array(fileBuffer),
                ContentType: file.type,
                CacheControl: 'public, max-age=31536000',
                Metadata: {
                  userId,
                  originalName: file.name,
                  uploadedAt: new Date().toISOString(),
                },
              })
              
              const putResult = await s3Client.send(putCommand)
              console.log(`[Blog] S3 API upload completed for: ${filename}, ETag: ${putResult.ETag}`)
              
              // Verify file was uploaded
              await new Promise(resolve => setTimeout(resolve, 200))
              
              const headCommand = new HeadObjectCommand({
                Bucket: bucketName,
                Key: filename,
              })
              
              const headResult = await s3Client.send(headCommand)
              
              if (headResult.ContentLength !== fileBuffer.byteLength) {
                throw new Error(`File size mismatch: expected ${fileBuffer.byteLength} bytes, got ${headResult.ContentLength} bytes`)
              }
              
              uploadedSize = headResult.ContentLength || fileBuffer.byteLength
              console.log(`[Blog] File verified via S3 API: ${filename}, size: ${uploadedSize} bytes, contentType: ${headResult.ContentType}`)
            } catch (uploadError: any) {
              console.error(`[Blog] S3 API upload failed for ${filename}:`, uploadError)
              console.error(`[Blog] Upload error details:`, {
                message: uploadError.message,
                stack: uploadError.stack,
                name: uploadError.name,
              })
              throw new Error(`Failed to upload file to R2 via S3 API: ${uploadError.message || 'Unknown error'}`)
            }
          } else {
            // Use Workers binding (fallback)
            if (!env.blog_media) {
              throw new Error('R2 bucket binding not available')
            }
            
            try {
              const uploadResult = await env.blog_media.put(filename, fileBuffer, {
                httpMetadata: {
                  contentType: file.type,
                  cacheControl: 'public, max-age=31536000',
                },
                customMetadata: {
                  userId,
                  originalName: file.name,
                  uploadedAt: new Date().toISOString(),
                },
              })
              
              if (!uploadResult) {
                throw new Error('R2 put() returned null or undefined')
              }
              
              console.log(`[Blog] Workers binding upload completed for: ${filename}, key: ${uploadResult.key}, size: ${uploadResult.size} bytes`)
              
              // Verify file was uploaded
              let headResult: R2Object | null = null
              let verificationAttempts = 0
              const maxVerificationAttempts = 3
              
              while (verificationAttempts < maxVerificationAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100 * (verificationAttempts + 1)))
                
                try {
                  headResult = await env.blog_media.head(filename)
                  if (headResult) {
                    break
                  }
                } catch (headError: any) {
                  console.warn(`[Blog] Verification attempt ${verificationAttempts + 1} failed:`, headError.message)
                }
                
                verificationAttempts++
              }
              
              if (!headResult) {
                throw new Error(`File verification failed after ${maxVerificationAttempts} attempts: head() returned null`)
              }
              
              if (headResult.size !== fileBuffer.byteLength) {
                throw new Error(`File size mismatch: expected ${fileBuffer.byteLength} bytes, got ${headResult.size} bytes`)
              }
              
              uploadedSize = headResult.size
              console.log(`[Blog] File verified via Workers binding: ${filename}, size: ${uploadedSize} bytes, contentType: ${headResult.httpMetadata?.contentType}`)
            } catch (uploadError: any) {
              console.error(`[Blog] Workers binding upload failed for ${filename}:`, uploadError)
              console.error(`[Blog] Upload error details:`, {
                message: uploadError.message,
                stack: uploadError.stack,
                name: uploadError.name,
              })
              throw new Error(`Failed to upload file to R2 via Workers binding: ${uploadError.message || 'Unknown error'}`)
            }
          }

          // Generate public URL
          // R2 public URL options:
          // 1. Custom domain (recommended): Set R2_PUBLIC_URL env var
          // 2. R2 public URL (pub-*.r2.dev): Requires public access enabled
          // 3. S3 API endpoint: https://{account-id}.r2.cloudflarestorage.com/{bucket}/{filename}
          // 
          // With S3 API mode, files are always uploaded to real R2 (not local simulation)
          // For production, configure a custom domain in R2 settings and set R2_PUBLIC_URL
          
          let publicUrl: string
          if (env.R2_PUBLIC_URL) {
            // Use custom domain or configured URL (recommended)
            publicUrl = `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${filename}`
            console.log(`[Blog] Using configured R2_PUBLIC_URL: ${publicUrl}`)
          } else {
            // Fallback: Use Public Development URL format (requires public access enabled)
            // Format: https://pub-{account-id}.r2.dev/{filename}
            // Extract account ID from R2_ENDPOINT_URL if available
            let accountId = 'e92b5aac543d4f37970ad252aac3c3b7' // Default fallback
            if (env.R2_ENDPOINT_URL) {
              const match = env.R2_ENDPOINT_URL.match(/https:\/\/([^.]+)\.r2\.cloudflarestorage\.com/)
              if (match && match[1]) {
                accountId = match[1]
              }
            }
            publicUrl = `https://pub-${accountId}.r2.dev/${filename}`
            console.warn(`[Blog] R2_PUBLIC_URL not set, using fallback Public Development URL: ${publicUrl}`)
            console.warn(`[Blog] Please set R2_PUBLIC_URL in .dev.vars or as a secret for production use`)
          }
          
          // For video, we might want to generate a thumbnail later
          // For now, return the URL
          const mediaInfo = {
            url: publicUrl,
            type: fileType as 'image' | 'video',
            filename,
            size: file.size,
            contentType: file.type,
          }

          return new Response(JSON.stringify(mediaInfo), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        } catch (error: any) {
          console.error('[Blog API] Upload error:', error)
          return new Response(JSON.stringify({
            error: 'Upload failed',
            detail: error.message
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }
      }

      // DELETE /posts/:id - Delete post
      if (postIdMatch && method === 'DELETE') {
        const postId = postIdMatch[1]
        const userId = extractUserIdFromRequest(request)

        if (!userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        // Check if post exists and belongs to user
        const { data: existingPost, error: checkError } = await supabase
          .from('blog_posts')
          .select('user_id')
          .eq('id', postId)
          .single()

        if (checkError || !existingPost) {
          return new Response(JSON.stringify({ error: 'Post not found' }), {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        if (existingPost.user_id !== userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          })
        }

        const { error } = await supabase
          .from('blog_posts')
          .delete()
          .eq('id', postId)

        if (error) {
          throw error
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        })
      }

      // 404 for unknown paths
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })

    } catch (error: any) {
      console.error('[Blog API] Error:', error)
      return new Response(JSON.stringify({
        error: 'Internal server error',
        detail: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      })
    }
  },
}
