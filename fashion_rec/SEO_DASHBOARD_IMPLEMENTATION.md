# SEO Dashboard 实现说明

## 概述

已实现类似 Wix 的 Google Search Console 集成功能，包括：

1. **Google Search Console 连接** - OAuth 2.0 认证
2. **网站验证** - 使用 Site Verification API
3. **站点地图提交** - 自动提交站点地图到 Google
4. **URL 检查工具** - 检查页面索引状态
5. **分析报告** - 显示点击次数、展示次数、CTR 和热门查询

## 已实现的功能

### 前端 (`fashion_rec/frontend/src/views/SEODashboard.vue`)

- ✅ SEO Dashboard 页面组件
- ✅ Google Search Console 连接状态显示
- ✅ 网站验证界面
- ✅ 站点地图提交界面
- ✅ URL 检查工具
- ✅ 分析报告展示（点击、展示、CTR、热门查询）

### 后端 (`fashion_rec/backend/`)

- ✅ `services/search_console.py` - Google Search Console API 服务
- ✅ API 端点：
  - `GET /seo/search-console/connect` - 启动 OAuth 连接
  - `GET /seo/search-console/callback` - OAuth 回调处理
  - `POST /seo/search-console/disconnect` - 断开连接
  - `GET /seo/search-console/status` - 检查连接状态
  - `POST /seo/verify-site` - 验证网站
  - `POST /seo/submit-sitemap` - 提交站点地图
  - `POST /seo/inspect-url` - 检查 URL 索引状态
  - `GET /seo/analytics` - 获取搜索分析数据

## 配置要求

### 1. Google OAuth 凭据

需要在环境变量中配置：

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://fashion-rec.com/callback
```

### 2. 安装依赖

```bash
cd fashion_rec/backend
uv sync
# 或
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib
```

### 3. Google Cloud Console 设置

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建或选择项目
3. 启用以下 API：
   - Google Search Console API
   - Google Site Verification API
4. 创建 OAuth 2.0 凭据：
   - 应用类型：Web 应用
   - 授权重定向 URI：`https://fashion-rec.com/callback`
5. 获取 Client ID 和 Client Secret

## 已完成的工作

### ✅ 数据库集成

已完成以下工作：

1. ✅ 创建数据库表存储用户凭据（加密存储）
   - 迁移文件：`migrations/004_create_search_console_credentials.sql`
   - 包含 RLS 策略，确保用户只能访问自己的凭据

2. ✅ 实现凭据加密/解密服务
   - `services/credentials_manager.py` - 使用 Fernet 对称加密
   - 支持环境变量配置加密密钥

3. ✅ 实现数据库服务
   - `services/search_console_db.py` - 凭据的存储和检索
   - 自动加密存储，解密读取

4. ✅ 更新所有 API 端点
   - 所有端点已集成数据库存储和检索
   - 自动检查连接状态

### ⚠️ 待实现的功能

1. **Token 自动刷新**
   - Google OAuth token 会过期，需要实现自动刷新机制
   - 在 `SearchConsoleService` 中添加刷新逻辑

2. **错误处理增强**
   - 添加更详细的错误信息
   - 实现重试机制

## 使用方法

### 1. 访问 SEO Dashboard

导航到 `/seo` 页面（需要登录）

### 2. 连接 Google Search Console

1. 点击 "Connect Search Console" 按钮
2. 完成 Google OAuth 授权
3. 授权后会自动返回并显示连接状态

### 3. 验证网站

1. 输入网站 URL
2. 点击 "Verify" 按钮
3. 查看验证结果

### 4. 提交站点地图

1. 输入站点地图 URL（如 `https://fashion-rec.com/sitemap.xml`）
2. 点击 "Submit" 按钮
3. 查看提交结果

### 5. 检查 URL

1. 输入要检查的 URL
2. 点击 "Inspect" 按钮
3. 查看索引状态、最后抓取时间等信息

### 6. 查看分析报告

1. 选择日期范围
2. 点击 "Load Report" 按钮
3. 查看：
   - 总点击次数
   - 总展示次数
   - 平均 CTR
   - 热门查询列表

## API 端点说明

### 连接状态检查

```http
GET /seo/search-console/status
Authorization: Bearer <token>
```

响应：
```json
{
  "connected": true
}
```

### 提交站点地图

```http
POST /seo/submit-sitemap
Authorization: Bearer <token>
Content-Type: application/json

{
  "sitemapUrl": "https://fashion-rec.com/sitemap.xml",
  "siteUrl": "https://fashion-rec.com"
}
```

### 检查 URL

```http
POST /seo/inspect-url
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "https://fashion-rec.com/blog/example"
}
```

### 获取分析数据

```http
GET /seo/analytics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
```

## 注意事项

1. **OAuth 凭据安全**：必须加密存储用户凭据
2. **Token 刷新**：Google OAuth token 会过期，需要实现自动刷新
3. **API 配额**：Google Search Console API 有配额限制，注意使用频率
4. **错误处理**：当前实现包含基本错误处理，可根据需要增强

## 参考文档

- [Google Search Console API 文档](https://developers.google.com/webmaster-tools/search-console-api-original)
- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
- [Site Verification API](https://developers.google.com/site-verification)

## 与 Wix 实现的对比

| 功能 | Wix | 本实现 | 状态 |
|------|-----|--------|------|
| OAuth 连接 | ✅ | ✅ | 完成 |
| 网站验证 | ✅ | ✅ | 完成 |
| 站点地图提交 | ✅ | ✅ | 完成 |
| URL 检查 | ✅ | ✅ | 完成 |
| 分析报告 | ✅ | ✅ | 完成 |
| 凭据存储 | ✅ | ✅ | 已完成数据库集成 |

## 下一步

1. ✅ ~~实现数据库表创建和凭据存储~~ - 已完成
2. ✅ ~~实现凭据加密/解密~~ - 已完成
3. ⚠️ 实现 token 自动刷新 - 待实现
4. 添加更多分析维度（按页面、按设备等）
5. 添加错误通知和提醒功能
6. 实现缓存机制减少 API 调用

## 快速开始

### 1. 执行数据库迁移

```bash
# 在 Supabase Dashboard 的 SQL Editor 中执行
# 文件：fashion_rec/backend/migrations/004_create_search_console_credentials.sql
```

### 2. 配置环境变量

在 `fashion_rec/backend/.env` 中添加：

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://fashion-rec.com/callback
CREDENTIALS_ENCRYPTION_KEY=your-32-char-random-key
```

### 3. 安装依赖

```bash
cd fashion_rec/backend
uv sync
```

详细设置指南请参考：`SEO_DASHBOARD_SETUP.md`
