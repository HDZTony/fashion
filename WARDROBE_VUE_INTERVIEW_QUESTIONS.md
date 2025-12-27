# Wardrobe.vue 前端面试题集

基于 `Wardrobe.vue` 组件的深度技术面试题，涵盖 Vue 3、TypeScript、性能优化、用户体验等多个维度。

---

## 📋 目录

1. [Vue 3 Composition API](#1-vue-3-composition-api)
2. [响应式数据管理](#2-响应式数据管理)
3. [生命周期钩子](#3-生命周期钩子)
4. [性能优化](#4-性能优化)
5. [错误处理与用户体验](#5-错误处理与用户体验)
6. [状态管理与数据持久化](#6-状态管理与数据持久化)
7. [代码质量与最佳实践](#7-代码质量与最佳实践)
8. [实际场景问题](#8-实际场景问题)

---

## 1. Vue 3 Composition API

### Q1.1: 为什么使用 `script setup` 而不是传统的 `setup()` 函数？

**考察点：** Vue 3 Composition API 的理解

**参考答案：**

`script setup` 是 Vue 3.2+ 引入的语法糖，相比传统 `setup()` 函数有以下优势：

1. **更简洁的语法**：无需显式返回，顶层变量自动暴露给模板
2. **更好的 TypeScript 支持**：类型推断更准确
3. **更好的性能**：编译时优化，减少运行时开销
4. **更少的样板代码**：不需要手动返回对象

**代码对比：**

```typescript
// 传统方式
export default {
  setup() {
    const count = ref(0)
    return { count }
  }
}

// script setup
<script setup lang="ts">
const count = ref(0)
// 自动暴露给模板
</script>
```

**在 Wardrobe.vue 中的体现：**
- 所有 `ref`、`computed` 等响应式变量直接定义在顶层
- 无需显式返回，模板可直接访问

---

### Q1.2: 解释 `defineOptions` 的作用，为什么需要它？

**考察点：** Vue 3 组件选项 API 与 Composition API 的混合使用

**参考答案：**

`defineOptions` 是 Vue 3.3+ 引入的宏，用于在 `<script setup>` 中定义组件选项（如 `name`、`inheritAttrs` 等）。

**为什么需要：**
1. **调试友好**：组件名称在 Vue DevTools 中显示
2. **递归组件**：需要 `name` 来引用自身
3. **keep-alive**：需要 `name` 来正确缓存组件
4. **测试工具**：某些测试工具依赖组件名称

**在 Wardrobe.vue 中：**
```typescript
defineOptions({ name: 'Wardrobe' })
```
这确保了组件在 Vue DevTools 中显示为 "Wardrobe"，而不是匿名组件。

---

### Q1.3: 解释 `onActivated` 的作用和使用场景

**考察点：** Vue 3 keep-alive 生命周期钩子

**参考答案：**

`onActivated` 是 `keep-alive` 组件的生命周期钩子，当被缓存的组件被激活时调用。

**使用场景：**
1. **恢复组件状态**：从其他页面返回时恢复数据
2. **重新加载数据**：确保数据是最新的
3. **重新绑定事件**：某些事件监听器需要重新绑定

**在 Wardrobe.vue 中的实现：**

```typescript
onActivated(() => {
  // 1. 重新加载选择状态（从 localStorage）
  loadOutfitSelection()
  
  // 2. 恢复缓存数据或重新加载
  if (uploadedItems.value.length === 0) {
    const restored = restoreItemsFromCache()
    if (!restored) {
      // 避免重复加载
      const hasTriedLoading = sessionStorage.getItem('wardrobe_load_attempted') === 'true'
      if (!hasTriedLoading && !hasLoadedItems.value) {
        loadUserItems()
      }
    }
  }
})
```

**关键点：**
- 使用 `sessionStorage` 标志避免重复加载
- 优先从缓存恢复，减少不必要的网络请求
- 同步跨页面的选择状态（与 Studio.vue 同步）

---

## 2. 响应式数据管理

### Q2.1: 为什么使用 `Set` 而不是数组来管理选中的项目 ID？

**考察点：** 数据结构选择与性能优化

**参考答案：**

使用 `Set` 的优势：

1. **O(1) 查找性能**：`Set.has()` 是 O(1)，数组的 `includes()` 是 O(n)
2. **自动去重**：不会出现重复的 ID
3. **语义清晰**：`Set` 表示"集合"，更符合业务逻辑
4. **内存效率**：只存储唯一值

**代码对比：**

```typescript
// 使用数组（不推荐）
const selectedIds = ref<string[]>([])
const isSelected = (id: string) => selectedIds.value.includes(id) // O(n)
selectedIds.value.push(id) // 可能重复

// 使用 Set（推荐）
const selectedIds = ref<Set<string>>(new Set())
const isSelected = (id: string) => selectedIds.value.has(id) // O(1)
selectedIds.value.add(id) // 自动去重
```

**在 Wardrobe.vue 中的应用：**
```typescript
const selectedForOutfitIds = ref<Set<string>>(new Set())
const selectedItemIds = ref<Set<string>>(new Set())
```

**性能影响：**
- 当有 1000 个物品时，数组查找需要遍历，Set 直接哈希查找
- 在频繁的选中/取消操作中，Set 性能优势明显

---

### Q2.2: 解释 `computed` 属性的缓存机制，`filteredItems` 何时重新计算？

**考察点：** Vue 3 计算属性的响应式依赖追踪

**参考答案：**

`computed` 属性会缓存计算结果，只有当其**依赖的响应式数据**发生变化时才会重新计算。

**在 Wardrobe.vue 中：**

```typescript
const filteredItems = computed(() => {
  return uploadedItems.value.filter((item) => 
    matchesCategory(item.features.type, selectedFilter.value)
  )
})
```

**重新计算的时机：**
1. `uploadedItems.value` 发生变化（添加/删除/更新）
2. `selectedFilter.value` 发生变化（切换分类）

**不会重新计算的情况：**
- 模板中多次使用 `filteredItems`（复用缓存结果）
- 其他不相关的响应式数据变化

**性能优化：**
- 如果 `uploadedItems` 有 1000 项，但只有 `selectedFilter` 变化，Vue 会复用之前的过滤结果（如果依赖没变）
- 但如果 `uploadedItems` 或 `selectedFilter` 变化，会重新执行 `filter()` 方法

---

### Q2.3: 为什么 `uploadedFileSignatures` 使用普通 `Set` 而不是 `ref<Set>`？

**考察点：** 响应式系统的理解，何时需要响应式

**参考答案：**

`uploadedFileSignatures` 不需要是响应式的，因为：

1. **不在模板中使用**：模板不需要响应这个数据的变化
2. **内部状态管理**：仅用于防止重复上传，是内部逻辑
3. **性能考虑**：避免不必要的响应式开销

**对比：**

```typescript
// 不需要响应式（当前实现）
const uploadedFileSignatures = new Set<string>()

// 如果需要响应式（不推荐，因为不需要）
const uploadedFileSignatures = ref<Set<string>>(new Set())
```

**何时需要 `ref`：**
- 数据需要在模板中显示
- 数据变化需要触发视图更新
- 数据需要被 `watch` 或 `computed` 依赖

**何时不需要 `ref`：**
- 纯内部状态（如缓存、标志位）
- 不需要触发视图更新的数据
- 性能敏感的场景

---

## 3. 生命周期钩子

### Q3.1: 解释 `onMounted`、`onActivated`、`watch` 的执行顺序和各自职责

**考察点：** Vue 3 生命周期钩子的执行时机

**参考答案：**

**执行顺序（首次加载）：**
1. `onMounted` → 组件挂载后执行
2. `watch` → 响应式数据变化时执行

**执行顺序（keep-alive 组件激活）：**
1. `onActivated` → 组件激活时执行
2. `watch` → 如果路由变化，会触发

**在 Wardrobe.vue 中的实现：**

```typescript
onMounted(() => {
  // 1. 恢复缓存数据
  if (uploadedItems.value.length === 0) {
    restoreItemsFromCache()
  }
  // 2. 加载选择状态
  loadOutfitSelection()
  // 3. 绑定键盘事件
  window.addEventListener('keydown', handleKeyDown)
})

onActivated(() => {
  // 1. 重新同步选择状态（从其他页面返回时）
  loadOutfitSelection()
  // 2. 恢复或加载数据
  if (uploadedItems.value.length === 0) {
    restoreItemsFromCache()
    // 或重新加载
  }
})

watch(() => route.name, (newName) => {
  // 路由变化时重新加载选择状态
  if (newName === 'wardrobe') {
    loadOutfitSelection()
  }
})
```

**职责划分：**
- `onMounted`：初始化工作（事件监听、首次数据加载）
- `onActivated`：恢复状态（从缓存恢复、同步跨页面状态）
- `watch`：响应路由变化（确保路由切换时状态同步）

---

### Q3.2: 为什么在 `onUnmounted` 中移除事件监听器？

**考察点：** 内存泄漏预防

**参考答案：**

**问题：** 如果不移除事件监听器，会导致：
1. **内存泄漏**：组件销毁后，事件监听器仍然存在
2. **重复绑定**：组件重新创建时，会重复绑定
3. **意外行为**：销毁的组件仍然响应事件

**在 Wardrobe.vue 中：**

```typescript
onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
```

**关键点：**
- `handleKeyDown` 必须是同一个函数引用
- 如果使用箭头函数，需要确保引用一致

**更好的实践（可选）：**

```typescript
// 使用 AbortController（现代浏览器）
const controller = new AbortController()

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown, {
    signal: controller.signal
  })
})

onUnmounted(() => {
  controller.abort() // 自动移除所有相关监听器
})
```

---

## 4. 性能优化

### Q4.1: 解释 `sessionStorage` 缓存策略，为什么使用它而不是 `localStorage`？

**考察点：** 浏览器存储 API 的选择与性能优化

**参考答案：**

**sessionStorage vs localStorage：**

| 特性 | sessionStorage | localStorage |
|------|----------------|--------------|
| 生命周期 | 标签页关闭后清除 | 永久存储（除非手动清除） |
| 作用域 | 单个标签页 | 同源所有标签页共享 |
| 容量 | ~5-10MB | ~5-10MB |
| 性能 | 相同 | 相同 |

**为什么使用 sessionStorage：**

1. **临时缓存**：数据只在当前会话有效，刷新后重新加载最新数据
2. **避免数据过期**：不会出现长期缓存导致的数据不一致
3. **隐私考虑**：关闭标签页后自动清除，更安全

**在 Wardrobe.vue 中的使用：**

```typescript
// 保存到 sessionStorage
const saveItemsToCache = () => {
  try {
    sessionStorage.setItem('wardrobe_items_cache', 
      JSON.stringify(uploadedItems.value)
    )
  } catch (e) {
    console.warn('Failed to save items to sessionStorage:', e)
  }
}

// 恢复 from sessionStorage
const restoreItemsFromCache = () => {
  try {
    const cached = sessionStorage.getItem('wardrobe_items_cache')
    if (cached) {
      const items = JSON.parse(cached)
      if (Array.isArray(items) && items.length > 0) {
        uploadedItems.value = items
        hasLoadedItems.value = true
        return true
      }
    }
  } catch (e) {
    console.warn('Failed to restore items from sessionStorage:', e)
  }
  return false
}
```

**优化效果：**
- 页面刷新时，无需等待网络请求，立即显示缓存数据
- 后台异步加载最新数据，提升用户体验

---

### Q4.2: 解释文件签名去重的实现原理和优势

**考察点：** 防重复上传的算法设计

**参考答案：**

**文件签名生成：**

```typescript
const getFileSignature = (file: File) => 
  `${file.name}-${file.size}-${file.lastModified}`
```

**原理：**
- 使用文件名、大小、最后修改时间组合成唯一标识
- 相同文件（即使路径不同）会有相同的签名

**优势：**
1. **快速检测**：O(1) 查找（使用 Set）
2. **内存效率**：只存储字符串，不存储文件内容
3. **准确性**：三个属性组合，重复概率极低

**实现：**

```typescript
const uploadedFileSignatures = new Set<string>()
const pendingUploadSignatures = new Set<string>()

// 检查重复
if (uploadedFileSignatures.has(signature) || 
    pendingUploadSignatures.has(signature)) {
  duplicateFiles.push(`${file.name} (already uploaded)`)
}

// 添加到待上传集合
pendingUploadSignatures.add(signature)

// 上传成功后移动到已上传集合
uploadedFileSignatures.add(signature)
pendingUploadSignatures.delete(signature)
```

**边界情况处理：**
- 上传失败时，从 `pendingUploadSignatures` 中移除
- 避免误判为重复

---

### Q4.3: 为什么使用 `computed` 而不是方法来实现 `filteredItems`？

**考察点：** 计算属性 vs 方法的性能差异

**参考答案：**

**computed 的优势：**

1. **缓存机制**：只有依赖变化时才重新计算
2. **性能优化**：模板中多次使用不会重复计算
3. **响应式追踪**：自动追踪依赖，无需手动管理

**方法的问题：**

```typescript
// 不推荐：每次渲染都会执行
const getFilteredItems = () => {
  return uploadedItems.value.filter(...)
}
```

**性能对比：**

假设模板中有 3 处使用 `filteredItems`：

```vue
<!-- 使用 computed -->
<div>{{ filteredItems.length }}</div>
<div v-for="item in filteredItems">...</div>
<div>Total: {{ filteredItems.length }}</div>
<!-- 只计算一次 -->
```

```vue
<!-- 使用方法 -->
<div>{{ getFilteredItems().length }}</div>
<div v-for="item in getFilteredItems()">...</div>
<div>Total: {{ getFilteredItems().length }}</div>
<!-- 计算 3 次！ -->
```

**在 Wardrobe.vue 中：**

```typescript
const filteredItems = computed(() => {
  return uploadedItems.value.filter((item) => 
    matchesCategory(item.features.type, selectedFilter.value)
  )
})
```

**何时使用方法：**
- 需要传递参数
- 不需要缓存（每次调用都需要最新结果）
- 不依赖响应式数据

---

## 5. 错误处理与用户体验

### Q5.1: 分析 `loadUserItems` 函数的错误处理策略

**考察点：** 错误分类与用户友好的错误提示

**参考答案：**

**错误分类处理：**

```typescript
catch (error: any) {
  let errorMessage = 'Unknown error'
  
  // 1. 网络错误
  if (error?.code === 'ERR_NETWORK' || 
      error?.message?.includes('Network Error')) {
    errorMessage = `Cannot reach backend service. Please ensure ${API_URL} is running.`
  }
  
  // 2. 超时错误
  else if (error?.code === 'ECONNABORTED' || 
           error?.message?.includes('timeout')) {
    errorMessage = 'Request timed out; backend may still be initializing. Wait a moment and refresh.'
  }
  
  // 3. 认证错误
  else if (error?.response?.status === 401) {
    errorMessage = 'Authentication failed. Please sign in again.'
  }
  
  // 4. 服务不可用
  else if (error?.response?.status === 503) {
    errorMessage = 'Backend is initializing; please wait a moment and refresh.'
  }
  
  // 5. 后端返回的错误信息
  else if (error?.response?.data?.detail) {
    errorMessage = error.response.data.detail
  }
  
  // 6. 通用错误
  else if (error?.message) {
    errorMessage = error.message
  }
  
  alert(`Failed to load wardrobe data: ${errorMessage}\n\nCheck that the backend is running, or refresh and retry.`)
}
```

**设计原则：**
1. **分类处理**：不同错误类型给出不同提示
2. **用户友好**：提供可操作的建议
3. **降级处理**：即使无法识别错误，也给出通用提示
4. **技术细节**：在控制台记录详细错误，用户看到简化版本

**改进建议（可选）：**
- 使用 Toast 通知替代 `alert`
- 添加重试按钮
- 显示错误图标和状态码

---

### Q5.2: 解释上传进度显示的实现原理

**考察点：** 用户体验优化，进度反馈

**参考答案：**

**实现原理：**

```typescript
const uploadProgress = ref<{ 
  current: number; 
  total: number; 
  currentFile: string 
} | null>(null)

// 上传前初始化
uploadProgress.value = {
  current: 0,
  total: fileArray.length,
  currentFile: fileArray[0]?.name || '',
}

// 每个文件上传时更新
for (let i = 0; i < fileArray.length; i++) {
  uploadProgress.value = {
    current: i + 1,
    total: fileArray.length,
    currentFile: file.name,
  }
  // 上传文件...
}

// 上传完成后清除
uploadProgress.value = null
```

**模板中的显示：**

```vue
<div v-if="isUploading && uploadProgress" class="...">
  <div class="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
  <span class="text-sm text-gray-500">
    Uploading {{ uploadProgress.current }}/{{ uploadProgress.total }}
  </span>
  <span class="text-xs text-gray-400">{{ uploadProgress.currentFile }}</span>
</div>
```

**用户体验优化：**
1. **实时反馈**：显示当前进度和文件名
2. **视觉指示**：加载动画 + 文字说明
3. **状态区分**：上传中 vs 分析中（不同的提示）

**改进建议（可选）：**
- 使用 `axios` 的 `onUploadProgress` 获取真实上传进度
- 显示百分比进度条
- 支持取消上传

---

### Q5.3: 为什么需要 `checkBackendHealth` 函数？解释重试机制

**考察点：** 后端健康检查与容错设计

**参考答案：**

**问题背景：**
- 后端启动需要时间（加载模型、初始化数据库）
- 直接请求可能失败，需要等待后端就绪

**实现：**

```typescript
const checkBackendHealth = async (
  maxRetries = 5, 
  delay = 1000
): Promise<boolean> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await apiClient.get('/health', {
        timeout: 5000,
      })
      if (response.data.status === 'ready') {
        return true
      }
      // 仍在初始化，等待后重试
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    } catch (error) {
      // 健康检查失败，等待后重试
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  return false
}
```

**设计要点：**
1. **指数退避**：可以改进为指数退避（当前是固定延迟）
2. **快速失败**：5 次重试后放弃，避免无限等待
3. **超时控制**：每次请求 5 秒超时
4. **优雅降级**：即使健康检查失败，也尝试加载数据

**使用场景：**

```typescript
const loadUserItems = async () => {
  // 先检查后端是否就绪
  const isReady = await checkBackendHealth()
  if (!isReady) {
    console.warn('Backend is still initializing, but attempting to load items anyway...')
  }
  // 继续加载数据...
}
```

**改进建议（可选）：**
- 使用指数退避：`delay * Math.pow(2, i)`
- 显示健康检查状态给用户
- 使用 WebSocket 监听后端就绪事件

---

## 6. 状态管理与数据持久化

### Q6.1: 解释 `localStorage` 和 `sessionStorage` 的混合使用策略

**考察点：** 不同存储 API 的选择依据

**参考答案：**

**在 Wardrobe.vue 中的使用：**

```typescript
// localStorage：跨页面持久化（与 Studio.vue 同步）
const loadOutfitSelection = () => {
  const saved = localStorage.getItem('fashion_rec_selected_items')
  if (saved) {
    const ids = JSON.parse(saved)
    selectedForOutfitIds.value = new Set(ids)
  }
}

// sessionStorage：临时缓存（页面刷新时快速恢复）
const saveItemsToCache = () => {
  sessionStorage.setItem('wardrobe_items_cache', 
    JSON.stringify(uploadedItems.value)
  )
}
```

**选择依据：**

| 存储 | 用途 | 原因 |
|------|------|------|
| `localStorage` | 选择状态（`fashion_rec_selected_items`） | 跨页面同步（Wardrobe ↔ Studio） |
| `sessionStorage` | 物品缓存（`wardrobe_items_cache`） | 临时缓存，刷新后重新加载最新数据 |

**设计原则：**
1. **localStorage**：需要跨页面/会话持久化的数据
2. **sessionStorage**：临时缓存，避免数据过期

**潜在问题：**
- `localStorage` 数据可能过期（后端数据已删除）
- 需要定期验证数据有效性

---

### Q6.2: 解释跨组件状态同步的实现（Wardrobe ↔ Studio）

**考察点：** 组件间通信与状态同步

**参考答案：**

**实现方式：** 使用 `localStorage` 作为共享存储

**Wardrobe.vue 中的实现：**

```typescript
// 保存选择状态
const toggleOutfitSelection = (itemId: string, event?: Event) => {
  if (selectedForOutfitIds.value.has(itemId)) {
    selectedForOutfitIds.value.delete(itemId)
  } else {
    selectedForOutfitIds.value.add(itemId)
  }
  
  // 保存到 localStorage
  localStorage.setItem(
    'fashion_rec_selected_items', 
    JSON.stringify(Array.from(selectedForOutfitIds.value))
  )
}

// 加载选择状态
const loadOutfitSelection = () => {
  const saved = localStorage.getItem('fashion_rec_selected_items')
  if (saved) {
    const ids = JSON.parse(saved)
    selectedForOutfitIds.value = new Set(ids)
  }
}

// 在多个时机加载
onMounted(() => {
  loadOutfitSelection()
})

onActivated(() => {
  loadOutfitSelection() // 从 Studio 返回时重新加载
})

watch(() => route.name, (newName) => {
  if (newName === 'wardrobe') {
    loadOutfitSelection() // 路由变化时重新加载
  }
})
```

**同步机制：**
1. **写入**：选择/取消时立即写入 `localStorage`
2. **读取**：组件激活、路由变化时重新读取
3. **实时性**：虽然不是实时同步，但切换页面时会同步

**改进建议（可选）：**
- 使用 `storage` 事件监听跨标签页变化
- 使用 Pinia/Vuex 进行全局状态管理
- 使用 EventBus（简单场景）

---

## 7. 代码质量与最佳实践

### Q7.1: 分析代码中的类型安全问题

**考察点：** TypeScript 类型安全实践

**参考答案：**

**问题 1：`any` 类型的使用**

```typescript
catch (error: any) {
  // error 被声明为 any，失去了类型安全
}
```

**改进：**

```typescript
catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message)
  } else if (axios.isAxiosError(error)) {
    // 处理 axios 错误
    const status = error.response?.status
    const detail = error.response?.data?.detail
  }
}
```

**问题 2：可选链和空值合并**

```typescript
// 当前实现（良好）
const url = item.path || item.url || ''

// 更安全的写法
const url = item.path ?? item.url ?? ''
```

**问题 3：类型断言**

```typescript
// 当前实现
const target = event.target as HTMLInputElement

// 更安全的类型守卫
const target = event.target
if (target instanceof HTMLInputElement) {
  // 使用 target
}
```

---

### Q7.2: 解释事件处理中的 `event.stopPropagation()` 使用

**考察点：** 事件冒泡与事件委托

**参考答案：**

**问题场景：**
- 卡片点击：打开图片查看器
- 按钮点击：选择/取消选择
- 需要阻止事件冒泡，避免触发父元素事件

**实现：**

```typescript
const toggleOutfitSelection = (itemId: string, event?: Event) => {
  if (event) {
    event.stopPropagation() // 阻止冒泡到卡片
  }
  // 切换选择状态...
}

// 模板中
<button
  @click.stop="toggleOutfitSelection(String(item.id), $event)"
  class="..."
>
```

**事件流：**
```
点击按钮
  ↓
按钮的 click 事件触发
  ↓
event.stopPropagation() 阻止冒泡
  ↓
卡片的 click 事件不会触发 ✅
```

**如果不使用 `stopPropagation`：**
- 点击按钮会同时触发按钮和卡片的事件
- 导致打开图片查看器的同时切换选择状态（不符合预期）

**其他使用场景：**
```typescript
// 选择模式下的点击
@click="isSelectionMode ? toggleItemSelection(String(item.id), $event) : openImageViewer(index, $event)"

// 在 toggleItemSelection 中
if (event) {
  event.stopPropagation() // 避免触发卡片点击
}
```

---

### Q7.3: 分析代码中的潜在性能问题

**考察点：** 性能优化意识

**参考答案：**

**问题 1：大量图片渲染**

```vue
<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
  <div v-for="(item, index) in filteredItems" :key="item.id">
    <img :src="item.url || item.features.path" />
  </div>
</div>
```

**潜在问题：**
- 1000+ 图片同时渲染，可能导致卡顿
- 没有图片懒加载

**改进建议：**
```vue
<img 
  v-lazy="item.url || item.features.path"
  loading="lazy"
  class="..."
/>
```

**问题 2：频繁的 localStorage 写入**

```typescript
// 每次选择都写入 localStorage
localStorage.setItem('fashion_rec_selected_items', ...)
```

**改进建议：**
- 使用防抖（debounce）延迟写入
- 或使用 `watch` 监听变化，批量写入

**问题 3：没有虚拟滚动**

如果物品数量很大（1000+），考虑使用虚拟滚动：
```vue
<VirtualList
  :items="filteredItems"
  :item-height="300"
>
  <template #default="{ item }">
    <!-- 渲染单个物品 -->
  </template>
</VirtualList>
```

---

## 8. 实际场景问题

### Q8.1: 如果用户上传了 1000 张图片，如何优化加载和渲染性能？

**考察点：** 大规模数据处理的实践经验

**参考答案：**

**1. 分页加载**
```typescript
const pageSize = 50
const currentPage = ref(1)
const displayedItems = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredItems.value.slice(start, start + pageSize)
})
```

**2. 虚拟滚动**
- 使用 `vue-virtual-scroller` 或 `vue-virtual-scroll-list`
- 只渲染可见区域的元素

**3. 图片懒加载**
```vue
<img 
  v-lazy="item.url"
  loading="lazy"
  decoding="async"
/>
```

**4. 图片优化**
- 使用 WebP 格式
- 生成缩略图
- CDN 加速

**5. 防抖搜索/过滤**
```typescript
import { debounce } from 'lodash-es'

const debouncedFilter = debounce((value: string) => {
  selectedFilter.value = value
}, 300)
```

**6. 使用 Web Worker**
- 将过滤逻辑移到 Web Worker
- 避免阻塞主线程

---

### Q8.2: 如何实现断点续传功能？

**考察点：** 文件上传的高级特性

**参考答案：**

**实现思路：**

1. **文件分片**
```typescript
const chunkSize = 2 * 1024 * 1024 // 2MB
const chunks = Math.ceil(file.size / chunkSize)

for (let i = 0; i < chunks; i++) {
  const start = i * chunkSize
  const end = Math.min(start + chunkSize, file.size)
  const chunk = file.slice(start, end)
  // 上传分片
}
```

2. **记录上传进度**
```typescript
const uploadProgress = ref<Map<string, number>>(new Map())

// 保存到 localStorage
localStorage.setItem('upload_progress', JSON.stringify({
  fileSignature: getFileSignature(file),
  uploadedChunks: [0, 1, 2, ...], // 已上传的分片索引
}))
```

3. **恢复上传**
```typescript
const resumeUpload = async (file: File) => {
  const progress = JSON.parse(
    localStorage.getItem('upload_progress') || '{}'
  )
  const uploadedChunks = progress.uploadedChunks || []
  
  // 只上传未完成的分片
  for (let i = 0; i < chunks; i++) {
    if (!uploadedChunks.includes(i)) {
      await uploadChunk(file, i)
    }
  }
}
```

4. **后端支持**
- 支持分片上传 API
- 支持合并分片
- 支持查询上传进度

---

### Q8.3: 如何实现拖拽上传功能？

**考察点：** 原生 API 的使用

**参考答案：**

**实现：**

```vue
<div
  @drop="handleDrop"
  @dragover.prevent
  @dragenter.prevent
  @dragleave.prevent
  class="..."
>
  <!-- 上传区域 -->
</div>
```

```typescript
const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    // 转换为 FileList，触发现有的上传逻辑
    const fileInput = fileInputRef.value
    if (fileInput) {
      // 创建新的 FileList（需要 polyfill 或使用 DataTransfer）
      const dataTransfer = new DataTransfer()
      Array.from(files).forEach(file => {
        dataTransfer.items.add(file)
      })
      fileInput.files = dataTransfer.files
      
      // 触发 change 事件
      const changeEvent = new Event('change', { bubbles: true })
      fileInput.dispatchEvent(changeEvent)
    }
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  // 添加视觉反馈
}

const handleDragEnter = (event: DragEvent) => {
  event.preventDefault()
  // 添加高亮样式
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  // 移除高亮样式
}
```

**用户体验优化：**
- 拖拽时显示视觉反馈（边框高亮、背景色变化）
- 支持拖拽多个文件
- 拖拽到无效区域时显示提示

---

## 🎯 总结

这些面试题涵盖了：

1. **Vue 3 核心概念**：Composition API、生命周期、响应式系统
2. **性能优化**：计算属性、缓存策略、懒加载
3. **错误处理**：分类处理、用户友好提示
4. **状态管理**：跨组件同步、数据持久化
5. **代码质量**：类型安全、事件处理、最佳实践
6. **实际场景**：大规模数据处理、高级特性实现

**学习建议：**
- 深入理解 Vue 3 的响应式原理
- 掌握 TypeScript 的类型系统
- 关注用户体验和性能优化
- 实践复杂场景的解决方案

---

**祝你面试顺利！** 🚀

