# R2 存储配置指南

博客服务使用 Cloudflare R2 存储图片和视频文件。

## 1. 创建 R2 Bucket

```bash
cd cloudflare-blog
pnpm exec wrangler r2 bucket create blog-media
```

## 2. 配置 R2 Bucket 绑定

R2 bucket 绑定已在 `wrangler.toml` 中配置：

```toml
[[r2_buckets]]
binding = "BLOG_MEDIA"
bucket_name = "blog-media"
preview_bucket_name = "blog-media"
```

## 3. 配置公共访问（必需）

### 方案 A：使用 R2 公共 URL（推荐用于开发）

**重要**：R2 默认不提供公共访问，必须手动启用。

#### 启用步骤：

1. **登录 Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com
   - 登录你的账户

2. **进入 R2 存储桶设置**
   - 左侧菜单选择 **R2**
   - 点击 **blog-media** bucket

3. **启用公共访问**
   - 点击 **Settings** 选项卡
   - 找到 **Public Access** 部分
   - 点击 **Allow Access** 按钮
   - 在确认对话框中输入 **allow** 确认
   - 点击 **Allow** 完成

4. **获取公共 URL**
   - 启用后，Cloudflare 会生成公共访问 URL
   - 格式：`https://pub-{account-id}.r2.dev`
   - 你的 account ID：`a69a5620c481efdb002669a375d72efd`
   - 完整 URL：`https://pub-a69a5620c481efdb002669a375d72efd.r2.dev`

5. **配置环境变量**
   - 在 `cloudflare-blog/.dev.vars` 中添加（选择一种格式）：
   ```env
   # 选项 1: S3 API 端点（推荐）
   R2_PUBLIC_URL=https://a69a5620c481efdb002669a375d72efd.r2.cloudflarestorage.com/blog-media
   
   # 选项 2: R2 公共 URL
   # R2_PUBLIC_URL=https://pub-a69a5620c481efdb002669a375d72efd.r2.dev
   ```

### 方案 B：使用自定义子域名（推荐用于生产）

**重要**：不要使用根域名（如 `fashion-rec.com`），因为根域名用于主网站。必须使用子域名。

1. **在 Cloudflare Dashboard → R2 → blog-media → Settings**
2. **配置自定义子域名**
   - 在 **Custom Domains** 部分添加子域名
   - 推荐子域名：
     - `r2blog.fashion-rec.com`（已配置）
     - `media.fashion-rec.com`
     - `cdn.fashion-rec.com`
     - `static.fashion-rec.com`
   - 按照提示完成 DNS 配置和验证
   - 等待状态从 "Initializing" 变为 "Active"
3. **设置环境变量**
   ```bash
   # 本地开发
   # 在 .dev.vars 中添加：
   R2_PUBLIC_URL=https://r2blog.fashion-rec.com
   
   # 生产环境
   wrangler secret put R2_PUBLIC_URL
   # 输入：https://r2blog.fashion-rec.com
   ```

**为什么使用子域名？**
- 根域名 `fashion-rec.com` 用于主网站路由（首页、博客、API 等）
- 使用子域名可以避免路由冲突
- 子域名可以独立配置 CDN、缓存等策略
- 更好的性能和 SEO 优化

### 方案 C：使用 Presigned URLs（更安全）

如果需要更安全的访问控制，可以修改代码使用 presigned URLs。当前实现使用公共 URL，适合博客内容公开访问的背景。

## 4. 本地开发配置

在 `cloudflare-blog/.dev.vars` 中添加（可选）：

```env
R2_PUBLIC_URL=https://your-custom-domain.com
```

如果没有设置，将使用默认的 R2 公共 URL 格式。

## 5. 文件大小

文件大小没有硬性限制，但建议：
- 图片：建议控制在合理大小以优化加载速度
- 视频：建议使用适当的压缩和格式以平衡质量和文件大小

注意：Cloudflare R2 和 Workers 对单个文件大小有实际限制，超大文件可能需要特殊处理。

## 6. 文件存储结构

上传的文件按以下结构存储：

```
blog-media/
  {user_id}/
    image_{timestamp}_{randomId}.{ext}
    video_{timestamp}_{randomId}.{ext}
```

## 7. 验证配置

上传测试文件后，检查：
1. R2 bucket 中是否有文件
2. 公共 URL 是否可以访问
3. 前端是否能正确显示图片/视频

## 注意事项

- R2 存储会产生费用（根据存储量和请求量）
- 建议定期清理未使用的媒体文件
- 生产环境建议使用自定义域名以获得更好的性能
