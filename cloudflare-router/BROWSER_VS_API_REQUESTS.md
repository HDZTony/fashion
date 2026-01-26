# 浏览器页面请求 vs API 请求详解

## 📚 目录
1. [基本概念](#基本概念)
2. [浏览器页面请求](#浏览器页面请求)
3. [API 请求](#api-请求)
4. [详细对比](#详细对比)
5. [如何区分](#如何区分)
6. [在你的项目中的应用](#在你的项目中的应用)

---

## 基本概念

### 什么是浏览器页面请求？
当用户在浏览器地址栏输入 URL 或点击链接时，浏览器会发送一个**页面请求**，期望获得 HTML 页面来显示。

### 什么是 API 请求？
当 JavaScript 代码（如 Vue 组件）需要获取数据时，会发送一个**API 请求**，期望获得 JSON 数据。

---

## 浏览器页面请求

### 🔍 特点

**触发方式：**
- 用户在地址栏输入 URL
- 点击链接（`<a>` 标签）
- 刷新页面（F5 或 Ctrl+R）
- 浏览器前进/后退
- 直接访问 URL

**示例：**
```
用户在浏览器输入：https://fashion-rec.com/favorites
```

### 📝 HTTP 请求示例

```http
GET /favorites HTTP/1.1
Host: fashion-rec.com
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Accept-Encoding: gzip, deflate, br
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...
Cookie: auth_token=eyJhbGci...
```

**关键特征：**
- ✅ `Accept: text/html` - 期望获得 HTML 页面
- ✅ 浏览器自动发送 Cookie
- ✅ 通常包含完整的浏览器信息（User-Agent）
- ✅ 可能包含 Referer（来源页面）

### 💻 响应示例

```html
<!DOCTYPE html>
<html>
<head>
  <title>Favorites</title>
  <script src="/app.js"></script>
  <link rel="stylesheet" href="/app.css">
</head>
<body>
  <div id="app"></div>
</body>
</html>
```

**浏览器行为：**
1. 接收 HTML
2. 解析 HTML
3. 加载 CSS、JavaScript
4. 执行 JavaScript（Vue 应用）
5. 渲染页面

---

## API 请求

### 🔍 特点

**触发方式：**
- JavaScript 代码调用（`fetch()`, `axios.get()` 等）
- Vue 组件中的 `apiClient.get()`
- 前端应用需要数据时自动发送

**示例：**
```javascript
// 在 Favorites.vue 组件中
const response = await apiClient.get('/favorites')
```

### 📝 HTTP 请求示例

```http
GET /favorites HTTP/1.1
Host: fashion-rec.com
Accept: application/json, text/plain, */*
Accept-Language: zh-CN,zh;q=0.9
Authorization: Bearer eyJhbGci...
Content-Type: application/json
Referer: https://fashion.hdz73.com/favorites
```

**关键特征：**
- ✅ `Accept: application/json` - 期望获得 JSON 数据
- ✅ 通常包含 `Authorization` header（手动添加）
- ✅ 可能包含 `Content-Type: application/json`
- ✅ 由 JavaScript 代码发送

### 💻 响应示例

```json
{
  "favorites": [
    {
      "id": "8dadc6b1-88a4-47c0-9f97-641afb53e474",
      "user_id": "cfdbf997-329c-470d-b961-500fe7090655",
      "title": "Smart Casual Office Ready",
      "image_url": "https://...",
      "created_at": "2025-12-26T03:37:40.679188+00:00"
    }
  ]
}
```

**JavaScript 行为：**
1. 接收 JSON 数据
2. 解析 JSON
3. 更新 Vue 组件状态
4. 重新渲染 UI

---

## 详细对比

| 特性 | 浏览器页面请求 | API 请求 |
|------|---------------|----------|
| **触发方式** | 用户操作（输入URL、点击链接） | JavaScript 代码 |
| **Accept Header** | `text/html` | `application/json` |
| **期望响应** | HTML 页面 | JSON 数据 |
| **Cookie** | 浏览器自动发送 | 需要手动配置 |
| **Authorization** | 通常没有（或从Cookie） | 通常有（Bearer token） |
| **User-Agent** | 完整的浏览器信息 | 可能简化或没有 |
| **用途** | 加载页面 | 获取/更新数据 |
| **响应处理** | 浏览器渲染 HTML | JavaScript 处理 JSON |
| **路由** | 前端（Vue Router） | 后端 API |

---

## 如何区分

### 方法 1: 检查 Accept Header（最可靠）

```typescript
function isApiRequest(url: URL, request: Request): boolean {
  const acceptHeader = request.headers.get('Accept') || ''
  const isHtmlRequest = acceptHeader.includes('text/html')
  
  // 如果是 HTML 请求，路由到前端
  if (isHtmlRequest && !path.startsWith('/api/')) {
    return false  // 这是页面请求，不是 API
  }
  
  // 否则按路径判断
  return path.startsWith('/favorites') || ...
}
```

**为什么可靠？**
- 浏览器页面请求**总是**包含 `text/html`
- API 请求**通常**包含 `application/json`
- 这是 HTTP 标准行为

### 方法 2: 检查路径（辅助判断）

```typescript
// API 路径列表
const apiPaths = [
  '/api/',
  '/health',
  '/favorites',  // 注意：这个路径既可以是页面也可以是 API
  '/tryon-history',
  // ...
]
```

**局限性：**
- 某些路径（如 `/favorites`）既可以是页面也可以是 API
- 需要结合 Accept header 才能准确判断

### 方法 3: 检查请求来源

```typescript
// 检查是否是浏览器直接请求
const referer = request.headers.get('Referer')
const isDirectNavigation = !referer || referer.includes(origin)
```

**局限性：**
- 不够可靠
- 某些情况下可能误判

---

## 在你的项目中的应用

### 问题背景

**之前的问题：**
```
用户刷新 /favorites 页面
  ↓
路由器看到路径是 /favorites
  ↓
判断为 API 请求（因为 /favorites 在 API 路径列表中）
  ↓
路由到后端 API
  ↓
返回 JSON 数据
  ↓
浏览器显示 JSON（而不是页面）❌
```

### 解决方案

**现在的逻辑：**
```typescript
function isApiRequest(url: URL, request: Request): boolean {
  const path = url.pathname
  const acceptHeader = request.headers.get('Accept') || ''
  const isHtmlRequest = acceptHeader.includes('text/html')
  
  // 关键：如果是 HTML 请求，优先路由到前端
  if (isHtmlRequest && !path.startsWith('/api/')) {
    return false  // 这是页面请求
  }
  
  // 否则按路径判断（用于 API 请求）
  return path.startsWith('/favorites') || ...
}
```

**工作流程：**
```
用户刷新 /favorites 页面
  ↓
浏览器发送请求
  Accept: text/html,application/xhtml+xml,...
  ↓
路由器检查 Accept header
  → 包含 "text/html" ✅
  → 路径是 /favorites（不是 /api/*）
  → 判断为页面请求
  ↓
路由到前端
  → fashion-rec-frontend.pages.dev
  ↓
前端 Vue Router 处理
  → 显示 Favorites.vue 组件
  ↓
组件内部调用 API
  GET /favorites
  Accept: application/json
  ↓
路由器检查 Accept header
  → 不包含 "text/html"
  → 按路径判断
  → /favorites 在 API 列表中
  → 判断为 API 请求
  ↓
路由到后端
  → fashion-rec-backend.fly.dev
  ↓
返回 JSON 数据
  ↓
前端渲染 UI ✅
```

---

## 实际例子

### 例子 1: 用户刷新页面

**背景：** 用户在 `/favorites` 页面按 F5 刷新

**请求：**
```http
GET /favorites HTTP/1.1
Accept: text/html,application/xhtml+xml,application/xml;q=0.9
Cookie: auth_token=...
```

**路由器判断：**
- ✅ Accept 包含 `text/html`
- ✅ 路径是 `/favorites`（不是 `/api/*`）
- ✅ **判断为页面请求**
- ✅ **路由到前端**

**结果：** 显示 Favorites.vue 页面 ✅

---

### 例子 2: JavaScript 获取数据

**背景：** Favorites.vue 组件加载时获取数据

**代码：**
```typescript
// Favorites.vue
onMounted(async () => {
  const response = await apiClient.get('/favorites')
  favorites.value = response.data.favorites
})
```

**请求：**
```http
GET /favorites HTTP/1.1
Accept: application/json
Authorization: Bearer eyJhbGci...
```

**路由器判断：**
- ❌ Accept 不包含 `text/html`
- ✅ 路径是 `/favorites`（在 API 列表中）
- ✅ **判断为 API 请求**
- ✅ **路由到后端**

**结果：** 返回 JSON 数据 ✅

---

### 例子 3: 直接访问 API（特殊情况）

**背景：** 开发者在浏览器直接访问 API URL

**请求：**
```http
GET /favorites HTTP/1.1
Accept: text/html  (浏览器默认)
```

**路由器判断：**
- ✅ Accept 包含 `text/html`
- ✅ **判断为页面请求**
- ✅ **路由到前端**

**结果：** 显示前端页面（而不是 JSON）

**注意：** 如果开发者想要直接看到 JSON，需要：
- 使用 Postman/curl 等工具
- 或者设置 `Accept: application/json` header

---

## 总结

### 核心区别

| | 浏览器页面请求 | API 请求 |
|---|---|---|
| **Accept** | `text/html` | `application/json` |
| **用途** | 加载页面 | 获取数据 |
| **路由** | 前端 | 后端 |
| **响应** | HTML | JSON |

### 判断方法

1. **优先检查 Accept header**（最可靠）
   - `text/html` → 页面请求
   - `application/json` → API 请求

2. **路径作为辅助判断**
   - `/api/*` → 总是 API
   - 其他路径 → 结合 Accept 判断

### 在你的项目中

✅ **路由器现在能正确区分：**
- 浏览器刷新 → 路由到前端（显示页面）
- JavaScript API 调用 → 路由到后端（返回 JSON）

✅ **解决了之前的问题：**
- 刷新页面不再显示 JSON
- 页面正常显示 UI
- API 调用正常工作

---

## 🎓 进一步学习

- [HTTP Accept Header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Accept)
- [Content Negotiation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Content_negotiation)
- [RESTful API Design](https://restfulapi.net/)

