# Fashion Rec Blog Service

Cloudflare Worker for blog API functionality.

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create a `.dev.vars` file in the root directory with all required configuration (see R2 Storage Setup section for complete list).

**For production deployment, use the automated script:**

```powershell
# Windows PowerShell - Batch set all secrets from .dev.vars
.\set-secrets.ps1
```

Or set secrets manually using `wrangler secret put` (see R2 Storage Setup section for details).

### 3. Setup Supabase Database

Execute the SQL script in `supabase_setup.sql` in Supabase Dashboard → SQL Editor.

### 4. Local Development

**R2 Storage Configuration**

The service supports two methods for R2 access:

#### Method 1: S3 API (Recommended for Development)

Configure R2 S3 API credentials in `.dev.vars`:

```env
R2_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=blog-media
R2_PUBLIC_URL=https://r2blog.fashion-rec.com
```

**Advantages:**
- ✅ Always connects to real R2 (no local simulation)
- ✅ Works in both `wrangler dev` and production
- ✅ Consistent behavior across environments

**Get R2 API credentials:**
1. Go to Cloudflare Dashboard → R2
2. Click "Manage R2 API Tokens"
3. Create a new API token with read/write permissions
4. Copy the credentials to `.dev.vars`

#### Method 2: Workers Binding (Fallback)

If S3 API credentials are not configured, the service falls back to Workers R2 binding:

```bash
# Use remote R2 (requires --remote flag)
pnpm exec wrangler dev --remote --port 8787

# Local simulation (files won't be accessible via URLs)
pnpm dev
```

**When to use:**
- Use S3 API method (Method 1) for consistent development experience
- Use Workers binding only if you prefer not to manage R2 credentials

The worker will run on `http://127.0.0.1:8787` (or `8788` if using default port).

### 5. Deploy

```bash
pnpm deploy
```

## API Endpoints

### GET /posts
Get list of blog posts.

Query parameters:
- `limit` (optional, default: 20) - Number of posts to return
- `offset` (optional, default: 0) - Offset for pagination
- `status` (optional, default: 'published') - Filter by status ('published' or 'draft')

### GET /posts/:id
Get a single blog post by ID.

### POST /posts
Create a new blog post (requires authentication).

Request body:
```json
{
  "title": "Post Title",
  "content": "Markdown content",
  "tags": ["tag1", "tag2"],
  "status": "draft" // or "published"
}
```

### PUT /posts/:id
Update an existing blog post (requires authentication, only own posts).

Request body (all fields optional):
```json
{
  "title": "Updated Title",
  "content": "Updated content",
  "tags": ["tag1", "tag2"],
  "status": "published"
}
```

### DELETE /posts/:id
Delete a blog post (requires authentication, only own posts).

### POST /media/upload
Upload an image or video file (requires authentication).

Request: `multipart/form-data`
- `file`: The image or video file to upload
- `type`: Optional, 'image' or 'video' (auto-detected from file type if not provided)

Response:
```json
{
  "url": "https://...",
  "type": "image" | "video",
  "filename": "...",
  "size": 12345,
  "contentType": "image/jpeg"
}
```

File size:
- No hard limits, but consider performance and storage costs
- Cloudflare R2 and Workers have practical limits for very large files

## R2 Storage Setup

The service uses Cloudflare R2 to store media files. See `R2_SETUP.md` for detailed configuration instructions.

### Quick Setup (S3 API Method - Recommended)

1. **Create R2 bucket:**
   ```bash
   wrangler r2 bucket create blog-media
   ```

2. **Get R2 API credentials:**
   - Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens
   - Create a new API token with read/write permissions
   - Copy the credentials

3. **Configure in `.dev.vars`:**
   ```env
   R2_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
   R2_ACCESS_KEY_ID=your-access-key-id
   R2_SECRET_ACCESS_KEY=your-secret-access-key
   R2_BUCKET_NAME=blog-media
   R2_PUBLIC_URL=https://r2blog.fashion-rec.com
   ```

4. **For production, set as secrets:**

   **Option A: Use the automated script (Recommended)**
   ```powershell
   # Windows PowerShell
   .\set-secrets.ps1
   ```
   
   This script will:
   - Read all configuration from `.dev.vars`
   - Batch set all secrets to production environment
   - Validate required values before setting
   
   **Option B: Set secrets manually**
   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   wrangler secret put R2_ENDPOINT_URL
   wrangler secret put R2_ACCESS_KEY_ID
   wrangler secret put R2_SECRET_ACCESS_KEY
   wrangler secret put R2_BUCKET_NAME
   wrangler secret put R2_PUBLIC_URL
   ```

### Alternative: Workers Binding Method

If you prefer not to use S3 API:
1. Configure R2 bucket binding in `wrangler.toml` (already configured)
2. Use `wrangler dev --remote` for development
3. Set `R2_PUBLIC_URL` environment variable for public access

## Authentication

The service extracts user ID from:
1. Authorization header: `Authorization: Bearer <token>`
2. Cookie: `sb-<project-ref>-auth-token=<token>`

The JWT token is parsed to extract the user ID (sub claim).

## CORS

The service handles CORS automatically for all requests. It accepts the `Origin` header and includes appropriate CORS headers in responses.
