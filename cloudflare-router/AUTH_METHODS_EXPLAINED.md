# 认证方式详解：Authorization Header vs Cookie

## 📚 目录
1. [基本概念](#基本概念)
2. [Authorization Header (Bearer Token)](#authorization-header-bearer-token)
3. [Cookie 认证](#cookie-认证)
4. [详细对比](#详细对比)
5. [在你的项目中的使用](#在你的项目中的使用)
6. [最佳实践](#最佳实践)

---

## 基本概念

### 什么是认证（Authentication）？
认证是验证"你是谁"的过程。就像进入大楼需要出示身份证一样，访问受保护的 API 需要提供身份证明。

### 两种主要方式
1. **Authorization Header (Bearer Token)** - 手动发送 token
2. **Cookie** - 浏览器自动发送

---

## Authorization Header (Bearer Token)

### 🔍 什么是 Bearer Token？

Bearer Token 是一种**无状态**的认证方式。Token 本身包含了所有需要的信息（用户ID、权限等）。

### 📝 格式

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsImtpZCI6IjdkblRtRmxRUXRpeG9rOUoiLCJ0eXAiOiJKV1QifQ...
```

**结构：**
- `Authorization` - HTTP 头名称
- `Bearer` - 认证类型（表示"持有者"）
- `eyJhbGci...` - 实际的 JWT token（很长的一串字符）

### 🔐 JWT Token 的结构

JWT (JSON Web Token) 由三部分组成，用 `.` 分隔：

```
header.payload.signature
```

**示例：**
```
eyJhbGciOiJIUzI1NiIsImtpZCI6IjdkblRtRmxRUXRpeG9rOUoiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2V1ZmhjY3JlbHB1Y3Bwb2dubHltLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJjZmRiZjk5Ny0zMjljLTQ3MGQtYjk2MS01MDBmZTcwOTA2NTUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY2ODMzOTkxLCJpYXQiOjE3NjY4MzAzOTEsImVtYWlsIjoiOTU0NTA0Nzg4QHFxLmNvbSJ9.1ucpsfnZSvGmXO9gUJ_xq1WIy6nwgdHoim25bCDoeJc
```

**解码后的 payload（中间部分）：**
```json
{
  "iss": "https://eufhccrelpucppognlym.supabase.co/auth/v1",
  "sub": "cfdbf997-329c-470d-b961-500fe7090655",  // 用户ID
  "aud": "authenticated",
  "exp": 1766833991,  // 过期时间
  "iat": 1766830391,  // 签发时间
  "email": "954504788@qq.com"
}
```

### 💻 在你的代码中如何使用

**前端发送请求（api-client.ts）：**
```typescript
// 在请求拦截器中自动添加
config.headers.Authorization = `Bearer ${token}`
```

**后端接收（路由器）：**
```typescript
const authHeader = request.headers.get('Authorization')
// 提取: "Bearer eyJhbGci..."
const match = authHeader.match(/^Bearer\s+(.+)$/i)
const token = match[1]  // 得到纯 token
```

### ✅ 优点

1. **无状态（Stateless）**
   - 服务器不需要存储 session
   - 每个请求都包含完整信息
   - 适合分布式系统

2. **跨域友好**
   - 可以轻松用于 API 调用
   - 不受 Cookie 同源策略限制

3. **移动端友好**
   - 移动 App 可以轻松使用
   - 不依赖浏览器 Cookie 机制

4. **灵活控制**
   - 前端完全控制何时发送
   - 可以手动添加到任何请求

5. **安全性**
   - Token 可以设置过期时间
   - 可以包含权限信息
   - 支持签名验证

### ❌ 缺点

1. **需要手动管理**
   - 前端必须手动添加到每个请求
   - 需要处理 token 刷新

2. **Token 泄露风险**
   - 如果 token 被窃取，攻击者可以冒充用户
   - 需要 HTTPS 保护传输

3. **无法主动撤销**
   - 一旦签发，在过期前都有效
   - 需要黑名单机制来撤销

4. **存储问题**
   - 通常存在 localStorage（有 XSS 风险）
   - 或存在内存中（刷新页面会丢失）

---

## Cookie 认证

### 🔍 什么是 Cookie？

Cookie 是浏览器自动管理的小型数据片段。服务器设置 Cookie 后，浏览器会在每次请求时**自动**发送。

### 📝 格式

**服务器设置 Cookie：**
```
Set-Cookie: sb-eufhccrelpucppognlym-auth-token=eyJhbGci...; Path=/; HttpOnly; Secure; SameSite=Lax
```

**浏览器自动发送：**
```
Cookie: sb-eufhccrelpucppognlym-auth-token=eyJhbGci...; other-cookie=value
```

### 🔐 Supabase Cookie 格式

Supabase 使用特定格式的 Cookie：
```
sb-<project-ref>-auth-token=<jwt-token>
```

**示例：**
```
sb-eufhccrelpucppognlym-auth-token=eyJhbGciOiJIUzI1NiIs...
```

### 💻 在你的代码中如何使用

**Supabase 自动管理：**
```typescript
// Supabase 客户端会自动处理 Cookie
const { data, error } = await supabase.auth.getSession()
// Supabase 会自动从 Cookie 中读取 session
```

**路由器提取：**
```typescript
const cookies = request.headers.get('Cookie')
// 匹配: "sb-eufhccrelpucppognlym-auth-token=eyJhbGci..."
const match = cookies.match(/sb-[^-]+-auth-token=([^;]+)/)
const token = match[1]  // 得到纯 token
```

### ✅ 优点

1. **自动发送**
   - 浏览器自动管理
   - 不需要前端手动添加
   - 减少代码复杂度

2. **安全性选项**
   - `HttpOnly`: JavaScript 无法访问（防 XSS）
   - `Secure`: 只在 HTTPS 下发送
   - `SameSite`: 防止 CSRF 攻击

3. **服务器控制**
   - 服务器可以设置过期时间
   - 可以立即撤销（删除 Cookie）

4. **适合传统 Web 应用**
   - 页面刷新自动保持登录
   - 用户体验好

### ❌ 缺点

1. **跨域限制**
   - 受同源策略限制
   - 需要配置 CORS
   - 跨域请求可能不发送 Cookie

2. **移动端不友好**
   - 移动 App 没有 Cookie 机制
   - 需要手动实现

3. **CSRF 风险**
   - 需要额外的 CSRF token
   - 或使用 SameSite 属性

4. **状态管理**
   - 服务器需要存储 session（或有状态）
   - 或从 Cookie 中解析（无状态）

---

## 详细对比

| 特性 | Authorization Header | Cookie |
|------|---------------------|--------|
| **发送方式** | 手动添加到请求头 | 浏览器自动发送 |
| **存储位置** | localStorage / 内存 | 浏览器 Cookie 存储 |
| **跨域** | ✅ 容易 | ❌ 需要 CORS 配置 |
| **移动端** | ✅ 友好 | ❌ 不友好 |
| **安全性** | 需要 HTTPS | 可配置 HttpOnly/Secure |
| **撤销** | 困难（需黑名单） | 容易（删除 Cookie） |
| **无状态** | ✅ 完全无状态 | ⚠️ 取决于实现 |
| **代码复杂度** | 需要手动管理 | 浏览器自动管理 |
| **XSS 风险** | ⚠️ localStorage 有风险 | ✅ HttpOnly 可防护 |
| **CSRF 风险** | ✅ 无风险 | ⚠️ 有风险（需防护） |

---

## 在你的项目中的使用

### 当前情况

你的项目**同时使用两种方式**：

1. **前端 → 后端 API**
   - 使用 **Authorization Header (Bearer Token)**
   - 见 `api-client.ts` 第 39 行和 87 行

2. **Supabase 认证**
   - 使用 **Cookie**（Supabase 自动管理）
   - 见 `supabase.ts` 配置

3. **路由器**
   - **现在支持两种方式**（我们刚修复的）
   - 优先检查 Authorization Header
   - 回退到 Cookie

### 代码示例

**前端发送 API 请求（使用 Bearer Token）：**
```typescript
// api-client.ts
config.headers.Authorization = `Bearer ${token}`
// 请求头：
// Authorization: Bearer eyJhbGci...
```

**Supabase 请求（使用 Cookie）：**
```typescript
// Supabase 自动从 Cookie 读取
const { data } = await supabase.from('table').select()
// 浏览器自动发送：
// Cookie: sb-eufhccrelpucppognlym-auth-token=eyJhbGci...
```

**路由器处理（支持两种）：**
```typescript
// 1. 先检查 Authorization Header
const authHeader = request.headers.get('Authorization')
if (authHeader) {
  // 提取 Bearer token
  const token = authHeader.match(/^Bearer\s+(.+)$/i)[1]
}

// 2. 如果没有，检查 Cookie
const cookies = request.headers.get('Cookie')
if (cookies) {
  // 提取 Supabase cookie
  const token = cookies.match(/sb-[^-]+-auth-token=([^;]+)/)[1]
}
```

---

## 最佳实践

### 🎯 什么时候用 Authorization Header？

✅ **适合背景：**
- RESTful API
- 移动应用（iOS/Android）
- 跨域 API 调用
- 微服务架构
- 需要无状态认证

**你的项目：** ✅ 前端 API 调用使用这种方式

### 🍪 什么时候用 Cookie？

✅ **适合背景：**
- 传统 Web 应用
- 同域请求
- 需要自动登录保持
- 服务器端渲染（SSR）

**你的项目：** ✅ Supabase 认证使用这种方式

### 🔄 混合使用（推荐）

你的项目采用了**混合方式**，这是最佳实践：

1. **API 调用** → Authorization Header
   - 灵活、跨域友好
   - 适合前后端分离

2. **Supabase 认证** → Cookie
   - 自动管理
   - 用户体验好

3. **路由器** → 支持两种
   - 兼容性最好
   - 无论哪种方式都能识别用户

---

## 🔒 安全建议

### Bearer Token 安全

1. **使用 HTTPS**
   ```typescript
   // 生产环境必须使用 HTTPS
   if (location.protocol !== 'https:') {
     console.error('Must use HTTPS in production')
   }
   ```

2. **Token 过期**
   ```typescript
   // Token 应该有过期时间
   // JWT 中的 exp 字段
   if (payload.exp < Date.now() / 1000) {
     // Token 已过期，需要刷新
   }
   ```

3. **存储安全**
   ```typescript
   // ❌ 不推荐：localStorage（XSS 风险）
   localStorage.setItem('token', token)
   
   // ✅ 推荐：HttpOnly Cookie（但需要后端支持）
   // 或：内存存储（刷新会丢失，但更安全）
   ```

### Cookie 安全

1. **设置安全标志**
   ```
   Set-Cookie: token=xxx; HttpOnly; Secure; SameSite=Strict
   ```
   - `HttpOnly`: 防止 JavaScript 访问
   - `Secure`: 只在 HTTPS 下发送
   - `SameSite`: 防止 CSRF

2. **CSRF 防护**
   ```typescript
   // 使用 CSRF token
   // 或使用 SameSite=Strict
   ```

---

## 📖 总结

### 核心区别

| | Authorization Header | Cookie |
|---|---|---|
| **本质** | 手动添加的 HTTP 头 | 浏览器自动管理的存储 |
| **控制权** | 前端完全控制 | 浏览器自动发送 |
| **适用** | API、移动端 | 传统 Web 应用 |

### 你的项目

✅ **正确使用两种方式：**
- API 调用 → Bearer Token（灵活）
- Supabase → Cookie（自动）
- 路由器 → 支持两种（兼容）

### 学习要点

1. **Bearer Token** = 手动发送，适合 API
2. **Cookie** = 自动发送，适合 Web
3. **混合使用** = 最佳实践
4. **安全性** = 都需要 HTTPS + 正确配置

---

## 🎓 进一步学习

- [JWT 官方文档](https://jwt.io/)
- [HTTP Cookie 规范](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Cookies)
- [OAuth 2.0 Bearer Token](https://oauth.net/2/bearer-tokens/)
- [Supabase 认证文档](https://supabase.com/docs/guides/auth)

