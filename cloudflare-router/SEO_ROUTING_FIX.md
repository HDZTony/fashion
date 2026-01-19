# SEO API 路由修复说明

## 问题

前端请求 `/seo/search-console/status` 时出现 CORS 错误：
```
Access to XMLHttpRequest at 'http://127.0.0.1:8787/seo/search-console/status' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

## 原因

Cloudflare Router 没有将 `/seo/*` 路径识别为 API 请求，导致：
1. 请求没有被路由到 Python 后端
2. CORS preflight (OPTIONS) 请求没有被正确处理

## 修复内容

已在 `cloudflare-router/src/index.ts` 中修复：

### 1. 添加 `/seo` 到 API 路径列表

在 `isApiRequest` 函数中添加：
```typescript
path.startsWith('/seo') ||
```

### 2. 添加 SEO 路径到 CORS preflight 处理

在 OPTIONS 请求处理中添加：
```typescript
const isSeoServicePath = path.startsWith('/seo')

if (request.method === 'OPTIONS' && (isApiForCors || 
    // ... 其他路径
    isSeoServicePath)) {
  // 处理 CORS preflight
}
```

## 应用修复

### 本地开发

1. **重启 Cloudflare Router**：
   ```bash
   cd cloudflare-router
   # 停止当前的 wrangler dev（Ctrl+C）
   # 重新启动
   pnpm dev
   ```

2. **验证修复**：
   - 前端应该能正常调用 `/seo/*` API
   - 不再出现 CORS 错误

### 生产环境

1. **部署 Cloudflare Router**：
   ```bash
   cd cloudflare-router
   pnpm deploy
   ```

## 验证

修复后，以下 API 端点应该正常工作：

- `GET /seo/search-console/status`
- `GET /seo/search-console/connect`
- `GET /seo/search-console/callback`
- `POST /seo/search-console/disconnect`
- `POST /seo/verify-site`
- `POST /seo/submit-sitemap`
- `POST /seo/inspect-url`
- `GET /seo/analytics`

## 测试

1. 打开浏览器开发者工具
2. 访问 Profile 页面的 SEO tab
3. 检查 Network 标签：
   - 请求应该发送到 `http://127.0.0.1:8787/seo/search-console/status`
   - 响应状态应该是 200（如果已连接）或 401（如果未连接）
   - 不应该有 CORS 错误

## 如果仍有问题

1. **检查后端是否运行**：
   ```bash
   # 检查 Python 后端是否在运行
   curl http://localhost:8000/health
   ```

2. **检查 Router 日志**：
   ```bash
   cd cloudflare-router
   pnpm dev
   # 查看控制台输出，应该看到：
   # [Router] Request GET /seo/search-console/status - isApiRequest: true
   # [Router] Routing API request GET /seo/search-console/status to backend: ...
   ```

3. **检查后端日志**：
   - 应该看到 SEO API 请求的日志

4. **验证环境变量**：
   - 确保 `STABLE_BACKEND_URL` 和 `V2_BACKEND_URL` 已正确配置
   - 在 `.dev.vars` 中检查
