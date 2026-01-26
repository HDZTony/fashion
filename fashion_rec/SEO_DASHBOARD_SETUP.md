# SEO Dashboard 完整设置指南

## 概述

本指南将帮助你完成 SEO Dashboard 的完整设置，包括 Google Cloud Console 配置和数据库迁移。

## 第一步：Google Cloud Console 设置

### 1. 检查现有 Google OAuth 配置

你已经实现了 Google 登录，现在需要为 Search Console API 添加额外的权限。

**检查现有配置：**
- 你的 Google OAuth 凭据已经在 `.env` 文件中（最后一行 JSON 格式）
- Client ID: `729541469608-idf9oamqmk1pg81tl7akt7vns94da57a.apps.googleusercontent.com`
- 项目 ID: `capable-droplet-460702-e6`

### 2. 启用必要的 API

访问 [Google Cloud Console](https://console.cloud.google.com/)，选择项目 `capable-droplet-460702-e6`：

1. **启用 Google Search Console API**
   - 进入 **APIs & Services** > **Library**
   - 搜索 "Google Search Console API"
   - 点击 **Enable**

2. **启用 Google Site Verification API**
   - 在 **Library** 中搜索 "Google Site Verification API"
   - 点击 **Enable**

### 3. 更新 OAuth 2.0 凭据的授权范围

1. 进入 **APIs & Services** > **Credentials**
2. 找到你的 OAuth 2.0 Client ID（`729541469608-idf9oamqmk1pg81tl7akt7vns94da57a.apps.googleusercontent.com`）
3. 点击编辑
4. **添加授权重定向 URI**（如果还没有）：
   - `https://fashion-rec.com/callback`
   - `https://fashion.hdz73.com/callback`（如果使用）
5. **保存更改**

### 4. 配置环境变量

在 `fashion_rec/backend/.env` 文件中添加或更新：

```bash
# Google OAuth 配置（用于 Search Console）
GOOGLE_CLIENT_ID=729541469608-idf9oamqmk1pg81tl7akt7vns94da57a.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://fashion-rec.com/callback

# 凭据加密密钥（生产环境必须设置，用于加密存储 OAuth 凭据）
CREDENTIALS_ENCRYPTION_KEY=your-secure-random-key-at-least-32-characters-long
```

**重要：** `CREDENTIALS_ENCRYPTION_KEY` 必须是至少 32 个字符的随机字符串。生成方法：

```bash
# 使用 Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 或使用 OpenSSL
openssl rand -base64 32
```

## 第二步：数据库迁移

### 1. 执行迁移脚本

**方法一：使用 Supabase Dashboard（推荐）**

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 打开文件 `fashion_rec/backend/migrations/004_create_search_console_credentials.sql`
5. **复制全部内容**
6. 粘贴到 SQL Editor 中
7. 点击 **Run** 执行

**方法二：使用 psql**

```bash
psql -h db.eufhccrelpucppognlym.supabase.co -U postgres -d postgres -f fashion_rec/backend/migrations/004_create_search_console_credentials.sql
```

### 2. 验证迁移

在 Supabase SQL Editor 中执行：

```sql
-- 检查表是否存在
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'user_search_console_credentials';

-- 应该返回一行：user_search_console_credentials
```

## 第三步：安装依赖

```bash
cd fashion_rec/backend
uv sync
```

或者使用 pip：

```bash
pip install cryptography>=41.0.0
```

## 第四步：测试连接

### 1. 启动后端服务

```bash
cd fashion_rec/backend
uvicorn main:app --reload
```

### 2. 访问 SEO Dashboard

1. 登录你的应用
2. 导航到 `/seo` 页面
3. 点击 "Connect Search Console"
4. 完成 Google OAuth 授权
5. 检查连接状态

## 常见问题

### Q: OAuth 授权后显示 "Not connected"

**A:** 检查以下几点：
1. 确认数据库迁移已执行
2. 检查 `CREDENTIALS_ENCRYPTION_KEY` 环境变量是否设置
3. 查看后端日志是否有错误信息
4. 确认 Google Search Console API 已启用

### Q: 提示 "Failed to save credentials"

**A:** 
1. 检查数据库表是否存在
2. 确认用户 ID 格式正确（UUID）
3. 查看 Supabase 日志

### Q: API 调用返回 401 错误

**A:**
1. 确认已连接 Google Search Console
2. 检查 OAuth token 是否过期（需要实现 token 刷新）
3. 确认 API 已启用

### Q: 如何查看存储的凭据？

**A:** 在 Supabase Dashboard 中：
```sql
SELECT user_id, site_url, created_at 
FROM user_search_console_credentials;
```

**注意：** `credentials_json` 字段是加密的，不能直接查看。

## 安全注意事项

1. **加密密钥管理**
   - 生产环境必须设置强随机 `CREDENTIALS_ENCRYPTION_KEY`
   - 不要将密钥提交到代码仓库
   - 使用环境变量或密钥管理服务

2. **OAuth 凭据安全**
   - 凭据在数据库中加密存储
   - 只有用户本人可以访问自己的凭据（RLS 策略）
   - 定期轮换加密密钥

3. **API 配额**
   - Google Search Console API 有配额限制
   - 监控 API 使用情况
   - 实现适当的缓存机制

## 下一步优化

1. **Token 自动刷新**
   - 实现 OAuth token 过期自动刷新
   - 在 `SearchConsoleService` 中添加刷新逻辑

2. **错误处理增强**
   - 添加更详细的错误信息
   - 实现重试机制

3. **缓存优化**
   - 缓存分析报告数据
   - 减少 API 调用次数

4. **监控和日志**
   - 添加 API 调用监控
   - 记录错误和异常

## 参考资源

- [Google Search Console API 文档](https://developers.google.com/webmaster-tools/search-console-api-original)
- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
- [Supabase RLS 文档](https://supabase.com/docs/guides/auth/row-level-security)
