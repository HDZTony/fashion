# 国际化多语言支持指南

本项目已集成 vue-i18n v11，支持中英文双语切换。

## 功能特性

- ✅ 支持中文（简体）和英文
- ✅ 自动检测浏览器语言
- ✅ 语言设置持久化（localStorage）
- ✅ 语言切换组件
- ✅ 响应式语言切换（无需刷新页面）

## 使用方法

### 在组件中使用翻译

#### 1. 在 `<script setup>` 中使用 Composition API

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// 使用翻译
const message = t('common.loading')
</script>
```

#### 2. 在模板中使用

```vue
<template>
  <!-- 使用 $t 函数 -->
  <h1>{{ $t('home.title') }}</h1>
  
  <!-- 在属性中使用 -->
  <button :title="$t('common.save')">
    {{ $t('common.save') }}
  </button>
</template>
```

### 切换语言

语言切换组件已集成到导航栏中。用户可以通过点击语言切换器来选择语言。

### 编程式切换语言

```typescript
import { setLocale } from '@/i18n'

// 切换到中文
setLocale('zh')

// 切换到英文
setLocale('en')
```

## 语言文件结构

语言文件位于 `src/i18n/locales/` 目录：

- `en.json` - 英文翻译
- `zh.json` - 中文翻译

### 添加新的翻译键

1. 在 `en.json` 中添加英文翻译
2. 在 `zh.json` 中添加对应的中文翻译
3. 在组件中使用 `$t('your.key.path')` 或 `t('your.key.path')`

### 翻译键命名规范

使用点分隔的层级结构，按功能模块组织：

```json
{
  "common": {
    "loading": "Loading...",
    "save": "Save"
  },
  "wardrobe": {
    "title": "My Wardrobe",
    "uploadItems": "Upload Items"
  }
}
```

## 已翻译的模块

- ✅ 导航栏（AppLayout, HomeLayout）
- ✅ 首页（Home.vue）- 部分内容
- ✅ 衣橱页面（Wardrobe.vue）- 部分内容
- ✅ 通用组件（LanguageSwitcher）

## 待完善

以下模块的翻译可以逐步完善：

- Studio 页面
- Favorites 页面
- Try-On History 页面
- Profile 页面
- Login 页面
- 错误消息
- 表单验证消息

## 注意事项

1. **响应式更新**：使用 `computed` 包装翻译内容，确保语言切换时自动更新
2. **类型安全**：TypeScript 会检查翻译键是否存在
3. **默认语言**：如果翻译键不存在，会显示键名本身
4. **语言检测**：首次访问时会根据浏览器语言自动选择

## 示例

### 在计算属性中使用

```typescript
const buttonText = computed(() => {
  return isAuthenticated.value 
    ? t('home.enterStudio') 
    : t('home.startForFree')
})
```

### 在数组中使用

```typescript
const faqs = computed(() => [
  {
    question: t('home.faq.q1'),
    answer: t('home.faq.a1')
  },
  // ...
])
```

### 带参数的翻译（未来扩展）

vue-i18n 支持参数化翻译，例如：

```json
{
  "welcome": "Welcome, {name}!"
}
```

使用：
```typescript
t('welcome', { name: 'John' })
```

## 故障排除

### 翻译不显示

1. 检查翻译键是否正确
2. 确认语言文件中存在该键
3. 检查控制台是否有错误

### 语言切换不生效

1. 确认已调用 `setLocale()` 函数
2. 检查 localStorage 是否正常工作
3. 确认组件使用了响应式的翻译（computed 或 $t）

## 贡献

添加新语言：

1. 在 `src/i18n/locales/` 创建新的语言文件（如 `fr.json`）
2. 在 `src/i18n/index.ts` 中导入并添加到 messages
3. 在 `LanguageSwitcher.vue` 中添加语言选项
