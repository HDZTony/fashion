# 环境切换指南

## 概述

项目支持在**测试环境**和**生产环境**之间切换。**环境由后端统一控制**，前端自动从后端获取环境配置，确保前后端环境一致。

## 工作原理

1. **后端决定环境**：后端通过 `CREEM_TEST_MODE` 环境变量控制使用测试还是生产环境
2. **前端自动同步**：前端在初始化时从后端 `/config` 端点获取环境配置
3. **产品ID自动选择**：前端根据后端返回的环境信息自动选择对应的产品ID

## 环境变量说明

### 后端环境变量（唯一需要配置的）

- **变量名**: `CREEM_TEST_MODE`
- **测试环境**: `true`
- **生产环境**: `false`

**注意**：前端不再需要配置 `VITE_CREEM_TEST_MODE`，环境由后端统一控制。

## 切换方法

### 1. 本地开发环境

**重要**：只需要配置后端环境变量，前端会自动从后端获取配置。

#### 后端切换（唯一需要配置的地方）

编辑 `fashion_rec/backend/subscription-service/.env` 文件：

```env
# 测试环境
CREEM_TEST_MODE=true

# 生产环境
CREEM_TEST_MODE=false
```

或者编辑 `fashion_rec/backend/subscription-service/wrangler.toml` 文件：

```toml
[vars]
CREEM_TEST_MODE = "true"   # 测试环境
# CREEM_TEST_MODE = "false"  # 生产环境
```

### 2. Cloudflare Workers (后端)

#### 方法一：通过 Wrangler CLI

```bash
# 设置为测试环境
wrangler secret put CREEM_TEST_MODE
# 输入: true

# 设置为生产环境
wrangler secret put CREEM_TEST_MODE
# 输入: false
```

#### 方法二：通过 Cloudflare Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 Workers & Pages → 选择你的 Worker
3. 进入 Settings → Variables
4. 添加或编辑环境变量：
   - **Name**: `CREEM_TEST_MODE`
   - **Value**: `true` (测试) 或 `false` (生产)

### 3. Cloudflare Pages (前端)

**注意**：前端不再需要配置环境变量，会自动从后端获取配置。

### 4. GitHub Actions (CI/CD)

**注意**：前端构建时不再需要 `VITE_CREEM_TEST_MODE` 变量，环境由后端控制。

## 环境切换的影响

### 测试环境 (`true`)

- 使用测试环境的 Creem API Key (`CREEM_TEST_API_KEY`)
- 使用测试环境的 Webhook Secret (`CREEM_TEST_WEBHOOK_SECRET`)
- 使用测试环境的产品ID：
  - `VITE_CREEM_PRODUCT_ID_TEST`
  - `VITE_CREEM_PRODUCT_ID_PREMIUM_PLUS_TEST`
  - `VITE_CREEM_PRODUCT_ID_PREMIUM_PRO_TEST`
- Webhook URL: `https://fashion.hdz73.com/test-webhook`

### 生产环境 (`false`)

- 使用生产环境的 Creem API Key (`CREEM_PROD_API_KEY`)
- 使用生产环境的 Webhook Secret (`CREEM_PROD_WEBHOOK_SECRET`)
- 使用生产环境的产品ID：
  - `VITE_CREEM_PRODUCT_ID_PROD`
  - `VITE_CREEM_PRODUCT_ID_PREMIUM_PLUS_PROD`
  - `VITE_CREEM_PRODUCT_ID_PREMIUM_PRO_PROD`
- Webhook URL: `https://fashion.hdz73.com/webhook`

## 代码中的使用

### 前端代码

```typescript
// 前端从后端获取环境配置
const loadConfig = async () => {
  const response = await subscriptionClient.get('/config')
  isTestMode.value = response.data.isTestMode
  productIds.value = response.data.productIds
}

// 根据后端返回的环境配置选择产品ID
const productId = isTestMode.value
  ? productIds.value.premium.test
  : productIds.value.premium.prod
```

### 后端代码

```typescript
// 在 index.ts 中
const isTestMode = c.env.CREEM_TEST_MODE === 'true'

// 根据环境选择 API Key
const creemApiKey = isTestMode 
  ? c.env.CREEM_TEST_API_KEY 
  : c.env.CREEM_PROD_API_KEY
```

## 验证环境切换

### 前端验证

1. 打开浏览器开发者工具
2. 在 Console 中运行：
   ```javascript
   // 检查后端返回的配置
   fetch('/config').then(r => r.json()).then(console.log)
   ```
3. 检查返回的 `isTestMode` 字段是否正确

### 后端验证

### 后端验证

访问配置端点：

```bash
# 本地开发
curl http://localhost:3001/config

# 生产环境
curl https://your-worker.workers.dev/config
```

响应中会显示当前环境：
```json
{
  "isTestMode": true,     // 或 false
  "environment": "TEST",  // 或 "PRODUCTION"
  "productIds": {
    "premium": { "test": "...", "prod": "..." },
    "premiumPlus": { "test": "...", "prod": "..." },
    "premiumPro": { "test": "...", "prod": "..." }
  }
}
```

或者访问诊断端点：

```bash
curl http://localhost:3001/diagnostics
```

## 注意事项

1. **环境由后端统一控制**：只需要配置后端的 `CREEM_TEST_MODE`，前端会自动同步
2. **前后端环境自动一致**：前端从后端获取配置，确保环境一致
3. **产品ID匹配**：确保测试/生产环境的产品ID与 Creem Dashboard 中的配置一致
4. **Webhook配置**：确保在 Creem Dashboard 中配置了正确的 Webhook URL
5. **API Key权限**：确保测试和生产环境的 API Key 都有正确的权限
6. **数据库**：测试和生产环境可以使用同一个 Supabase 数据库，但建议分开使用
7. **前端环境变量**：前端仍需要配置产品ID（`VITE_CREEM_PRODUCT_ID_*`），但环境判断由后端决定

## 常见问题

### Q: 如何知道当前是测试还是生产环境？

A: 查看代码中的 `isTestMode` 变量，或访问后端的 `/diagnostics` 端点。

### Q: 可以同时运行测试和生产环境吗？

A: 可以，但需要：
- 使用不同的 Worker/Pages 项目
- 配置不同的环境变量
- 使用不同的 Webhook URL

### Q: 切换环境后需要重启服务吗？

A: 
- **本地开发**：需要重启开发服务器
- **Cloudflare Workers**：部署后自动生效
- **Cloudflare Pages**：重新构建后生效

### Q: 生产环境应该使用什么值？

A: 生产环境只需要在后端设置 `CREEM_TEST_MODE=false`，前端会自动从后端获取配置

### Q: 前端还需要配置环境变量吗？

A: 前端仍需要配置产品ID（`VITE_CREEM_PRODUCT_ID_*`），但环境判断（测试/生产）由后端决定，前端会自动从后端获取

