# Blog Service Deployment Guide

## 部署前准备

### 1. 在 Supabase 创建数据库表

在 Supabase Dashboard → SQL Editor 中执行 `supabase_setup.sql` 脚本。

### 2. 安装依赖

```bash
cd cloudflare-blog
pnpm install
```

### 3. 配置环境变量

#### 本地开发 (.dev.vars)

创建 `cloudflare-blog/.dev.vars` 文件：

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### 生产环境

使用 `wrangler secret put` 设置密钥：

```bash
cd cloudflare-blog
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

或在 Cloudflare Dashboard 中设置：
Workers & Pages → fashion-rec-blog → Settings → Variables → Add variables

### 4. 本地测试

```bash
cd cloudflare-blog
pnpm dev
```

博客服务将在 `http://127.0.0.1:8788` 运行。

### 5. 部署博客 Worker

```bash
cd cloudflare-blog
pnpm deploy
```

部署完成后，记录 Worker 的 URL（例如：`https://fashion-rec-blog.xxxxx.workers.dev`）

### 6. 配置 Router Worker

#### 本地开发

在 `cloudflare-router/.dev.vars` 中添加：

```env
BLOG_SERVICE_URL=http://127.0.0.1:8788
```

#### 生产环境

使用 `wrangler secret put`：

```bash
cd cloudflare-router
wrangler secret put BLOG_SERVICE_URL
# 输入生产环境的博客 Worker URL，例如：https://fashion-rec-blog.xxxxx.workers.dev
```

或在 Cloudflare Dashboard 中设置：
Workers & Pages → fashion-rec-router → Settings → Variables → Add variable

### 7. 部署 Router Worker

```bash
cd cloudflare-router
pnpm deploy
```

### 8. 更新前端

#### 安装依赖

```bash
cd fashion_rec/frontend
pnpm install
```

#### 构建和部署

按照前端部署流程进行构建和部署。

## 测试

1. 访问前端博客页面：`/blog`
2. 测试创建文章（需要登录）
3. 测试查看文章详情
4. 测试编辑和删除文章（需要是文章作者）

## 故障排查

### 博客 Worker 无法连接 Supabase

- 检查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 是否正确设置
- 检查 Supabase 项目是否正常运行
- 检查网络连接

### Router 无法转发博客请求

- 检查 `BLOG_SERVICE_URL` 是否正确设置
- 检查博客 Worker 是否正常部署
- 检查 Router Worker 日志

### 前端无法加载文章

- 检查浏览器控制台错误
- 检查网络请求是否到达 Router
- 检查 Router 是否正确转发到博客 Worker
- 检查博客 Worker 日志

## API 端点

博客 Worker 提供以下端点（通过 Router 访问）：

- `GET /blog/posts` - 获取文章列表
- `GET /blog/posts/:id` - 获取单篇文章
- `POST /blog/posts` - 创建文章（需认证）
- `PUT /blog/posts/:id` - 更新文章（需认证，仅作者）
- `DELETE /blog/posts/:id` - 删除文章（需认证，仅作者）
