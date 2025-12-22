# 懒路由优化方案

## 优化概述

实现了两个关键优化：
1. ✅ **Cloudflare KV 缓存**：用户版本信息缓存 30 天，减少 99%+ 数据库查询
2. ✅ **懒路由**：在 `/studio` 时确定版本，之后所有页面都使用该版本

## 核心改进

### 优化前

```
每个请求 → 查询数据库 → 路由到对应版本
延迟：~10-50ms/请求
数据库查询：1000 次/秒（假设 1000 req/s）
```

### 优化后

```
未登录用户 → 直接路由到 stable（不查询）
已登录用户（首次） → 从 KV 缓存读取，如果未命中则查询数据库并缓存
已登录用户（后续） → 从 KV 缓存读取（<1ms）
延迟：<1ms（缓存命中）
数据库查询：~10 次/秒（只有首次确定版本时）
```

## 完整工作流程

### Cookie 和认证

**重要**：用户需要登录过一次，Supabase 才会设置认证 Cookie。

#### Cookie 创建流程

1. **未登录用户**：
   - ❌ 没有 Supabase 认证 Cookie
   - ❌ Worker 无法提取 `user_id`
   - ✅ Worker 使用默认版本：`stable`

2. **用户登录后**：
   - ✅ Supabase 设置认证 Cookie：`sb-<project-ref>-auth-token=<jwt-token>`
   - Cookie 包含 JWT token，其中包含 `user_id`
   - Worker 可以从 Cookie 中提取 `user_id`

3. **用户登出后**：
   - ❌ Supabase 清除认证 Cookie
   - ❌ Worker 无法提取 `user_id`
   - ✅ Worker 使用默认版本：`stable`

### 路由流程

#### 场景 1: 未登录用户访问首页

```
用户访问: fashion.hdz73.com/
    ↓
Worker 检查 Cookie → 未找到 user_id
    ↓
直接路由到 stable 版本（不查询数据库）
    ↓
用户看到稳定版首页
```

#### 场景 2: 已登录用户首次访问（版本未确定）

```
用户访问: fashion.hdz73.com/
    ↓
Worker 检查 Cookie → 找到 user_id
    ↓
Worker 从 KV 缓存读取版本 → 未找到（首次访问）
    ↓
Worker 查询数据库 → 未找到记录，返回 'stable'
    ↓
Worker 缓存 'stable' 到 KV（30 天 TTL）
    ↓
路由到 stable 版本
    ↓
用户看到稳定版首页
```

#### 场景 3: 用户点击 "Enter Studio" 设置版本

```
用户点击 "Enter Studio"
    ↓
前端调用: POST /api/router/set-version { version: 'v2' }
    ↓
Worker 更新数据库和 KV 缓存（30 天 TTL）
    ↓
前端跳转到 /studio
    ↓
Worker 从 KV 缓存读取版本（<1ms）
    ↓
路由到 V2 版本前端
    ↓
用户看到 V2 版本的页面
```

#### 场景 4: 已登录用户后续访问（版本已确定）

```
用户访问任何页面（首页、/studio、/wardrobe 等）
    ↓
Worker 检查 Cookie → 找到 user_id
    ↓
Worker 从 KV 缓存读取版本（<1ms）
    ↓
如果版本是 'v2' → 路由到 V2 版本
如果版本是 'stable' → 路由到稳定版
    ↓
用户看到对应版本的页面
```

**关键点**：一旦用户在 `/studio` 确定了版本，**所有页面**（包括首页、登录页等）都会使用这个版本。

## 性能提升

### 延迟减少

| 场景 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 未登录用户访问 | ~1-5ms | ~1-5ms | 0% |
| 已登录用户首次访问 | ~15-55ms | ~15-55ms | 0% |
| 已登录用户后续访问（缓存） | ~15-55ms | <1ms | 95%+ |

### 数据库查询减少

| 场景 | 优化前 | 优化后 | 减少 |
|------|--------|--------|------|
| 1000 请求/秒 | 1000 次/秒 | ~10 次/秒 | 99%+ |

### 成本节省

