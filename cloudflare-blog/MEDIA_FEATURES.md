# 博客媒体功能说明

## 功能概述

博客系统支持在文章中添加多张图片和多个视频。

## 数据库结构

### blog_posts 表新增字段

```sql
media_urls JSONB DEFAULT '[]'::jsonb
```

存储格式：
```json
[
  {
    "url": "https://...",
    "type": "image" | "video",
    "thumbnail": "https://..." // 可选，视频缩略图
  }
]
```

## API 端点

### POST /blog/media/upload

上传图片或视频文件。

**请求**：
- Method: POST
- Content-Type: multipart/form-data
- Body:
  - `file`: 文件（必需）
  - `type`: 'image' 或 'video'（可选，自动检测）

**响应**：
```json
{
  "url": "https://media.example.com/user-id/image_1234567890_abc123.jpg",
  "type": "image",
  "filename": "user-id/image_1234567890_abc123.jpg",
  "size": 123456,
  "contentType": "image/jpeg"
}
```

**文件大小**：
- 没有硬性限制，但建议控制文件大小以优化性能
- Cloudflare R2 和 Workers 对超大文件有实际限制

## 前端使用

### 上传媒体

在博客创建/编辑页面：
1. 点击"上传图片/视频"按钮
2. 选择文件（支持多选）
3. 文件自动上传到 R2
4. 上传成功后显示预览
5. 可以删除已上传的媒体

### 显示媒体

在博客详情页面：
- 媒体文件显示在内容上方
- 图片可以点击放大查看
- 视频支持播放控制

## 存储位置

媒体文件存储在 Cloudflare R2：
- Bucket: `blog-media`
- 路径格式: `{user_id}/{type}_{timestamp}_{randomId}.{ext}`

## 配置要求

1. **创建 R2 Bucket**：
   ```bash
   wrangler r2 bucket create blog-media
   ```

2. **配置公共访问**（选择其一）：
   - 方案 A：使用自定义域名（推荐）
     - 在 Cloudflare Dashboard 配置 R2 自定义域名
     - 设置 `R2_PUBLIC_URL` 环境变量
   - 方案 B：启用 R2 公共访问
     - 在 R2 bucket 设置中启用公共访问
     - 使用默认的 R2 公共 URL 格式

3. **设置环境变量**（可选但推荐）：
   ```bash
   wrangler secret put R2_PUBLIC_URL
   # 输入：https://media.yourdomain.com
   ```

## Markdown 集成

媒体文件可以通过两种方式使用：

1. **自动添加到 media_urls**：通过上传功能上传的文件会自动添加到 `media_urls` 数组
2. **在 Markdown 中引用**：可以在 Markdown 内容中直接使用图片/视频 URL

示例 Markdown：
```markdown
![Image description](https://media.example.com/image.jpg)

<video src="https://media.example.com/video.mp4" controls></video>
```

## 注意事项

- 上传的媒体文件会永久存储在 R2 中（除非手动删除）
- 建议定期清理未使用的媒体文件以节省存储成本
- 生产环境建议使用自定义域名以获得更好的性能和 CDN 加速
- 视频文件较大，上传可能需要一些时间
