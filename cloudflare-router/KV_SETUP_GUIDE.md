# Cloudflare KV 缓存设置指南

## 概述

Worker 已实现 KV 缓存和懒路由优化：
- ✅ 使用 Cloudflare KV 缓存用户版本（30 天 TTL）
- ✅ 懒路由：只有访问 `/studio` 时才确定版本
- ✅ 其他页面默认使用 stable 版本，不查询数据库
- ✅ 前端在点击 "Enter Studio" 时自动设置版本

## 设置步骤

### 步骤 1: 创建 KV Namespace

```bash
cd cloudflare-router
pnpm exec wrangler kv namespace create USER_VERSIONS
```

**注意**：新版本 Wrangler 使用 `kv namespace create`（空格），不是 `kv:namespace create`（冒号）

**输出示例**：
```
🌀  Creating namespace with title "fashion-rec-router-USER_VERSIONS"
✨  Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "USER_VERSIONS", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

### 步骤 2: 更新 wrangler.toml

将 KV namespace ID 添加到 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "USER_VERSIONS"
id = "your-kv-namespace-id-from-step-1"
```

### 步骤 3: 部署 Worker

```bash
cd cloudflare-router
pnpm exec wrangler deploy
```

### 步骤 4: 验证

1. **测试设置版本 API**：
   ```bash
   curl -X POST https://fashion.hdz73.com/api/router/set-version \
     -H "Content-Type: application/json" \
     -H "Cookie: sb-xxx-auth-token=your-token" \
     -d '{"version": "v2"}'
   ```

2. **检查 Worker 日志**：
   - Cloudflare Dashboard → Workers & Pages → fashion-rec-router → Logs
   - 查看是否有缓存命中的日志

## 工作原理

### 懒路由流程

```
1. 用户访问首页 (/)
   ↓
2. Worker 检查路径 → 不是 /studio
   ↓
3. 直接路由到 stable 版本（不查询数据库）
   ↓
4. 用户点击 "Enter Studio"
   ↓
5. 前端调用 /api/router/set-version 设置版本
   ↓
6. Worker 更新数据库和 KV 缓存
   ↓
7. 前端跳转到 /studio
   ↓
8. Worker 检查路径 → 是 /studio
   ↓
9. Worker 从 KV 缓存读取版本（<1ms）
   ↓
10. 路由到对应版本的前端
```

### 缓存策略

- **TTL**: 30 天（2,592,000 秒）
- **缓存键**: `user_id` (UUID)
- **缓存值**: `'stable'` 或 `'v2'`

### 性能提升

**优化前**：
- 每个请求都查询数据库：~10-50ms
- 1000 请求/秒 → 1000 次数据库查询/秒

**优化后**：
- 首次设置版本：~10-50ms（查询数据库 + 写入 KV）
- 后续请求：<1ms（从 KV 读取）
- 数据库查询减少：~99%+

## API 端点

### POST /api/router/set-version

设置用户版本（由前端在点击 "Enter Studio" 时调用）

**请求**：
```json
{
  "version": "v2"  // 或 "stable"
}
```

**响应**：
```json
{
  "success": true,
  "version": "v2"
}
```

**错误响应**：
```json
{
  "error": "Unauthorized"  // 401 - 未登录
}
```

```json
{
  "error": "Invalid version"  // 400 - 版本无效
}
```

## 前端集成

前端 `Home.vue` 已更新，在用户点击 "Enter Studio" 时自动设置版本：

```typescript
const handleGetStarted = async () => {
  if (isAuthenticated.value) {
    // 设置用户版本为 v2（懒路由）
    await setUserVersion('v2')
    router.push('/studio')
  } else {
    router.push('/login')
  }
}
```

## 版本选择策略

当前实现：
- 默认设置为 `'v2'`（新用户使用 V2 版本）
- 如需修改，编辑 `Home.vue` 中的 `setUserVersion('v2')`

**可选策略**：
1. **固定版本**：所有用户都设置为 `'v2'`
2. **随机分配**：50% 用户 v2，50% 用户 stable
3. **基于用户 ID 哈希**：确保同一用户始终使用相同版本

## 缓存失效

### 手动清除缓存

如果需要清除某个用户的缓存：

```bash
# 通过 Wrangler CLI（如果已在 wrangler.toml 中配置 binding）
cd cloudflare-router
pnpm exec wrangler kv key delete "user-uuid-here"

# 或者指定 namespace ID
pnpm exec wrangler kv key delete "user-uuid-here" --namespace-id="e335d5ff4f4948718434187ca14f94b7"
```

**注意**：新版本 Wrangler 使用 `kv key`（空格），不是 `kv:key`（冒号）

### 自动失效

- **TTL 过期**：30 天后自动失效，会重新查询数据库
- **版本更新**：调用 `/api/router/set-version` 时会自动更新缓存

## 监控和调试

### 查看缓存命中率

在 Worker 日志中搜索：
- `Cache hit for user` - 缓存命中
- `Cache miss for user` - 缓存未命中

### 查看 KV 数据

```bash
# 列出所有键（最多 1000 个）
cd cloudflare-router
pnpm exec wrangler kv key list

# 或者指定 namespace ID
pnpm exec wrangler kv key list --namespace-id="e335d5ff4f4948718434187ca14f94b7"

# 读取特定键
pnpm exec wrangler kv key get "user-uuid"

# 或者指定 namespace ID
pnpm exec wrangler kv key get "user-uuid" --namespace-id="e335d5ff4f4948718434187ca14f94b7"
```

**注意**：新版本 Wrangler 使用 `kv key`（空格），不是 `kv:key`（冒号）。如果已在 `wrangler.toml` 中配置了 `binding`，可以省略 `--namespace-id` 参数。

## 故障排查

### 问题 1: KV namespace 未找到

**错误**：`TypeError: env.USER_VERSIONS is undefined`

**解决**：
1. 确认 `wrangler.toml` 中已添加 KV namespace 配置
2. 确认 namespace ID 正确
3. 重新部署 Worker

### 问题 2: 缓存未生效

**检查**：
1. 确认 KV namespace 已创建
2. 查看 Worker 日志确认是否有缓存操作
3. 检查 KV namespace ID 是否正确

### 问题 3: 版本设置失败

**检查**：
1. 确认用户已登录（有 Cookie）
2. 查看 Worker 日志确认 API 调用
3. 检查 Supabase 数据库连接

## 成本分析

### Cloudflare KV

- **免费 tier**：100,000 次读取/天，1,000 次写入/天
- **付费 tier**：$0.50/百万次读取，$5.00/百万次写入

### 估算

假设 1000 用户，每天访问 10 次：
- 读取：1000 × 10 = 10,000 次/天（在免费 tier 内）
- 写入：1000 次/天（在免费 tier 内）

**成本**：$0/月（免费 tier 足够）

## 相关文档

- [Cloudflare KV 文档](https://developers.cloudflare.com/kv/)
- [Worker 性能优化](./PERFORMANCE_ANALYSIS.md)
- [路由流程](./ROUTING_FLOW.md)