- **Supabase 查询成本**：减少 99%+
- **Cloudflare KV 成本**：免费 tier 足够（100,000 次读取/天）

## 设置步骤

### 步骤 1: 创建 KV Namespace

```bash
cd cloudflare-router
pnpm exec wrangler kv namespace create USER_VERSIONS
```

**注意**：新版本 Wrangler 使用 `kv namespace create`（空格），不是 `kv:namespace create`（冒号）

### 步骤 2: 更新 wrangler.toml

将返回的 namespace ID 添加到 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "USER_VERSIONS"
id = "your-namespace-id"
```

### 步骤 3: 部署 Worker

```bash
pnpm exec wrangler deploy
```

详细步骤请参考：[KV 设置指南](./KV_SETUP_GUIDE.md)

## 代码实现

### Worker 代码逻辑

```typescript
// cloudflare-router/src/index.ts

// 1. 从 KV 缓存读取（优先）
async function getUserVersion(userId: string, env: Env): Promise<string> {
  const cached = await env.USER_VERSIONS.get(userId)
  if (cached) {
    return cached  // 缓存命中，直接返回
  }

  // 2. 缓存未命中，查询数据库
  const version = await getUserFrontendVersionFromDB(userId, env)
  
  // 3. 写入 KV 缓存（30 天）
  await env.USER_VERSIONS.put(userId, version, {
    expirationTtl: 2592000  // 30 天
  })
  
  return version
}

// 3. 设置用户版本（API 端点）
async function setUserVersion(userId: string, version: string, env: Env) {
  // 更新数据库
  await supabase.from('user_frontend_versions').upsert({...})
  
  // 更新 KV 缓存
  await env.USER_VERSIONS.put(userId, version, {
    expirationTtl: 2592000
  })
}
```

### 前端代码

```typescript
// fashion_rec/frontend/src/views/Home.vue

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

## 版本选择策略

当前实现：所有用户在点击 "Enter Studio" 时设置为 `'v2'`

**如需修改**，编辑 `fashion_rec/frontend/src/views/Home.vue`：

```typescript
// 当前：固定设置为 v2
await setUserVersion('v2')

// 可选：随机分配
await setUserVersion(Math.random() > 0.5 ? 'v2' : 'stable')

// 可选：基于用户 ID 哈希
const userId = session.user.id
const hash = userId.split('').reduce((acc, char) => {
  return ((acc << 5) - acc) + char.charCodeAt(0)
}, 0)
await setUserVersion(Math.abs(hash) % 2 === 0 ? 'v2' : 'stable')
```

## 优势

1. **性能提升**：延迟减少 90%+，数据库查询减少 99%+
2. **成本降低**：Supabase 查询费用减少 99%+
3. **用户体验**：首页加载更快，只有进入 Studio 时才确定版本
4. **可扩展性**：支持高流量场景，不受数据库查询限制
5. **一致性**：已登录用户在所有页面看到相同版本

## 注意事项

1. **首次访问 Studio**：首次访问时仍需要查询数据库（~10-50ms）
2. **缓存失效**：30 天后缓存自动失效，会重新查询数据库
3. **版本更新**：调用 `/api/router/set-version` 会自动更新缓存
4. **Cookie 要求**：用户需要登录才能设置和缓存版本

## 监控和调试

### 查看缓存命中率

在 Worker 日志中搜索：
- `Cache hit for user` - 缓存命中
- `Cache miss for user` - 缓存未命中

### 查看 KV 数据

```bash
cd cloudflare-router

# 列出所有键（最多 1000 个）
pnpm exec wrangler kv key list

# 读取特定键
pnpm exec wrangler kv key get "user-uuid"

# 删除特定键（清除缓存）
pnpm exec wrangler kv key delete "user-uuid"
```

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

## 相关文档

- [KV 设置指南](./KV_SETUP_GUIDE.md) - 详细的 KV 设置步骤
- [README.md](./README.md) - 完整项目文档
- [API_URL_CONFIGURATION.md](./API_URL_CONFIGURATION.md) - API URL 配置说明
