# Vue 3 + TypeScript 语法教程（基于 TryOnHistory.vue）

## 📚 目录
1. [基础语法结构](#1-基础语法结构)
2. [TypeScript 类型定义](#2-typescript-类型定义)
3. [Vue 3 响应式数据](#3-vue-3-响应式数据)
4. [函数定义](#4-函数定义)
5. [生命周期钩子](#5-生命周期钩子)
6. [模板语法](#6-模板语法)
7. [实际代码示例解析](#7-实际代码示例解析)

---

## 1. 基础语法结构

### 1.1 `<script setup>` - Vue 3 的新语法

```vue
<script setup lang="ts">
// 你的代码写在这里
</script>
```

**解释：**
- `<script setup>` 是 Vue 3 的语法糖，让你可以直接写代码，不需要 `export default`
- `lang="ts"` 表示使用 TypeScript
- 在 `<script setup>` 中定义的变量和函数，可以直接在模板中使用

**对比传统写法：**
```vue
<!-- 传统写法（Options API）-->
<script>
export default {
  data() {
    return {
      count: 0
    }
  },
  methods: {
    increment() {
      this.count++
    }
  }
}
</script>

<!-- 新写法（Composition API + setup）-->
<script setup>
import { ref } from 'vue'
const count = ref(0)
const increment = () => {
  count.value++
}
</script>
```

---

## 2. TypeScript 类型定义

### 2.1 `interface` - 定义对象结构

```typescript
interface TryOnHistoryItem {
  id: string           // 必须有，类型是字符串
  image_url: string    // 必须有，类型是字符串
  garment_urls?: string[]  // ? 表示可选（可有可无），类型是字符串数组
  Background_image_url?: string // 可选，类型是字符串
  prompt?: string      // 可选，类型是字符串
  created_at: string   // 必须有，类型是字符串
  expires_at: string   // 必须有，类型是字符串
}
```

**解释：**
- `interface` 定义了一个"形状"（shape），告诉 TypeScript 这个对象应该有什么属性
- `string` 表示字符串类型
- `string[]` 表示字符串数组（数组里都是字符串）
- `?` 表示这个属性是可选的（可以不提供）

**使用示例：**
```typescript
// ✅ 正确：包含所有必需的属性
const item: TryOnHistoryItem = {
  id: '123',
  image_url: 'https://example.com/image.jpg',
  created_at: '2024-01-01',
  expires_at: '2024-01-08'
}

// ✅ 也正确：可选属性可以不提供
const item2: TryOnHistoryItem = {
  id: '456',
  image_url: 'https://example.com/image2.jpg',
  created_at: '2024-01-01',
  expires_at: '2024-01-08',
  garment_urls: ['url1', 'url2']  // 可选属性，提供了也可以
}

// ❌ 错误：缺少必需的属性
const item3: TryOnHistoryItem = {
  id: '789',
  // 缺少 image_url, created_at, expires_at
}
```

### 2.2 函数参数类型注解

```typescript
const formatDate = (dateString: string) => {
  // dateString 必须是字符串类型
  return dateString
}

const openImageViewer = (index: number) => {
  // index 必须是数字类型
  console.log(index)
}

const deleteHistoryItem = async (historyId: string) => {
  // historyId 必须是字符串类型
  // async 表示这是一个异步函数（会返回 Promise）
}
```

---

## 3. Vue 3 响应式数据

### 3.1 `ref()` - 创建响应式变量

```typescript
import { ref } from 'vue'

// 基础类型（string, number, boolean）
const isLoading = ref(false)  // 类型会被推断为 Ref<boolean>
const error = ref('')         // 类型会被推断为 Ref<string>
const currentImageIndex = ref(0)  // 类型会被推断为 Ref<number>

// 数组类型（需要指定泛型）
const historyItems = ref<TryOnHistoryItem[]>([])
//                              ↑
//                     TypeScript 泛型，告诉 ref 里面放什么类型的数据
```

**重要概念：**

1. **`.value` 属性**
   - 在 `<script setup>` 中，修改 ref 的值需要使用 `.value`
   - 在模板中，Vue 会自动解包，不需要 `.value`

```typescript
// ❌ 错误写法
const count = ref(0)
count = 1  // 这样会报错

// ✅ 正确写法
const count = ref(0)
count.value = 1  // 使用 .value 来修改

// ✅ 读取值也要用 .value
console.log(count.value)  // 输出: 1
```

```vue
<!-- 模板中不需要 .value -->
<template>
  <div>{{ count }}</div>  <!-- Vue 自动解包，直接写 count -->
  <button @click="count++">+1</button>  <!-- 这里也可以直接写 count -->
</template>
```

2. **泛型语法 `<T>`**
```typescript
// 不指定类型（Vue 会自己推断）
const count = ref(0)  // 类型是 Ref<number>

// 指定类型（明确告诉 TypeScript 里面放什么）
const items = ref<string[]>([])  // 明确是字符串数组
const items = ref<TryOnHistoryItem[]>([])  // 明确是 TryOnHistoryItem 数组
```

**实际代码示例：**
```typescript
// 第 91-96 行
const historyItems = ref<TryOnHistoryItem[]>([])  // 空数组，类型是 TryOnHistoryItem[]
const isLoading = ref(false)  // 布尔值，表示是否正在加载
const error = ref('')  // 字符串，存储错误信息
const showImageViewer = ref(false)  // 布尔值，控制图片查看器显示/隐藏
const currentImageIndex = ref(0)  // 数字，当前显示的图片索引
const imageViewerImages = ref<string[]>([])  // 字符串数组，存储图片 URL
```

---

## 4. 函数定义

### 4.1 普通函数

```typescript
// 方式1：箭头函数（推荐，简洁）
const formatDate = (dateString: string) => {
  return dateString
}

// 方式2：传统函数声明
function formatDate(dateString: string) {
  return dateString
}
```

### 4.2 异步函数 `async/await`

```typescript
const loadHistory = async () => {
  // async 表示这是一个异步函数
  isLoading.value = true  // 开始加载，设置 loading 状态
  
  try {
    // await 表示等待这个操作完成
    const response = await apiClient.get('/tryon-history')
    historyItems.value = response.data.history || []
  } catch (e: any) {
    // 如果出错，执行这里
    console.error('Failed:', e)
    error.value = '加载失败'
  } finally {
    // 无论成功还是失败，都会执行这里
    isLoading.value = false  // 结束加载
  }
}
```

**解释：**
- `async`：标记函数为异步，函数会返回 `Promise`
- `await`：等待 Promise 完成，获取结果
- `try/catch/finally`：错误处理
  - `try`：尝试执行代码
  - `catch`：如果出错，执行这里
  - `finally`：无论成功失败都执行

### 4.3 函数参数类型

```typescript
// 单个参数
const deleteHistoryItem = async (historyId: string) => {
  // historyId 必须是字符串类型
}

// 多个参数
const greet = (name: string, age: number) => {
  console.log(`Hello, I'm ${name}, ${age} years old`)
}

// 可选参数（用 ? 标记）
const getUser = (id: string, includeEmail?: boolean) => {
  // includeEmail 是可选的，可以不传
}
```

---

## 5. 生命周期钩子

### 5.1 `onMounted` - 组件挂载时执行

```typescript
import { onMounted } from 'vue'

onMounted(() => {
  // 组件挂载到页面后执行
  // 通常在这里调用 API 加载数据
  console.log('组件已经挂载')
})

// 也可以是异步函数
onMounted(async () => {
  await loadHistory()  // 加载数据
})
```

**实际代码示例（第 230-250 行）：**
```typescript
onMounted(async () => {
  // 1. 先从缓存恢复数据（快速显示）
  restoreHistoryFromCache()
  
  // 2. 检查登录状态
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      await loadHistory()  // 加载最新数据
    }
  } catch (error) {
    console.error('Failed:', error)
    await loadHistory()
  }
  
  // 3. 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})
```

**生命周期执行顺序：**
1. 组件创建
2. 组件挂载到 DOM → `onMounted` 执行
3. 组件更新
4. 组件卸载

---

## 6. 模板语法

### 6.1 文本插值 `{{ }}`

```vue
<template>
  <p>{{ error }}</p>  <!-- 显示 error 变量的值 -->
  <p>{{ formatDate(item.created_at) }}</p>  <!-- 显示函数返回值 -->
  <p>{{ currentImageIndex + 1 }} / {{ imageViewerImages.length }}</p>  <!-- 可以写表达式 -->
</template>
```

### 6.2 属性绑定 `:属性名` 或 `v-bind:属性名`

```vue
<template>
  <!-- 方式1：简写（推荐）-->
  <img :src="item.image_url" />
  
  <!-- 方式2：完整写法 -->
  <img v-bind:src="item.image_url" />
  
  <!-- 实际含义：把 item.image_url 的值绑定到 src 属性 -->
</template>
```

### 6.3 事件绑定 `@事件名` 或 `v-on:事件名`

```vue
<template>
  <!-- 方式1：简写（推荐）-->
  <button @click="deleteHistoryItem(item.id)">删除</button>
  
  <!-- 方式2：完整写法 -->
  <button v-on:click="deleteHistoryItem(item.id)">删除</button>
  
  <!-- 阻止事件冒泡 -->
  <button @click.stop="restoreTryOnHistory(item)">恢复</button>
  <!-- .stop 修饰符阻止事件向上传播 -->
</template>
```

### 6.4 条件渲染 `v-if` / `v-else-if` / `v-else`

```vue
<template>
  <!-- 如果 isLoading 为 true，显示加载动画 -->
  <div v-if="isLoading">
    <div class="spinner">加载中...</div>
  </div>
  
  <!-- 否则，如果 error 有值，显示错误信息 -->
  <div v-else-if="error">
    {{ error }}
  </div>
  
  <!-- 否则，如果历史记录为空，显示空状态 -->
  <div v-else-if="!historyItems.length">
    <p>没有历史记录</p>
  </div>
  
  <!-- 否则，显示历史记录列表 -->
  <div v-else>
    <!-- 历史记录 -->
  </div>
</template>
```

**注意：**
- `v-if` 是"真正的"条件渲染，元素可能不会被创建
- `v-show` 只是切换 CSS 的 `display` 属性，元素始终存在

### 6.5 列表渲染 `v-for`

```vue
<template>
  <div
    v-for="(item, index) in historyItems"
    :key="item.id"
  >
    <!-- item 是当前循环项 -->
    <!-- index 是当前索引（0, 1, 2, ...）-->
    <!-- :key 必须提供，Vue 用来追踪每个元素 -->
    <img :src="item.image_url" />
    <p>{{ item.id }}</p>
  </div>
</template>
```

**解释：**
- `v-for="(item, index) in historyItems"`：遍历 `historyItems` 数组
- `:key="item.id"`：每个元素必须有唯一的 key（Vue 要求，用于性能优化）

---

## 7. 实际代码示例解析

让我们逐段分析 TryOnHistory.vue 中的代码：

### 示例 1：定义响应式数据（第 91-96 行）

```typescript
const historyItems = ref<TryOnHistoryItem[]>([])
const isLoading = ref(false)
const error = ref('')
```

**解释：**
- `historyItems`：存储历史记录列表，初始是空数组
- `isLoading`：是否正在加载，初始是 `false`
- `error`：错误信息，初始是空字符串

**在模板中使用：**
```vue
<!-- Vue 自动解包，不需要 .value -->
<div v-if="isLoading">加载中...</div>
<div v-for="item in historyItems" :key="item.id">
  {{ item.image_url }}
</div>
```

### 示例 2：异步函数（第 124-164 行）

```typescript
const loadHistory = async () => {
  if (isLoading.value) return  // 防止重复调用
  
  isLoading.value = true  // 开始加载
  error.value = ''  // 清空错误信息
  
  try {
    // 发送 GET 请求
    const response = await apiClient.get<{ history: TryOnHistoryItem[] }>('/tryon-history')
    
    // 更新数据（注意要用 .value）
    historyItems.value = response.data.history || []
    
    // 保存到缓存
    saveHistoryToCache()
  } catch (e: any) {
    // 出错处理
    console.error('Failed:', e)
    error.value = e?.response?.data?.detail || '加载失败'
  } finally {
    // 无论成功失败，都要结束加载
    isLoading.value = false
  }
}
```

**关键点：**
1. `async` 函数可以 `await` 其他异步操作
2. `try/catch/finally` 处理错误
3. 修改 ref 要用 `.value`
4. `e: any` 表示错误对象类型是 `any`（不检查类型）

### 示例 3：事件处理函数（第 166-179 行）

```typescript
const deleteHistoryItem = async (historyId: string) => {
  // 确认对话框
  if (!confirm('Delete this try-on history item?')) {
    return  // 用户点击取消，直接返回
  }
  
  try {
    // 发送 DELETE 请求
    await apiClient.delete(`/tryon-history/${historyId}`)
    
    // 删除成功后，重新加载列表
    await loadHistory()
  } catch (e: any) {
    // 出错时弹出提示
    alert(e?.response?.data?.detail || 'Delete failed')
  }
}
```

**关键点：**
1. `historyId: string` 参数类型注解
2. `confirm()` 浏览器原生确认对话框
3. 模板字符串 `` `/tryon-history/${historyId}` `` 用于拼接字符串

**在模板中使用：**
```vue
<button @click="deleteHistoryItem(item.id)">删除</button>
<!-- 点击按钮时，调用 deleteHistoryItem，传入 item.id -->
```

### 示例 4：计算/转换函数（第 252-282 行）

```typescript
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)  // 将字符串转换为日期对象
    const now = new Date()  // 当前时间
    const diffMs = now.getTime() - date.getTime()  // 时间差（毫秒）
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))  // 转换为天数
    
    if (diffDays === 0) {
      // 今天
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return diffMinutes <= 1 ? 'just now' : `${diffMinutes} minutes ago`
      }
      return `${diffHours} hours ago`
    } else if (diffDays === 1) {
      return 'yesterday'
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      // 超过7天，显示完整日期
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  } catch {
    // 如果出错（比如日期格式不对），返回原始字符串
    return dateString
  }
}
```

**关键点：**
1. 普通函数（不是异步）
2. `try/catch` 处理可能的错误
3. 返回格式化后的字符串
4. 模板字符串 `` `${diffMinutes} minutes ago` ``

**在模板中使用：**
```vue
<p>{{ formatDate(item.created_at) }}</p>
<!-- 显示格式化后的日期，如 "2 hours ago" -->
```

### 示例 5：模板中的条件渲染和列表渲染（第 353-409 行）

```vue
<!-- 如果有历史记录，显示网格布局 -->
<div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- 遍历历史记录 -->
  <div
    v-for="(item, index) in historyItems"
    :key="item.id"
    class="bg-white border border-gray-200 rounded-xl..."
  >
    <!-- 图片，点击打开查看器 -->
    <div
      @click="openImageViewer(index)"
      class="aspect-square bg-gray-100 cursor-pointer..."
    >
      <img :src="item.image_url" alt="Try-on result" />
      
      <!-- 显示剩余天数（条件渲染）-->
      <div class="absolute top-2 right-2 bg-blue-500/90...">
        Expires in {{ getDaysRemaining(item.expires_at) }} days
      </div>
    </div>
    
    <!-- 内容区域 -->
    <div class="p-4">
      <!-- 日期 -->
      <p class="text-xs text-gray-400 mb-1">
        {{ formatDate(item.created_at) }}
      </p>
      
      <!-- 如果有 garment_urls，显示数量（条件渲染）-->
      <p v-if="item.garment_urls && item.garment_urls.length > 0" class="text-xs text-gray-500">
        {{ item.garment_urls.length }} item(s)
      </p>
      
      <!-- 如果有背景图片，显示提示（条件渲染）-->
      <p v-if="item.Background_image_url" class="text-xs text-blue-500 mt-1">
        Includes Background
      </p>
      
      <!-- 按钮组 -->
      <div class="flex items-center gap-1">
        <!-- 恢复按钮 -->
        <button
          @click.stop="restoreTryOnHistory(item)"
          title="Restore to this fitting"
        >
          <RotateCcw class="w-4 h-4" />
        </button>
        
        <!-- 删除按钮 -->
        <button
          @click.stop="deleteHistoryItem(item.id)"
          title="Clear History"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</div>
```

**关键点：**
1. `v-for="(item, index) in historyItems"`：遍历数组
2. `:key="item.id"`：必须提供唯一 key
3. `@click="openImageViewer(index)"`：点击事件
4. `@click.stop`：阻止事件冒泡（点击按钮不会触发父元素的点击事件）
5. `:src="item.image_url"`：属性绑定
6. `v-if`：条件渲染
7. `{{ }}`：文本插值

---

## 📝 总结：常用语法速查表

### 响应式数据
```typescript
const count = ref(0)           // 创建
count.value = 1                // 修改（script 中）
count.value++                  // 修改（script 中）
```

```vue
<template>
  {{ count }}                  <!-- 使用（模板中不需要 .value）-->
</template>
```

### 函数定义
```typescript
// 普通函数
const func = (param: string) => { }

// 异步函数
const asyncFunc = async () => {
  const result = await someAsyncOperation()
}
```

### 类型定义
```typescript
interface User {
  id: string
  name: string
  email?: string  // 可选
}

const user = ref<User>({ id: '1', name: 'John' })
```

### 模板语法
```vue
<template>
  <!-- 文本插值 -->
  {{ message }}
  
  <!-- 属性绑定 -->
  <img :src="imageUrl" />
  
  <!-- 事件绑定 -->
  <button @click="handleClick">点击</button>
  
  <!-- 条件渲染 -->
  <div v-if="isVisible">显示</div>
  <div v-else>隐藏</div>
  
  <!-- 列表渲染 -->
  <div v-for="item in items" :key="item.id">
    {{ item.name }}
  </div>
</template>
```

---

## 🎯 下一步学习建议

1. **练习修改代码**：尝试修改一些值，看看会发生什么
2. **添加新功能**：比如添加一个"刷新"按钮
3. **阅读 Vue 3 官方文档**：https://cn.vuejs.org/
4. **学习 TypeScript 基础**：https://www.typescriptlang.org/docs/

有问题随时问我！😊

