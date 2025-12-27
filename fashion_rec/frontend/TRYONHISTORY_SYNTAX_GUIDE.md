# TryOnHistory.vue - TypeScript 和 Vue 语法详解

本文档列出了 `TryOnHistory.vue` 文件中使用的所有 TypeScript 和 Vue 语法，适合新手学习。

---

## 📋 目录

1. [Vue 3 组合式 API (Composition API)](#vue-3-组合式-api)
2. [TypeScript 语法](#typescript-语法)
3. [Vue 模板语法](#vue-模板语法)
4. [Vue 生命周期钩子](#vue-生命周期钩子)
5. [Vue Router 语法](#vue-router-语法)
6. [其他重要语法](#其他重要语法)

---

## Vue 3 组合式 API

### 1. `<script setup lang="ts">`
```typescript
<script setup lang="ts">
```
- **说明**: Vue 3 的组合式 API 语法糖，`<script setup>` 使代码更简洁
- **`lang="ts"`**: 启用 TypeScript 支持
- **特点**: 在 `<script setup>` 中定义的变量、函数会自动暴露给模板使用

### 2. `defineOptions()`
```typescript
defineOptions({ name: 'TryOnHistory' })
```
- **说明**: 定义组件的选项（如组件名）
- **用法**: 在 `<script setup>` 中替代传统的 `defineComponent` 写法

### 3. `ref()` - 响应式引用
```typescript
const historyItems = ref<TryOnHistoryItem[]>([])
const isLoading = ref(false)
const error = ref('')
const showImageViewer = ref(false)
const currentImageIndex = ref(0)
const imageViewerImages = ref<string[]>([])
```
- **说明**: 创建响应式的基本类型数据（字符串、数字、布尔值等）
- **泛型**: `<TryOnHistoryItem[]>` 指定 ref 存储的数据类型
- **访问值**: 使用 `.value` 访问和修改值（在模板中自动解包，无需 `.value`）

**示例**:
```typescript
// 在 script 中
historyItems.value = [...]
isLoading.value = true

// 在 template 中（自动解包）
{{ historyItems.length }}
```

### 4. 响应式数组操作
```typescript
historyItems.value = response.data.history || []
imageViewerImages.value = []
```
- **说明**: 直接赋值给 `.value` 来更新响应式数据

---

## TypeScript 语法

### 1. 接口 (Interface)
```typescript
interface TryOnHistoryItem {
  id: string
  image_url: string
  garment_urls?: string[]
  scene_image_url?: string
  prompt?: string
  created_at: string
  expires_at: string
}
```
- **说明**: 定义对象的结构和类型
- **`?`**: 可选属性，表示该字段可能存在也可能不存在
- **类型**: `string` (字符串), `string[]` (字符串数组)

### 2. 类型注解 (Type Annotations)

#### 函数参数类型
```typescript
const deleteHistoryItem = async (historyId: string) => {
  // ...
}

const formatDate = (dateString: string) => {
  // ...
}

const handleKeyDown = (event: KeyboardEvent) => {
  // ...
}
```
- **说明**: 为函数参数指定类型
- **`string`**: 字符串类型
- **`KeyboardEvent`**: DOM 事件类型（来自浏览器 API）

#### 函数返回类型
```typescript
const restoreHistoryFromCache = (): boolean => {
  // ...
  return false
}
```
- **说明**: `: boolean` 指定函数返回布尔值

#### 变量类型
```typescript
const API_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```
- **说明**: 显式声明变量类型（通常 TypeScript 可以自动推断，但显式声明更清晰）

### 3. 泛型 (Generics)

#### axios 泛型
```typescript
const response = await apiClient.get<{ history: TryOnHistoryItem[] }>('/tryon-history')
```
- **说明**: `<{ history: TryOnHistoryItem[] }>` 指定 API 响应的数据结构
- **好处**: TypeScript 可以自动推断 `response.data` 的类型

#### ref 泛型
```typescript
const historyItems = ref<TryOnHistoryItem[]>([])
const imageViewerImages = ref<string[]>([])
```
- **说明**: `<TryOnHistoryItem[]>` 指定 ref 存储的数组元素类型

### 4. 类型断言和可选链

#### 可选链操作符 (`?.`)
```typescript
const errorDetail = e?.response?.data?.detail || e?.message || 'Failed to load try-on history'
session?.access_token
data?.session
item.garment_urls?.length
```
- **说明**: 安全地访问可能为 `null` 或 `undefined` 的属性
- **好处**: 如果某个属性不存在，不会抛出错误，而是返回 `undefined`

#### 空值合并操作符 (`||`)
```typescript
const token = session?.access_token
historyItems.value = response.data.history || []
const cached = sessionStorage.getItem('tryon_history_cache')
```
- **说明**: 如果左侧值为假值（`null`, `undefined`, `false`, `0`, `''`），则使用右侧的值

#### 类型守卫 (Type Guard)
```typescript
.filter((url): url is string => !!url)
```
- **说明**: `url is string` 告诉 TypeScript 过滤后的数组只包含字符串类型
- **`!!url`**: 将值转换为布尔值（双重否定）

### 5. 类型注解 `any`
```typescript
catch (e: any) {
  // ...
}
catch (error: any) {
  // ...
}
```
- **说明**: `any` 表示任意类型（应该避免使用，但捕获错误时常用）
- **注意**: 尽量使用更具体的类型，如 `unknown` 或自定义错误类型

### 6. 类型推断
```typescript
const items = JSON.parse(cached)
const date = new Date(dateString)
```
- **说明**: TypeScript 会根据上下文自动推断变量类型

---

## Vue 模板语法

### 1. 插值表达式 `{{ }}`
```vue
{{ error }}
{{ formatDate(item.created_at) }}
{{ item.garment_urls.length }} item(s)
{{ currentImageIndex + 1 }} / {{ imageViewerImages.length }}
{{ getDaysRemaining(item.expires_at) }} days
```
- **说明**: 在模板中显示数据或调用函数
- **支持**: 变量、表达式、函数调用

### 2. 指令 (Directives)

#### `v-if` / `v-else-if` / `v-else`
```vue
<div v-if="isLoading">...</div>
<div v-else-if="error">...</div>
<div v-else-if="!historyItems.length">...</div>
<div v-else>...</div>
```
- **说明**: 条件渲染，根据条件显示/隐藏元素
- **特点**: `v-if` 会真正创建/销毁 DOM 元素

#### `v-for`
```vue
<div
  v-for="(item, index) in historyItems"
  :key="item.id"
>
```
- **说明**: 循环渲染列表
- **`(item, index)`**: 当前项和索引
- **`:key`**: 必须提供唯一 key（用于 Vue 的虚拟 DOM 优化）

#### `v-bind` (简写 `:`)
```vue
:src="item.image_url"
:key="item.id"
class="w-full h-full object-cover"
```
- **说明**: 绑定 HTML 属性
- **简写**: `:src` 等同于 `v-bind:src`
- **动态绑定**: 如果属性值需要是变量或表达式，使用 `:`

#### `v-on` (简写 `@`)
```vue
@click="openImageViewer(index)"
@click.stop="restoreTryOnHistory(item)"
@click.self="closeImageViewer"
@click="deleteHistoryItem(item.id)"
```
- **说明**: 绑定事件监听器
- **简写**: `@click` 等同于 `v-on:click`
- **修饰符**:
  - `.stop`: 阻止事件冒泡
  - `.self`: 只有当事件是从元素本身触发时才触发回调

#### `v-show`
```vue
<!-- 在这个文件中没有使用，但常见用法 -->
<div v-show="isVisible">内容</div>
```
- **说明**: 通过 CSS `display` 属性控制显示/隐藏（与 `v-if` 不同，`v-show` 元素始终存在）

### 3. 动态类绑定
```vue
class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
```
- **说明**: 使用 Tailwind CSS 类名（这个项目使用了 Tailwind CSS）

### 4. 模板中的方法调用
```vue
{{ formatDate(item.created_at) }}
@click="openImageViewer(index)"
```
- **说明**: 可以直接在模板中调用 script 中定义的函数

---

## Vue 生命周期钩子

### 1. `onMounted()`
```typescript
onMounted(async () => {
  restoreHistoryFromCache()
  // ... 其他初始化代码
  window.addEventListener('keydown', handleKeyDown)
})
```
- **说明**: 组件挂载到 DOM 后执行
- **用途**: 初始化数据、添加事件监听器、调用 API
- **`async`**: 支持异步操作

### 2. `onActivated()`
```typescript
onActivated(async () => {
  try {
    await refreshSession()
  } catch (e) {
    console.warn('[TryOnHistory] Failed to refresh session on activated:', e)
  }
})
```
- **说明**: 当使用 `<keep-alive>` 缓存的组件被激活时调用
- **用途**: 刷新数据、同步状态

### 3. 生命周期钩子导入
```typescript
import { onMounted, onActivated, ref } from 'vue'
```
- **说明**: 从 Vue 导入生命周期函数

---

## Vue Router 语法

### 1. `useRouter()`
```typescript
const router = useRouter()
```
- **说明**: 获取路由实例
- **用途**: 编程式导航

### 2. 路由导航
```typescript
router.push('/login')
router.push({
  path: '/studio',
  query: { tryonHistoryId: item.id }
})
```
- **说明**: 导航到不同路由
- **方式1**: 字符串路径 `'/login'`
- **方式2**: 对象形式（可以传递查询参数）

### 3. Router 导入
```typescript
import { useRouter } from 'vue-router'
```

---

## 其他重要语法

### 1. 异步函数 (async/await)
```typescript
const loadHistory = async () => {
  try {
    const response = await apiClient.get('/tryon-history')
    historyItems.value = response.data.history || []
  } catch (e: any) {
    // 错误处理
  } finally {
    isLoading.value = false
  }
}
```
- **`async`**: 声明异步函数
- **`await`**: 等待 Promise 完成
- **`try/catch/finally`**: 错误处理和清理代码

### 2. 箭头函数
```typescript
const loadHistory = async () => { }
const formatDate = (dateString: string) => { }
const handleKeyDown = (event: KeyboardEvent) => { }
```
- **说明**: 简化的函数语法
- **形式**: `(参数) => { 函数体 }`

### 3. 解构赋值
```typescript
const { isAuthenticated: _isAuthenticated, refreshSession } = useAuthState()
const { data, error } = await supabase.auth.getSession()
const { data } = await supabase.auth.getSession()
```
- **说明**: 从对象中提取属性
- **重命名**: `isAuthenticated: _isAuthenticated` 将 `isAuthenticated` 重命名为 `_isAuthenticated`

### 4. 可选参数和默认值
```typescript
// 在这个文件中没有显式使用，但常见用法：
function greet(name: string = 'Guest') {
  // ...
}
```

### 5. 数组方法

#### `map()`
```typescript
imageViewerImages.value = historyItems.value
  .map(item => item.image_url)
```
- **说明**: 将数组的每个元素转换为新值，返回新数组

#### `filter()`
```typescript
.filter((url): url is string => !!url)
```
- **说明**: 根据条件过滤数组元素，返回新数组

### 6. 对象属性访问
```typescript
item.image_url
item.garment_urls?.length
response.data.history
e?.response?.data?.detail
```
- **说明**: 使用点号访问对象属性

### 7. 条件运算符 (三元运算符)
```typescript
// 在这个文件中没有使用，但常见用法：
const message = isLoading ? 'Loading...' : 'Loaded'
```

### 8. 逻辑运算符
```typescript
if (!session) { }
if (item.garment_urls && item.garment_urls.length > 0) { }
```
- **`!`**: 逻辑非
- **`&&`**: 逻辑与

### 9. 类型转换
```typescript
const items = JSON.parse(cached)
const date = new Date(dateString)
JSON.stringify(historyItems.value)
```
- **`JSON.parse()`**: 将 JSON 字符串转换为 JavaScript 对象
- **`JSON.stringify()`**: 将 JavaScript 对象转换为 JSON 字符串
- **`new Date()`**: 创建日期对象

### 10. 环境变量
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```
- **`import.meta.env`**: Vite 的环境变量访问方式
- **`VITE_`**: Vite 要求环境变量以 `VITE_` 开头才能在客户端访问

### 11. 浏览器 API

#### localStorage / sessionStorage
```typescript
localStorage.getItem('auth_token')
localStorage.setItem('auth_token', token)
sessionStorage.setItem('tryon_history_cache', JSON.stringify(historyItems.value))
sessionStorage.getItem('tryon_history_cache')
```
- **`localStorage`**: 持久化存储（关闭浏览器后仍存在）
- **`sessionStorage`**: 会话存储（关闭标签页后清除）

#### window 对象
```typescript
window.addEventListener('keydown', handleKeyDown)
```

### 12. Promise
```typescript
await new Promise(resolve => setTimeout(resolve, delay))
```
- **说明**: 创建 Promise 用于延迟执行（setTimeout 的 Promise 包装）

### 13. 模块导入
```typescript
import { onMounted, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { useAuthState } from '../composables/useAuthState'
import { History, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-vue-next'
```
- **命名导入**: `import { xxx } from 'xxx'`
- **默认导入**: `import axios from 'axios'`
- **相对路径**: `'../lib/supabase'` 从当前文件向上查找

### 14. 注释
```typescript
// 单行注释
/* 多行注释 */
```
- **说明**: 代码注释，不影响程序执行

---

## 📝 总结

### Vue 3 核心概念
1. **组合式 API**: 使用 `<script setup>` 和 Composition API 函数
2. **响应式数据**: 使用 `ref()` 创建响应式变量
3. **生命周期**: 使用 `onMounted()` 等钩子函数
4. **模板语法**: 使用 `{{ }}`, `v-if`, `v-for`, `@click` 等指令

### TypeScript 核心概念
1. **类型注解**: 为变量、函数参数、返回值指定类型
2. **接口**: 定义对象结构
3. **泛型**: 创建可复用的类型
4. **可选链**: 安全地访问可能不存在的属性

### 常用模式
1. **异步操作**: `async/await` + `try/catch`
2. **响应式更新**: 修改 `ref.value` 自动更新 UI
3. **条件渲染**: `v-if` / `v-else`
4. **列表渲染**: `v-for` + `:key`

---

## 🎯 学习建议

1. **从简单开始**: 先理解 `ref()`, `v-if`, `v-for` 等基础语法
2. **实践练习**: 尝试修改代码，观察效果
3. **查阅文档**: 
   - Vue 3 官方文档: https://vuejs.org/
   - TypeScript 官方文档: https://www.typescriptlang.org/
4. **理解响应式**: 这是 Vue 的核心概念，理解 `ref()` 和 `.value` 的使用
5. **类型安全**: TypeScript 的类型系统可以帮助避免错误，尽量使用类型注解

