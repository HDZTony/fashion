# API URL 配置说明

## 当前架构

```
fashion-rec.com (生产域名) 或 fashion.hdz73.com (301 重定向到 fashion-rec.com)
    ↓
Cloudflare Worker (路由层)
    ↓
    ├─→ 页面请求 → 前端部署（稳定版或 V2）
    └─→ API 请求 → 后端部署（稳定版或 V2）
```

## 前端 API URL 配置

### 推荐配置

在 GitHub Repository Settings → Variables 中设置：

```bash
VITE_API_URL=https://fashion-rec.com
```

### 为什么这样配置？

1. **统一入口**：所有请求（页面和 API）都经过 Worker
2. **自动路由**：Worker 根据用户版本自动路由到对应的后端
3. **无需修改代码**：前端代码使用相对路径（如 `/items`），会自动拼接为完整 URL

### 工作流程

1. **前端页面请求**：
   ```
   用户访问: fashion-rec.com (或 fashion.hdz73.com 自动 301 重定向)
   → Worker 识别为页面请求
   → 路由到对应的前端部署
   ```

2. **API 请求**：
   ```
   前端调用: apiClient.get('/items')
   → 实际请求: https://fashion-rec.com/items
   → Worker 识别为 API 请求（路径以 /items 开头）
   → 路由到对应的后端部署
   ```

## Worker API 路径识别

Worker 会自动识别以下路径为 API 请求：

- `/api/*` - 标准 API 路径
- `/health` - 健康检查
- `/outfit` - 搭配生成
- `/try-on` - 试穿
- `/items` - 单品管理
- `/upload` - 上传
- `/looks` - 搭配记录
- `/favorites` - 收藏
- `/model-image` - 模特图片
- `/user-images` - 用户图片
- `/scene-image` - 场景图片
- `/tryon-history` - 试穿历史
- `/lv-products` - LV 商品
- `/subscription` - 订阅
- `/cleanup-expired-files` - 清理过期文件

## 配置检查清单

- [ ] GitHub Repository Variables 中 `VITE_API_URL` 设置为 `https://fashion-rec.com`
- [ ] Cloudflare Worker 路由规则已配置：`fashion-rec.com/*` → Worker
- [ ] 保留旧域名路由：`fashion.hdz73.com/*` → Worker (用于 301 重定向)
- [ ] Worker 环境变量已配置（包括前后端 URL）
- [ ] 重新部署前端以应用新的 API URL

## 验证方法

1. **检查前端构建**：
   - 查看构建日志，确认 `VITE_API_URL` 已正确设置
   - 检查构建后的代码中 API URL 是否正确

2. **测试 API 调用**：
   - 打开浏览器 DevTools → Network
   - 执行一个操作（如加载单品列表）
   - 查看请求 URL 是否为 `https://fashion-rec.com/items`

3. **检查 Worker 日志**：
   - Cloudflare Dashboard → Workers → fashion-rec-router → Logs
   - 查看 API 请求是否被正确路由

## 注意事项

- 如果之前 `VITE_API_URL` 直接指向后端（如 `https://fashion-rec-backend.fly.dev`），需要改为 `https://fashion-rec.com`
- 旧域名 `fashion.hdz73.com` 会自动 301 重定向到新域名 `fashion-rec.com`
- 修改后需要重新部署前端才能生效
- Worker 会自动处理 CORS 和认证头传递

