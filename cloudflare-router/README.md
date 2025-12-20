# Cloudflare Router Worker

Cloudflare Worker for routing users to different frontend versions based on their user configuration in Supabase. This enables zero-code-change canary deployments and blue-green deployments.

## Architecture

```
User Request (yourdomain.com)
    ↓
Cloudflare Worker (Router)
    ↓
Extract User ID from Cookie → Query Supabase Database
    ↓
    ├─→ Frontend Request → 
    │   ├─→ stable → fashion-rec-frontend.pages.dev
    │   └─→ v2 → v2--fashion-rec-frontend.pages.dev
    └─→ API Request (/api/*) →
        ├─→ stable → fashion-rec-backend.fly.dev
        └─→ v2 → fashion-rec-backend-v2.fly.dev
```

## Features

- **Zero Code Changes**: No modifications needed to frontend or backend code (except deploying different versions)
- **Full Stack Routing**: Routes both frontend pages and backend API requests
- **Database-Driven**: User version assignment stored in Supabase
- **Automatic Fallback**: Routes to stable version on any error
- **Fast Routing**: Edge computing for minimal latency
- **Complete Isolation**: Frontend and backend versions are completely isolated

## Prerequisites

1. Supabase project with `user_frontend_versions` table
2. Cloudflare account with Workers enabled
3. Two Cloudflare Pages deployments (stable and v2)

## Setup

### 1. Create Database Table

Execute the SQL migration script in Supabase SQL Editor:

```bash
# See: cloudflare-router/migrations/create_user_frontend_versions.sql
```

Or manually run:

```sql
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

CREATE POLICY "Users can update their own version"
ON user_frontend_versions FOR ALL
USING (auth.uid() = user_id);
```

### 2. Configure Environment Variables

Set the following secrets in Cloudflare Dashboard or via CLI:

```bash
# Via Wrangler CLI (using pnpm)
# The command will prompt you to enter the secret value interactively
pnpm exec wrangler secret put SUPABASE_URL
pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
pnpm exec wrangler secret put STABLE_FRONTEND_HOST
pnpm exec wrangler secret put V2_FRONTEND_HOST
pnpm exec wrangler secret put STABLE_BACKEND_URL
pnpm exec wrangler secret put V2_BACKEND_URL

# Alternative: Using pnpmx (shorter syntax)
pnpmx wrangler secret put SUPABASE_URL

# Non-interactive: Pipe the value directly
echo "your-secret-value" | pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Required secrets:
- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://xxxxx.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key (found in Supabase Dashboard → Settings → API)
- `STABLE_FRONTEND_HOST`: Stable version frontend hostname (e.g., `fashion-rec-frontend.pages.dev`)
- `V2_FRONTEND_HOST`: V2 version frontend hostname (e.g., `v2--fashion-rec-frontend.pages.dev`)
- `STABLE_BACKEND_URL`: Stable version backend URL (e.g., `https://fashion-rec-backend.fly.dev`)
- `V2_BACKEND_URL`: V2 version backend URL (e.g., `https://fashion-rec-backend-v2.fly.dev`)

### 3. Deploy Worker

#### Via GitHub Actions (Recommended)

The worker will automatically deploy when changes are pushed to `cloudflare-router/` directory.

#### Manual Deployment

```bash
cd cloudflare-router
pnpm install
pnpm deploy
```

### 4. Configure Routes

In Cloudflare Dashboard:
1. Go to Workers & Pages → `fashion-rec-router`
2. Navigate to Settings → Triggers → Routes
3. Add route: `yourdomain.com/*`
4. Save

## Managing User Versions

### Method 1: Supabase Dashboard

1. Login to Supabase Dashboard
2. Navigate to Table Editor → `user_frontend_versions`
3. Click "Insert row"
4. Fill in:
   - `user_id`: User's UUID
   - `version`: `v2` (or `stable`)
   - `notes`: Optional description

### Method 2: SQL

```sql
-- Set single user to V2
INSERT INTO user_frontend_versions (user_id, version, notes)
VALUES ('<user-uuid>', 'v2', 'Test user')
ON CONFLICT (user_id) 
DO UPDATE SET version = 'v2', updated_at = NOW();

-- Set multiple users to V2
INSERT INTO user_frontend_versions (user_id, version)
VALUES 
  ('user-id-1', 'v2'),
  ('user-id-2', 'v2')
ON CONFLICT (user_id) 
DO UPDATE SET version = 'v2', updated_at = NOW();

-- Revert user to stable
UPDATE user_frontend_versions 
SET version = 'stable', updated_at = NOW()
WHERE user_id = '<user-uuid>';

-- Remove user from custom version (will default to stable)
DELETE FROM user_frontend_versions WHERE user_id = '<user-uuid>';
```

### Method 3: Bulk Operations

```sql
-- Set all users with specific criteria to V2
-- Example: Users registered after a certain date
INSERT INTO user_frontend_versions (user_id, version)
SELECT id, 'v2'
FROM auth.users
WHERE created_at > '2024-01-01'
ON CONFLICT (user_id) 
DO UPDATE SET version = 'v2', updated_at = NOW();
```

## How It Works

1. **User Request**: User visits `yourdomain.com` or makes API request to `/api/*`
2. **Cookie Extraction**: Worker extracts user ID from Supabase session cookie
3. **Database Query**: Worker queries `user_frontend_versions` table using Service Role Key
4. **Request Type Detection**: 
   - If path starts with `/api/` or other API patterns → Route to backend
   - Otherwise → Route to frontend
5. **Routing**: Based on version, request is forwarded to appropriate deployment (frontend or backend)
6. **Fallback**: If user not found or error occurs, routes to stable version

## Testing

### Test V2 Routing

1. Set a test user to V2 version in Supabase
2. Login as that user
3. Visit your domain
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

3. **Check Worker Logs**: View logs in Cloudflare Dashboard
   - Workers & Pages → `fashion-rec-router` → Logs

4. **Verify Secrets**: Ensure all environment variables are set correctly
   ```bash
   wrangler secret list
   ```

### Worker Errors

1. **Supabase Connection**: Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
2. **Hostname Issues**: Verify `STABLE_FRONTEND_HOST` and `V2_FRONTEND_HOST` are correct
3. **RLS Policies**: Ensure Service Role Key can bypass RLS (it should by default)

### Performance Issues

- Worker queries Supabase on every request
- Consider caching user versions in Worker KV (future enhancement)
- Current implementation prioritizes real-time updates over performance

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
   V2_FRONTEND_HOST=v2--fashion-rec-frontend.pages.dev
   ```

2. Run `pnpm dev` and test with local requests

## Deployment Workflow

1. **Deploy Stable Frontend**: Push to `main` branch → Auto-deploys to stable
2. **Deploy V2 Frontend**: Push to `v2` branch → Auto-deploys to V2 preview
3. **Set Test Users**: Add users to `user_frontend_versions` table in Supabase
4. **Test**: Verify routing works correctly
5. **Gradual Rollout**: Add more users to V2 as needed
6. **Full Rollout**: Set all users to V2 or remove version assignments
7. **Rollback**: Delete V2 assignments or set users back to stable

## Security Considerations

- Service Role Key has full database access - keep it secret
- RLS policies still apply for user-initiated queries
- Worker only reads version data, doesn't modify user data
- All routing decisions are logged for audit purposes

## Future Enhancements

- [ ] Add KV caching for user versions
- [ ] Support percentage-based rollout
- [ ] Add admin API for version management
- [ ] Support multiple versions (v3, v4, etc.)
- [ ] Add analytics and monitoring

## License

MIT

