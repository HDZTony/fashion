# Home.vue 前端面试问题与答案

## 目录
1. [Vue 3 Composition API](#vue-3-composition-api)
2. [TypeScript 使用](#typescript-使用)
3. [SEO 优化](#seo-优化)
4. [响应式设计](#响应式设计)
5. [可访问性 (A11y)](#可访问性-a11y)
6. [性能优化](#性能优化)
7. [代码组织与最佳实践](#代码组织与最佳实践)

---

## Vue 3 Composition API

### Q1: 为什么使用 `<script setup>` 而不是 Options API？有什么优势？

**答案：**
- **更简洁的语法**：不需要显式返回，变量和函数自动暴露给模板
- **更好的 TypeScript 支持**：类型推断更准确，无需额外的类型声明
- **更好的逻辑复用**：通过 composables 更容易提取和复用逻辑
- **更好的性能**：编译时优化，减少运行时开销
- **更符合函数式编程思想**：代码组织更清晰

**代码示例：**
```typescript
// <script setup> 自动暴露，无需 return
const buttonText = computed(() => {
  return isAuthenticated.value ? 'Enter Studio' : 'Start for Free'
})

// Options API 需要显式返回
export default {
  computed: {
    buttonText() {
      return this.isAuthenticated ? 'Enter Studio' : 'Start for Free'
    }
  }
}
```

---

### Q2: `defineOptions` 的作用是什么？为什么要使用它？

**答案：**
- `defineOptions` 用于定义组件选项，如组件名称、继承、混入等
- 在 `<script setup>` 中无法直接使用 `export default`，所以用 `defineOptions` 来设置组件名
- 组件名主要用于：
  - Vue DevTools 调试时显示
  - 递归组件引用自身
  - 动态组件 `keep-alive` 的 include/exclude

**代码位置：**
```11:11:Home.vue
defineOptions({ name: 'Home' })
```

---

### Q3: `computed` 和普通函数有什么区别？为什么这里用 `computed`？

**答案：**
- **响应式缓存**：`computed` 会缓存结果，只有依赖的响应式数据变化时才重新计算
- **性能优化**：避免不必要的重复计算
- **自动追踪依赖**：Vue 会自动追踪依赖，无需手动管理

**代码示例：**
```25:27:Home.vue
const buttonText = computed(() => {
  return isAuthenticated.value ? 'Enter Studio' : 'Start for Free'
})
```

**如果使用普通函数：**
```typescript
// ❌ 每次渲染都会执行，即使 isAuthenticated 没变化
const buttonText = () => {
  return isAuthenticated.value ? 'Enter Studio' : 'Start for Free'
}

// ✅ computed 会缓存结果
const buttonText = computed(() => {
  return isAuthenticated.value ? 'Enter Studio' : 'Start for Free'
})
```

---

### Q4: 为什么在 `handleGetStarted` 中使用 `.value` 访问 `isAuthenticated`？

**答案：**
- `isAuthenticated` 是一个 `computed` ref，在 JavaScript 中访问 ref 需要使用 `.value`
- 在模板中 Vue 会自动解包 ref，所以模板中可以直接使用 `isAuthenticated`
- 这是 Vue 3 响应式系统的设计：区分 ref 和普通值

**代码位置：**
```17:23:Home.vue
const handleGetStarted = () => {
  if (isAuthenticated.value) {
    router.push('/studio')
  } else {
    router.push('/login')
  }
}
```

---

## TypeScript 使用

### Q5: 这个文件使用了 TypeScript，但为什么很多地方没有显式类型注解？

**答案：**
- **类型推断**：TypeScript 可以根据上下文自动推断类型
- **代码简洁性**：避免冗余的类型声明
- **最佳实践**：只在必要时添加类型注解（如函数参数、复杂类型、公共 API）

**示例：**
```typescript
// ✅ 类型推断，无需显式声明
const router = useRouter()  // 推断为 Router 类型
const faqs = [...]          // 推断为数组类型

// ✅ 需要显式类型的情况
function useSEO(options: SEOOptions = {}) {  // 参数需要类型
  // ...
}
```

---

## SEO 优化

### Q6: 这个页面做了哪些 SEO 优化？

**答案：**

1. **Meta 标签优化**（通过 `useSEO` composable）：
   - `title`、`description`、`keywords`
   - Open Graph 标签（`og:title`, `og:description`, `og:image`）
   - Twitter Card 标签
   - Canonical URL

2. **结构化数据（Schema.org）**：
   - FAQPage 结构化数据，帮助搜索引擎理解内容
   - 使用 JSON-LD 格式注入到页面

3. **语义化 HTML**：
   - 使用 `<header>`, `<main>`, `<section>`, `<footer>` 等语义标签

**代码位置：**
```57:62:Home.vue
useSEO({
  title: 'Fashion Rec | Virtual Try-On & Smart Outfit Recommendations',
  description: 'Build your AI-powered wardrobe, try on outfits virtually, and get personalized recommendations instantly.',
  path: '/',
  image: `${siteBaseUrl}/images/brand/hdz.png`,
})
```

```64:86:Home.vue
const faqSchema = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}))

const faqJsonLd = computed(() => JSON.stringify(faqSchema.value))

useHead({
  script: [
    {
      type: 'application/ld+json',
      children: faqJsonLd.value,
    },
  ],
})
```

---

### Q7: 为什么要使用 JSON-LD 格式的结构化数据？有什么优势？

**答案：**
- **搜索引擎友好**：Google、Bing 等搜索引擎更容易理解和索引
- **不影响页面展示**：JSON-LD 是独立的脚本标签，不影响 HTML 结构
- **易于维护**：结构化数据集中管理，便于更新
- **丰富搜索结果**：可能显示为富媒体结果（如 FAQ 折叠展示）

**对比其他格式：**
- **Microdata**：需要修改 HTML 结构，维护成本高
- **RDFa**：语法复杂，学习曲线陡峭
- **JSON-LD**：✅ 推荐，独立、易维护

---

## 响应式设计

### Q8: 这个页面如何实现响应式设计？

**答案：**

1. **Tailwind CSS 响应式类**：
   - `sm:`, `md:`, `lg:` 等断点前缀
   - 移动优先设计

2. **Grid 布局**：
   ```117:117:Home.vue
   <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
   ```
   - 移动端：1 列
   - 中等屏幕及以上：3 列

3. **响应式间距**：
   ```92:92:Home.vue
   <main class="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
   ```
   - 不同屏幕使用不同的 padding

4. **响应式字体**：
   ```95:95:Home.vue
   <h1 class="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
   ```
   - 移动端：`text-4xl`
   - 小屏幕及以上：`text-6xl`

---

### Q9: `aspect-[5/8]` 这个 Tailwind 类的作用是什么？

**答案：**
- 设置元素的宽高比为 5:8（竖版比例）
- 确保图片容器在不同屏幕尺寸下保持一致的宽高比
- 避免布局抖动（CLS - Cumulative Layout Shift）

**代码位置：**
```120:120:Home.vue
<div class="aspect-[5/8] bg-gray-100 flex items-center justify-center">
```

**为什么重要：**
- 提升用户体验：避免内容加载时的布局跳动
- SEO 优化：CLS 是 Core Web Vitals 指标之一
- 视觉一致性：保持卡片比例统一

---

## 可访问性 (A11y)

### Q10: 这个页面做了哪些可访问性优化？

**答案：**

1. **ARIA 标签**：
   ```94:94:Home.vue
   <header class="text-center py-20" aria-label="Hero section">
   ```
   ```106:106:Home.vue
   aria-label="Get started with Fashion Rec"
   ```

2. **语义化 HTML**：
   - 使用 `<header>`, `<main>`, `<section>`, `<footer>`
   - 正确的标题层级（`h1`, `h2`, `h3`）

3. **图片 alt 属性**：
   ```123:123:Home.vue
   alt="Person organizing wardrobe to avoid duplicate purchases"
   ```

4. **链接可访问性**：
   ```241:241:Home.vue
   rel="noopener noreferrer"
   ```
   - `noopener`：防止新页面访问 `window.opener`
   - `noreferrer`：不发送 referrer 信息

5. **SVG 图标**：
   ```177:177:Home.vue
   <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
   ```
   - `aria-hidden="true"`：装饰性图标对屏幕阅读器隐藏

---

### Q11: 为什么外部链接要使用 `rel="noopener noreferrer"`？

**答案：**

1. **安全性（noopener）**：
   - 防止新页面通过 `window.opener` 访问原页面
   - 避免标签页劫持攻击（Tabnabbing）

2. **隐私保护（noreferrer）**：
   - 不向目标网站发送 referrer 信息
   - 保护用户隐私

**代码位置：**
```238:242:Home.vue
<a
  href="https://x.com"
  target="_blank"
  rel="noopener noreferrer"
  class="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white transition-colors"
  aria-label="X"
>
```

---

## 性能优化

### Q12: 这个页面有哪些性能优化的考虑？

**答案：**

1. **图片优化**：
   - 使用 WebP 等现代格式（虽然代码中未显式指定，但可以通过构建工具优化）
   - 正确的 `alt` 属性有助于 SEO 和可访问性

2. **CSS 优化**：
   - 使用 Tailwind CSS，只打包使用的样式
   - 响应式类在编译时优化

3. **JavaScript 优化**：
   - `computed` 缓存减少重复计算
   - 组件懒加载（通过 Vue Router）

4. **SEO 优化**：
   - 结构化数据帮助搜索引擎快速理解内容
   - 正确的 meta 标签减少爬虫工作量

**可以进一步优化：**
- 图片懒加载（`loading="lazy"`）
- 关键 CSS 内联
- 代码分割和路由懒加载

---

### Q13: 为什么 FAQ 数据要放在组件内部而不是外部文件？

**答案：**

**当前实现（组件内部）：**
```30:55:Home.vue
const faqs = [
  {
    question: 'What is the difference between Fashion Rec and the many similar services already available in the market?',
    answer: '1. Fashion Rec is a service designed for individual users. 2. It features a smart wardrobe for convenient personal clothing management. 3. It is affordable, and free users can also enjoy full functionality.'
  },
  // ...
]
```

**优缺点分析：**

✅ **优点：**
- 简单直接，数据就在使用的地方
- 适合少量静态数据
- 无需额外的导入

❌ **缺点：**
- 如果 FAQ 很多，会让组件文件过长
- 不利于复用和维护
- 如果 FAQ 需要从 API 获取，需要重构

**更好的实践：**
```typescript
// ✅ 如果 FAQ 很多或需要复用
import { faqs } from '@/data/faqs'

// ✅ 如果需要从 API 获取
const { data: faqs } = await useFetch('/api/faqs')
```

---

## 代码组织与最佳实践

### Q14: 这个组件使用了哪些 Composables？为什么要这样组织代码？

**答案：**

使用的 Composables：
1. `useRouter` - Vue Router 提供的路由功能
2. `useAuthState` - 自定义的认证状态管理
3. `useSEO` - 自定义的 SEO 管理
4. `useHead` - VueUse 提供的 head 管理

**为什么使用 Composables：**

1. **关注点分离**：
   - 认证逻辑 → `useAuthState`
   - SEO 逻辑 → `useSEO`
   - 路由逻辑 → `useRouter`

2. **代码复用**：
   - 其他页面也可以使用 `useAuthState` 和 `useSEO`
   - 避免重复代码

3. **可测试性**：
   - Composables 可以独立测试
   - 组件逻辑更清晰

4. **可维护性**：
   - 修改认证逻辑只需改 `useAuthState`
   - 不影响组件其他部分

**代码位置：**
```13:15:Home.vue
const router = useRouter()

const { isAuthenticated } = useAuthState()
```

```57:62:Home.vue
useSEO({
  title: 'Fashion Rec | Virtual Try-On & Smart Outfit Recommendations',
  description: 'Build your AI-powered wardrobe, try on outfits virtually, and get personalized recommendations instantly.',
  path: '/',
  image: `${siteBaseUrl}/images/brand/hdz.png`,
})
```

---

### Q15: `v-for` 中使用 `index` 作为 `key` 是否合适？为什么？

**答案：**

**当前实现：**
```214:216:Home.vue
<AccordionItem
  v-for="(faq, index) in faqs"
  :key="`item-${index}`"
```

**分析：**

✅ **适合的情况（当前场景）：**
- FAQ 列表是静态的，不会重新排序
- 不会添加/删除中间项
- 列表顺序固定

❌ **不适合的情况：**
- 列表会重新排序 → 应该用唯一 ID
- 会动态添加/删除 → 应该用唯一 ID
- 列表项有状态（如输入框）→ 应该用唯一 ID

**最佳实践：**
```typescript
// ✅ 如果有唯一标识符
const faqs = [
  { id: 'faq-1', question: '...', answer: '...' },
  { id: 'faq-2', question: '...', answer: '...' },
]

// 使用
:key="faq.id"

// ✅ 如果确实没有唯一标识，且列表稳定
:key="index"  // 可以接受
```

**当前代码可以改进为：**
```typescript
const faqs = [
  { id: 'difference', question: '...', answer: '...' },
  { id: 'how-to-use', question: '...', answer: '...' },
  // ...
]

// 使用
:key="faq.id"
```

---

### Q16: 这个组件的代码组织有什么可以改进的地方？

**答案：**

**当前结构：**
1. Imports
2. defineOptions
3. 响应式数据/计算属性
4. 方法
5. FAQ 数据
6. SEO 配置
7. 结构化数据

**改进建议：**

1. **提取常量**：
   ```typescript
   // ✅ 将 FAQ 数据提取到单独文件
   // src/data/faqs.ts
   export const faqs = [...]
   ```

2. **逻辑分组**：
   ```typescript
   // ✅ 使用注释分组
   // ====== Router & Navigation ======
   const router = useRouter()
   const handleGetStarted = () => { ... }
   
   // ====== Authentication ======
   const { isAuthenticated } = useAuthState()
   
   // ====== SEO & Meta ======
   useSEO({ ... })
   ```

3. **提取复杂逻辑**：
   ```typescript
   // ✅ 将结构化数据生成提取到 composable
   // composables/useStructuredData.ts
   export function useStructuredData(data) {
     const schema = computed(() => ({ ... }))
     useHead({ script: [...] })
   }
   ```

---

## 综合问题

### Q17: 如果要优化这个页面的加载性能，你会怎么做？

**答案：**

1. **图片优化**：
   ```html
   <!-- ✅ 添加懒加载 -->
   <img loading="lazy" src="..." alt="..." />
   
   <!-- ✅ 使用现代格式 -->
   <img src="image.webp" srcset="image@2x.webp 2x" />
   ```

2. **代码分割**：
   ```typescript
   // ✅ 路由懒加载
   const Home = () => import('@/views/Home.vue')
   ```

3. **关键 CSS 内联**：
   - 首屏关键样式内联
   - 非关键样式异步加载

4. **预加载关键资源**：
   ```html
   <link rel="preload" href="/images/brand/hdz.png" as="image" />
   ```

5. **使用 CDN**：
   - 静态资源使用 CDN
   - 字体文件使用 CDN

6. **减少 JavaScript 体积**：
   - Tree-shaking
   - 按需导入组件库

---

### Q18: 这个页面如何适配暗色模式（Dark Mode）？

**答案：**

**当前实现：** 只支持亮色模式

**实现暗色模式的方法：**

1. **使用 Tailwind 暗色模式类**：
   ```html
   <div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
   ```

2. **使用 CSS 变量**：
   ```css
   :root {
     --bg-color: white;
     --text-color: #111827;
   }
   
   @media (prefers-color-scheme: dark) {
     :root {
       --bg-color: #111827;
       --text-color: white;
     }
   }
   ```

3. **使用 Vue 响应式切换**：
   ```typescript
   const isDark = ref(false)
   
   watch(isDark, (val) => {
     document.documentElement.classList.toggle('dark', val)
   })
   ```

**需要修改的地方：**
- 所有 `bg-white` → `bg-white dark:bg-gray-900`
- 所有 `text-gray-900` → `text-gray-900 dark:text-white`
- 所有 `bg-gray-50` → `bg-gray-50 dark:bg-gray-800`

---

## 总结

这个 `Home.vue` 组件展示了：
- ✅ Vue 3 Composition API 的正确使用
- ✅ TypeScript 的类型推断
- ✅ SEO 优化（meta 标签、结构化数据）
- ✅ 响应式设计（Tailwind CSS）
- ✅ 可访问性（ARIA、语义化 HTML）
- ✅ 代码组织（Composables）

**可以改进的地方：**
- FAQ 数据可以提取到单独文件
- 可以添加图片懒加载
- 可以支持暗色模式
- `v-for` 的 key 可以使用唯一 ID

---

## 面试技巧

1. **回答时先理解问题**：确认面试官问的是什么
2. **展示思考过程**：说明为什么这样设计
3. **提到权衡**：说明优缺点，展示技术判断力
4. **结合实际经验**：如果有类似项目经验，可以提及
5. **主动提出改进**：展示持续改进的思维

