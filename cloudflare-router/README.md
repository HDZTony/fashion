# Cloudflare Router Worker

Cloudflare Worker for routing users to different frontend and backend versions based on their configuration in Supabase. This enables zero-code-change canary deployments and blue-green deployments with KV caching for optimal performance.

## Architecture

```
用户请求 (fashion-rec.com 或 fashion.hdz73.com)
    ↓
    ├─→ fashion.hdz73.com → 301 Redirect → fashion-rec.com
    └─→ fashion-rec.com →
        ↓
        Cloudflare Worker (fashion-rec-router)
        ↓
        从 Cookie 提取用户ID → 查询 KV 缓存或 Supabase
        ↓
        ├─→ 前端页面请求 → 
        │   ├─→ stable → fashion-rec-frontend.pages.dev
        │   └─→ v2 → v2.fashion-rec-frontend.pages.dev
        └─→ API 请求 (/api/*, /items, /outfit, etc.) →
            ├─→ stable → fashion-rec-backend.fly.dev
            └─→ v2 → fashion-rec-backend-v2.fly.dev
```

## Features

- **Zero Code Changes**: No modifications needed to frontend or backend code (except deploying different versions)
- **Full Stack Routing**: Routes both frontend pages and backend API requests
- **KV Caching**: User versions cached in Cloudflare KV for 30 days, reducing database queries by 99%+
- **Lazy Routing**: Version determined when user enters Studio, then used for all pages
- **Automatic Fallback**: Routes to stable version on any error
- **Fast Routing**: Edge computing with KV cache for minimal latency (<1ms cache hits)
- **Complete Isolation**: Frontend and backend versions are completely isolated

## Prerequisites

1. Supabase project with `user_frontend_versions` table
2. Cloudflare account with Workers and KV enabled
3. Two Cloudflare Pages deployments (stable and v2)
4. DNS records for custom domains (e.g., `fashion-rec.com` and `fashion.hdz73.com` for redirect)

## Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.

### 1. Create Database Table

Execute the SQL migration script in Supabase SQL Editor:

```sql
-- See: cloudflare-router/migrations/create_user_frontend_versions.sql
CREATE TABLE IF NOT EXISTS user_frontend_versions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT 'stable' CHECK (version IN ('stable', 'v2')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_frontend_versions_user_id 
ON user_frontend_versions(user_id);

ALTER TABLE user_frontend_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can read all versions"
ON user_frontend_versions FOR SELECT
USING (true);
```

### 2. Configure Environment Variables

Set the following secrets in Cloudflare Dashboard or via CLI:

```bash
cd cloudflare-router
pnpm exec wrangler secret put SUPABASE_URL
pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
pnpm exec wrangler secret put STABLE_FRONTEND_HOST
pnpm exec wrangler secret put V2_FRONTEND_HOST
pnpm exec wrangler secret put STABLE_BACKEND_URL
pnpm exec wrangler secret put V2_BACKEND_URL
```

**Required secrets:**
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key
- `STABLE_FRONTEND_HOST`: Stable version frontend hostname (e.g., `fashion-rec-frontend.pages.dev`)
- `V2_FRONTEND_HOST`: V2 version frontend hostname (e.g., `v2.fashion-rec-frontend.pages.dev`)
- `STABLE_BACKEND_URL`: Stable version backend URL (e.g., `https://fashion-rec-backend.fly.dev`)
- `V2_BACKEND_URL`: V2 version backend URL (e.g., `https://fashion-rec-backend-v2.fly.dev`)

### 3. Setup KV Namespace

```bash
cd cloudflare-router
pnpm exec wrangler kv namespace create USER_VERSIONS
```

