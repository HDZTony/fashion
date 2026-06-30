# Quick Start Guide

## 快速开始

### 1. 创建数据库表

在 Supabase Dashboard → SQL Editor 中执行：

```sql
-- 复制 cloudflare-router/migrations/create_user_frontend_versions.sql 的内容
-- 或直接执行该文件中的 SQL
```

### 2. 配置环境变量

在 Cloudflare Dashboard 或使用 Wrangler CLI：

```bash
cd cloudflare-router
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put STABLE_FRONTEND_HOST
wrangler secret put V2_FRONTEND_HOST
wrangler secret put STABLE_BACKEND_URL
wrangler secret put V2_BACKEND_URL
```

### 3. 部署 Worker

#### 方式1：通过 GitHub Actions（推荐）

推送代码到仓库，GitHub Actions 会自动部署。

#### 方式2：手动部署

```bash
cd cloudflare-router
pnpm install
pnpm deploy
```

### 4. 配置路由

在 Cloudflare Dashboard：
1. Workers & Pages → `fashion-rec-router`
2. Settings → Triggers → Routes
3. 添加：`yourdomain.com/*`

### 5. 设置测试用户

在 Supabase Dashboard → Table Editor → `user_frontend_versions`：

```sql
INSERT INTO user_frontend_versions (user_id, version, notes)
VALUES ('<user-uuid>', 'v2', '测试用户')
ON CONFLICT (user_id) 
DO UPDATE SET version = 'v2', updated_at = NOW();
```

### 6. 测试

1. 使用测试用户登录
2. 访问你的域名
3. 应该被路由到 V2 版本

## 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `SUPABASE_URL` | Supabase 项目 URL | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key | 在 Supabase Dashboard → Settings → API 获取 |
| `STABLE_FRONTEND_HOST` | 稳定版前端域名 | `fashion-rec-frontend.pages.dev` |
| `V2_FRONTEND_HOST` | V2 版本前端域名 | `v2--fashion-rec-frontend.pages.dev` |
| `STABLE_BACKEND_URL` | 稳定版后端 URL | `https://fashion-rec-backend.fly.dev` |
| `V2_BACKEND_URL` | V2 版本后端 URL（v2 Fly 未部署时与 stable 相同） | `https://fashion-rec-backend.fly.dev` |

## 常见问题

### 如何获取用户 UUID？

1. 在 Supabase Dashboard → Authentication → Users
2. 找到用户，复制 UUID

### 如何回滚用户到稳定版？

```sql
UPDATE user_frontend_versions 
SET version = 'stable', updated_at = NOW()
WHERE user_id = '<user-uuid>';
```

或删除记录：

```sql
DELETE FROM user_frontend_versions WHERE user_id = '<user-uuid>';
```

### Worker 不工作？

1. 检查环境变量是否正确设置
2. 查看 Cloudflare Dashboard → Workers → Logs
3. 确认路由规则已配置

## 下一步

查看 [README.md](README.md) 获取完整文档。

