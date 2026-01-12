# 故障排除指南

## R2 自定义域名 404 错误

### 问题：访问 `r2blog.fashion-rec.com/{filename}` 返回 404

### 可能的原因和解决方案：

#### 1. Worker 未重启
**症状**：日志显示仍在使用公共开发 URL (`pub-*.r2.dev`)

**解决方案**：
```bash
cd cloudflare-blog
# 停止当前的 wrangler dev (Ctrl+C)
# 重新启动
pnpm dev
```

#### 2. 自定义域名未激活
**症状**：在 Cloudflare Dashboard 中，`r2blog.fashion-rec.com` 状态仍为 "Initializing"

**解决方案**：
- 等待域名初始化完成（状态变为 "Active"）
- 检查 DNS 配置是否正确
- 确认域名验证已完成

#### 3. 环境变量未加载
**症状**：代码进入了 fallback 分支，使用公共开发 URL

**检查步骤**：
1. 确认 `.dev.vars` 文件存在且包含：
   ```env
   R2_PUBLIC_URL=https://r2blog.fashion-rec.com
   ```
2. 确认 Worker 已重启
3. 查看日志，应该看到：
   ```
   [Blog] Using configured R2_PUBLIC_URL: https://r2blog.fashion-rec.com/...
   ```

#### 4. 文件路径问题
**症状**：URL 格式正确，但仍返回 404

**检查步骤**：
1. **验证文件是否真的上传成功**：
   - 在 Cloudflare Dashboard → R2 → blog-media 中检查文件是否存在
   - 查看 Worker 日志，应该看到 "File verified in R2" 消息
   
2. **测试公共开发 URL**：
   如果自定义域名返回 404，尝试使用公共开发 URL 访问同一个文件：
   ```
   https://pub-e92b5aac543d4f37970ad252aac3c3b7.r2.dev/{filename}
   ```
   如果公共开发 URL 可以访问，说明文件上传成功，问题在自定义域名配置
   
3. **检查自定义域名配置**：
   - 确认自定义域名状态为 "Active"
   - 检查 DNS 记录是否正确
   - 等待几分钟让 DNS 和配置完全生效
   
4. **验证文件路径**：
   - 确认 URL 中的路径与 R2 bucket 中的文件路径完全一致
   - 路径格式应该是：`{user-id}/{type}_{timestamp}_{randomId}.{ext}`

#### 5. DNS 配置问题
**症状**：域名无法解析

**检查步骤**：
1. 在 Cloudflare Dashboard → DNS 中检查 `r2blog.fashion-rec.com` 的 DNS 记录
2. 确认记录类型和值正确
3. 等待 DNS 传播（可能需要几分钟）

### 调试步骤

1. **检查环境变量是否加载**：
   - 查看 Worker 日志
   - 应该看到 `[Blog] Using configured R2_PUBLIC_URL` 而不是警告信息

2. **测试域名访问**：
   ```bash
   curl -I https://r2blog.fashion-rec.com/test-file.jpg
   ```

3. **检查 R2 bucket 中的文件**：
   - Cloudflare Dashboard → R2 → blog-media
   - 确认文件已上传且路径正确

4. **验证自定义域名状态**：
   - Cloudflare Dashboard → R2 → blog-media → Settings → Custom Domains
   - 确认 `r2blog.fashion-rec.com` 状态为 "Active"

### 临时解决方案

如果自定义域名还未就绪，可以临时使用公共开发 URL：

在 `.dev.vars` 中：
```env
R2_PUBLIC_URL=https://pub-e92b5aac543d4f37970ad252aac3c3b7.r2.dev
```

重启 Worker 后即可使用。
