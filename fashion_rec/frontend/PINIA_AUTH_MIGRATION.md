# Pinia 认证状态管理迁移方案

## 方案概述

使用 Pinia 替代当前的 `useAuthState` composable，提供更集中、更可靠的状态管理。

## 优势对比

### 当前方案（useAuthState composable）
- ✅ 简单直接
- ❌ 模块级变量，状态管理不够清晰
- ❌ 手动同步 localStorage，容易出错
- ❌ 需要在多个组件中调用，可能重复初始化
- ❌ 调试困难（没有 DevTools 支持）

### Pinia 方案
- ✅ 集中式状态管理
- ✅ 自动持久化（使用 pinia-plugin-persistedstate）
- ✅ 更好的 TypeScript 支持
- ✅ Vue DevTools 支持
- ✅ 更清晰的代码结构
- ✅ 全局单例，避免重复初始化

## 实现步骤

### 1. 安装依赖

```bash
pnpm add pinia pinia-plugin-persistedstate
```

### 2. 创建 Auth Store

创建 `src/stores/auth.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  // State
  const session = ref<Session | null>(null)
  const isLoading = ref(true)
  let unsubscribe: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null

  // Getters
  const isAuthenticated = computed(() => !!session.value)
  const user = computed(() => session.value?.user ?? null)
  const accessToken = computed(() => session.value?.access_token ?? null)

  // Actions
  const loadSession = async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.warn('Failed to get Supabase session', error)
    }
    session.value = data.session ?? null
    isLoading.value = false

    // Sync to localStorage for backward compatibility
    if (typeof window !== 'undefined') {
      if (session.value?.access_token) {
        localStorage.setItem('auth_token', session.value.access_token)
      } else {
        localStorage.removeItem('auth_token')
      }
    }

    return session.value
  }

  const refreshSession = async () => {
    return await loadSession()
  }

  const setupAuthListener = () => {
    if (unsubscribe) return

    unsubscribe = supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      isLoading.value = false

      // Sync to localStorage
      if (typeof window !== 'undefined') {
        if (newSession?.access_token) {
          localStorage.setItem('auth_token', newSession.access_token)
        } else {
          localStorage.removeItem('auth_token')
        }
      }
    })
  }

  const cleanup = () => {
    if (unsubscribe) {
      unsubscribe.data.subscription.unsubscribe()
      unsubscribe = null
    }
  }

  // Initialize on store creation
  setupAuthListener()
  loadSession()

  return {
    // State
    session,
    isLoading,
    // Getters
    isAuthenticated,
    user,
    accessToken,
    // Actions
    loadSession,
    refreshSession,
    setupAuthListener,
    cleanup,
  }
}, {
  // Persist configuration
  persist: {
    key: 'auth-store',
    storage: localStorage,
    paths: ['session'], // Only persist session, not isLoading
    // Custom serializer to handle Session object
    serializer: {
      deserialize: (value: string) => {
        try {
          const parsed = JSON.parse(value)
          // Reconstruct Session object if needed
          return parsed
        } catch {
          return null
        }
      },
      serialize: (value: any) => {
        return JSON.stringify(value)
      },
    },
  },
})
```

### 3. 配置 Pinia

修改 `src/main.ts`:

```typescript
import './style.css'
import App from './App.vue'
import { ViteSSG } from 'vite-ssg'
import { createHead } from '@vueuse/head'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { routes, setupRouterGuards } from './router'

export const createApp = ViteSSG(
  App,
  {
    routes,
    base: import.meta.env.BASE_URL,
  },
  ({ app, router }) => {
    const head = createHead()
    app.use(head)

    // Setup Pinia
    const pinia = createPinia()
    pinia.use(piniaPluginPersistedstate)
    app.use(pinia)

    setupRouterGuards(router)
  }
)
```

### 4. 更新路由守卫

修改 `src/router/index.ts` 中的 `setupRouterGuards`:

```typescript
import { useAuthStore } from '@/stores/auth'

export function setupRouterGuards(router: Router) {
  router.beforeEach(async (to, from, next) => {
    const authStore = useAuthStore()

    // Wait for initial session load
    if (authStore.isLoading) {
      await authStore.loadSession()
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      next({ name: 'login', query: { redirect: to.fullPath } })
    } else {
      next()
    }
  })
}
```

### 5. 更新组件使用

#### App.vue
```vue
<script setup>
// No longer need to call useAuthState() here
// Pinia store is automatically initialized
</script>
```

#### TryOnHistory.vue / Favorites.vue
```typescript
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// Use authStore.session, authStore.isAuthenticated, etc.
onActivated(async () => {
  try {
    await authStore.refreshSession()
  } catch (e) {
    console.warn('[TryOnHistory] Failed to refresh session:', e)
  }
})
```

#### api-client.ts
```typescript
import { useAuthStore } from '@/stores/auth'

// In interceptor:
const authStore = useAuthStore()
const token = authStore.accessToken || localStorage.getItem('auth_token')
```

## 迁移检查清单

- [ ] 安装 pinia 和 pinia-plugin-persistedstate
- [ ] 创建 auth store
- [ ] 配置 Pinia 和持久化插件
- [ ] 更新路由守卫
- [ ] 更新所有使用 useAuthState 的组件
- [ ] 更新 api-client.ts
- [ ] 测试登录/登出流程
- [ ] 测试页面刷新背景
- [ ] 测试 keep-alive 背景
- [ ] 移除旧的 useAuthState.ts（可选）

## 注意事项

1. **持久化配置**：Session 对象可能包含不可序列化的内容，需要自定义序列化器
2. **向后兼容**：保持 localStorage 同步，确保现有代码继续工作
3. **初始化时机**：Store 在创建时自动初始化，无需在 App.vue 中手动调用
4. **清理**：在应用卸载时清理 auth listener（如果需要）

## 推荐

✅ **强烈推荐使用 Pinia**，原因：
- 更清晰的状态管理
- 自动持久化，减少手动同步错误
- 更好的开发体验（DevTools）
- 更符合 Vue 3 最佳实践

