# SSR 认证 Token 问题分析

## 潜在问题

### 1. **Store 初始化时机问题**
- **问题**：`auth.ts` store 在创建时立即调用 `loadSession()`（第 94 行）
- **SSR 影响**：在 SSR 环境中，Supabase 可能无法正确获取 session，因为：
  - `localStorage` 在 SSR 中不存在
  - Supabase 的 session 存储依赖于浏览器环境
- **后果**：SSR 时 session 为 `null`，但客户端 hydration 时可能有 session，导致 hydration 不匹配

### 2. **路由守卫在 SSR 中执行**
- **问题**：`router/index.ts` 的路由守卫在 SSR 中也会执行（第 105-123 行）
- **SSR 影响**：如果用户直接访问需要认证的页面（如 `/studio`），SSR 会尝试渲染，但此时：
  - `authStore.isLoading` 可能为 `true`
  - `authStore.isAuthenticated` 可能为 `false`
  - 导致 SSR 渲染未认证状态，但客户端 hydration 时可能已认证
- **后果**：Hydration 不匹配错误，或 SSR 渲染错误的页面状态

### 3. **API Client 拦截器在 SSR 中执行**
- **问题**：`api-client.ts` 的拦截器在 SSR 中也会执行（第 22-110 行）
- **SSR 影响**：如果组件在 SSR 中发起 API 请求：
  - `localStorage.getItem('auth_token')` 在 SSR 中返回 `null`
  - `useAuthStore()` 在 SSR 中可能没有正确的 session
  - 导致 API 请求没有 token，返回 401 错误
- **后果**：SSR 渲染失败，或渲染错误的数据

### 4. **Supabase Session 存储问题**
- **问题**：Supabase 使用 `localStorage` 存储 session
- **SSR 影响**：SSR 无法访问 `localStorage`，无法获取 session
- **后果**：SSR 时无法知道用户是否已认证

## 当前配置分析

根据 `vite.config.ts`，只预渲染了公共页面：
```typescript
ssgOptions: {
  includedRoutes: () => [
    '/',
    '/pricing',
    '/privacy-policy',
    '/terms-of-service',
  ],
}
```

**这意味着**：
- ✅ 公共页面（不需要认证）可以正常 SSR
- ⚠️ 如果用户直接访问需要认证的页面，SSR 可能会尝试渲染，导致问题

## 解决方案

### 方案 1：延迟 Store 初始化（推荐）

只在客户端初始化 auth store：

```typescript
// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  // ... state and getters ...

  // Initialize on store creation (only in browser)
  if (typeof window !== 'undefined') {
    setupAuthListener()
    loadSession()
  }

  return {
    // ...
  }
}, {
  persist: typeof window !== 'undefined' ? {
    key: 'auth-store',
    storage: localStorage,
  } : false,
})
```

### 方案 2：在路由守卫中跳过 SSR

```typescript
// router/index.ts
export const setupRouterGuards = (router: Router) => {
  router.beforeEach(async (to, _from, next) => {
    // Skip auth check in SSR
    if (typeof window === 'undefined') {
      next()
      return
    }

    const authStore = useAuthStore()
    // ... rest of the code
  })
}
```

### 方案 3：使用 Cookie 而不是 localStorage（最佳实践）

对于 SSR，应该使用 Cookie 来传递 token，因为：
- Cookie 可以在 SSR 中访问（通过 `req.headers.cookie`）
- Cookie 会自动发送到服务器
- 更安全（可以设置 `httpOnly` 和 `secure`）

但这需要后端支持从 Cookie 读取 token。

### 方案 4：完全禁用需要认证页面的 SSR

在 `vite.config.ts` 中明确排除需要认证的页面：

```typescript
ssgOptions: {
  includedRoutes: () => [
    '/',
    '/pricing',
    '/privacy-policy',
    '/terms-of-service',
  ],
  // 明确排除需要认证的页面
  excludedRoutes: () => [
    '/studio',
    '/wardrobe',
    '/favorites',
    '/tryon-history',
    '/profile',
    '/lv-products',
  ],
}
```

## 推荐修复

结合方案 1 和方案 2，确保 SSR 兼容性：

1. **延迟 Store 初始化**：只在客户端初始化
2. **路由守卫跳过 SSR**：在 SSR 中不执行认证检查
3. **API Client 跳过 SSR**：在 SSR 中不执行拦截器逻辑（或返回空 token）

这样可以确保：
- ✅ SSR 只渲染公共页面（不需要认证）
- ✅ 需要认证的页面在客户端渲染
- ✅ 避免 hydration 不匹配
- ✅ 避免 SSR 中的 token 获取问题

