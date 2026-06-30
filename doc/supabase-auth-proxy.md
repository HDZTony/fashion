# Supabase Auth 代理与国内可达配置

浏览器不再直连 `*.supabase.co`，改经 Cloudflare Router 同域代理。

## Router 代理

| 路径 | 行为 |
|------|------|
| `/supabase/auth/v1/*` | 透明转发到 `SUPABASE_URL` 对应 Auth API |
| `/supabase/auth/v1/admin/*` | **403 禁止**（客户端不可访问 Admin API） |
| `/api/auth/google-native` | Google 登录桥接（已有） |

客户端配置：

```env
VITE_SUPABASE_URL=https://fashion-rec.com/supabase
VITE_GOOGLE_CLIENT_ID=your-web-oauth-client-id.apps.googleusercontent.com
```

本地开发（Router `wrangler dev` 默认 `:8787`）：

```env
VITE_SUPABASE_URL=http://127.0.0.1:8787/supabase
VITE_API_URL=http://127.0.0.1:8787
```

## Supabase Dashboard 手动配置

在 [Supabase 项目控制台](https://supabase.com/dashboard) 完成以下步骤。

### 1. Authentication → URL Configuration

- **Site URL**：`https://fashion-rec.com`
- **Redirect URLs**（保留现有并确认包含）：
  - `https://fashion-rec.com/callback`
  - `http://localhost:5173/callback`
  - `http://localhost:5174/**`（uniapp H5）

### 2. Authentication → Email Templates

将邮件内验证/重置链接改为经 Router 代理，避免用户点击邮件时直连 `*.supabase.co`。

**Confirm signup（注册确认）** — 将 `{{ .ConfirmationURL }}` 替换为：

```html
<a href="https://fashion-rec.com/supabase/auth/v1/verify?token={{ .TokenHash }}&type=signup&redirect_to={{ .RedirectTo }}">Confirm your email</a>
```

**Reset password（密码重置）** — 同样模式，`type=recovery`：

```html
<a href="https://fashion-rec.com/supabase/auth/v1/verify?token={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}">Reset password</a>
```

保存后发送测试邮件，确认链接 host 为 `fashion-rec.com` 而非 `supabase.co`。

### 3. Authentication → Providers → Google

- 保持 Supabase 内配置的 Client ID / Secret
- Web 端 GIS 使用 **OAuth Web Client ID**（与 `VITE_GOOGLE_CLIENT_ID` 一致）
- 在 [Google Cloud Console](https://console.cloud.google.com/) 的 OAuth 客户端中，Authorized JavaScript origins 需包含：
  - `https://fashion-rec.com`
  - `http://localhost:5173`
  - `http://localhost:5174`

## 部署顺序

1. 部署 `cloudflare-router`（含 `/supabase` 代理）
2. 部署前端 / uniapp（`VITE_SUPABASE_URL=https://fashion-rec.com/supabase`）
3. 更新 Supabase 邮件模板与 Redirect URLs
4. 验证：DevTools Network 中无浏览器直连 `*.supabase.co` 的 Auth 请求

## GitHub Actions Variables

在仓库 Settings → Variables 中设置：

| Variable | 值 |
|----------|-----|
| `VITE_SUPABASE_URL` | `https://fashion-rec.com/supabase` |
| `VITE_GOOGLE_CLIENT_ID` | Web OAuth Client ID |

`VITE_SUPABASE_KEY` 保持 anon key 不变。