Add the returned namespace ID to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "USER_VERSIONS"
id = "your-namespace-id"
```

See [KV_SETUP_GUIDE.md](./KV_SETUP_GUIDE.md) for detailed instructions.

### 4. Configure Routes

In Cloudflare Dashboard:
1. Go to Workers & Pages → `fashion-rec-router`
2. Navigate to Settings → Triggers → Routes
3. Add route: `fashion-rec.com/*` (must include `/*`) - new production domain
4. Keep route: `fashion.hdz73.com/*` (for 301 redirect to new domain)
5. Ensure DNS records exist with proxy enabled (orange cloud ☁️)

### 5. Deploy Worker

#### Via GitHub Actions (Recommended)

The worker will automatically deploy when changes are pushed to `cloudflare-router/` directory.

#### Manual Deployment

```bash
cd cloudflare-router
pnpm install
pnpm exec wrangler deploy
```

## Key URLs

- **Production Domain**: `fashion-rec.com` (points to Worker)
- **Legacy Domain**: `fashion.hdz73.com` (301 redirects to fashion-rec.com)
- **Stable Frontend**: `fashion-rec-frontend.pages.dev`
- **V2 Frontend**: `v2.fashion-rec-frontend.pages.dev`
- **Stable Backend**: `https://fashion-rec-backend.fly.dev`
- **V2 Backend**: `https://fashion-rec-backend-v2.fly.dev`

## How It Works

### Lazy Routing with KV Caching

1. **User Request**: User visits `fashion-rec.com` or makes API request (or `fashion.hdz73.com` which redirects to `fashion-rec.com`)
2. **Cookie Extraction**: Worker extracts user ID from Supabase session cookie
3. **Version Lookup**:
   - If authenticated: Check KV cache first, if miss query Supabase and cache
   - If not authenticated: Use default `stable` version
4. **Request Type Detection**: 
   - If path starts with `/api/` or other API patterns → Route to backend
   - Otherwise → Route to frontend
5. **Routing**: Based on version, request is forwarded to appropriate deployment
6. **Version Setting**: When user clicks "Enter Studio", frontend calls `/api/router/set-version` to set and cache version

### Performance Optimizations

- **KV Caching**: User versions cached for 30 days, reducing database queries by 99%+
- **Lazy Routing**: Version determined when entering Studio, then used for all pages
- **Cache Hits**: <1ms latency for cached versions vs ~15-55ms for database queries

## Managing User Versions

### Method 1: Automatic (Recommended)

Users automatically get a version when they click "Enter Studio" in the frontend. The version is set via API and cached in KV.

### Method 2: Supabase Dashboard

1. Login to Supabase Dashboard
2. Navigate to Table Editor → `user_frontend_versions`
3. Click "Insert row"
4. Fill in: `user_id`, `version` ('v2' or 'stable'), optional `notes`

### Method 3: SQL

```sql
-- Set single user to V2
INSERT INTO user_frontend_versions (user_id, version, notes)
VALUES ('<user-uuid>', 'v2', 'Test user')
ON CONFLICT (user_id) 
DO UPDATE SET version = 'v2', updated_at = NOW();

-- Revert user to stable
UPDATE user_frontend_versions 
SET version = 'stable', updated_at = NOW()
WHERE user_id = '<user-uuid>';

-- Or delete record (will default to stable)
DELETE FROM user_frontend_versions WHERE user_id = '<user-uuid>';
```

### Method 4: API Endpoint

```bash
POST /api/router/set-version
Content-Type: application/json
Cookie: sb-xxx-auth-token=...

{
  "version": "v2"
}
```

## Deployment Workflow

### Stable Version (main branch)

1. Push code to `main` branch
2. Auto-deploys:
   - Frontend → `fashion-rec-frontend.pages.dev`
   - Backend → `fashion-rec-backend.fly.dev`

### V2 Version (v2 branch)

1. Push code to `v2` branch
2. Auto-deploys:
   - Frontend → `v2.fashion-rec-frontend.pages.dev` (preview deployment)
   - Backend → `fashion-rec-backend-v2.fly.dev`

### Worker

- Auto-deploys when `cloudflare-router/` directory changes
- Or manually trigger workflow

## Testing

### Test V2 Routing

1. Login as a user
2. Click "Enter Studio" (automatically sets version to v2)
3. Visit any page
4. Verify you're routed to V2 frontend

### Test Stable Routing

1. Ensure user is not in `user_frontend_versions` table (or set to `stable`)
2. Login as that user
3. Visit your domain
4. Verify you're routed to stable frontend

### Test Unauthenticated Users

1. Logout or use incognito mode
2. Visit your domain
3. Verify you're routed to stable frontend

## Troubleshooting

### Users Not Routing Correctly

1. **Check Cookie**: Verify Supabase session cookie is present
   - Cookie format: `sb-<project-ref>-auth-token=<jwt-token>`
   - Check browser DevTools → Application → Cookies

2. **Check Database**: Verify user exists in `user_frontend_versions` table
   ```sql
   SELECT * FROM user_frontend_versions WHERE user_id = '<user-uuid>';
   ```

3. **Check KV Cache**: View cached version
   ```bash
   cd cloudflare-router
   pnpm exec wrangler kv key get "<user-uuid>"
   ```

4. **Check Worker Logs**: View logs in Cloudflare Dashboard
   - Workers & Pages → `fashion-rec-router` → Logs

### ERR_CONNECTION_CLOSED Error

1. **Check DNS Record**: Ensure `fashion-rec.com` DNS record exists with proxy enabled (orange cloud)
2. **Check Route Format**: Route must be `fashion-rec.com/*` (with `/*`)
3. **Check SSL/TLS**: Mode should be "Full" or "Full (strict)"
4. **For old domain redirect**: Ensure `fashion.hdz73.com/*` route exists for 301 redirect

### Worker Errors

1. **Supabase Connection**: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
2. **Hostname Issues**: Verify `STABLE_FRONTEND_HOST` and `V2_FRONTEND_HOST` are correct
3. **KV Namespace**: Verify KV namespace is configured in `wrangler.toml`

### Performance Issues

- KV caching is enabled by default
- Check cache hit rate in Worker logs
- See [LAZY_ROUTING_OPTIMIZATION.md](./LAZY_ROUTING_OPTIMIZATION.md) for details

## Development

### Local Development

```bash
cd cloudflare-router
pnpm install
pnpm dev
```

### Testing Locally

1. Set up `.dev.vars` file (not committed):
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   STABLE_FRONTEND_HOST=fashion-rec-frontend.pages.dev
   V2_FRONTEND_HOST=v2.fashion-rec-frontend.pages.dev
   STABLE_BACKEND_URL=https://fashion-rec-backend.fly.dev
   V2_BACKEND_URL=https://fashion-rec-backend-v2.fly.dev
   ```

2. Run `pnpm dev` and test with local requests

## Configuration Files

- **Worker Code**: `cloudflare-router/src/index.ts`
- **Worker Config**: `cloudflare-router/wrangler.toml`
- **CI/CD**: `.github/workflows/deploy.yml`
- **Backend V2**: `fashion-rec/backend/fly.v2.toml`
- **Database Migration**: `cloudflare-router/migrations/create_user_frontend_versions.sql`

## Related Documentation

- [QUICKSTART.md](./QUICKSTART.md) - Quick start guide
- [KV_SETUP_GUIDE.md](./KV_SETUP_GUIDE.md) - KV namespace setup guide
- [LAZY_ROUTING_OPTIMIZATION.md](./LAZY_ROUTING_OPTIMIZATION.md) - Performance optimization details
- [API_URL_CONFIGURATION.md](./API_URL_CONFIGURATION.md) - API URL configuration guide

## Security Considerations

- Service Role Key has full database access - keep it secret
- RLS policies still apply for user-initiated queries
- Worker only reads/updates version data, doesn't modify other user data
- All routing decisions are logged for audit purposes

## License

MIT
