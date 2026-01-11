# Creem.io Subscription Service

基于 Hono 框架的 Creem.io 订阅服务，提供完整的订阅管理和支付集成功能。

**统一服务**：所有订阅管理、支付处理和试穿次数限制都在此 TypeScript 服务中处理。

## 功能特性

- ✅ **订阅状态管理**（获取、更新订阅状态）
- ✅ **试穿次数限制**（检查、消耗、自动重置）
- ✅ **支付集成**（Creem.io 结账会话创建）
- ✅ **Webhook 处理**（自动更新订阅状态）
- ✅ **产品查询**（获取产品列表和详情）
- ✅ **客户门户**（管理订阅和支付方式）
- ✅ **Supabase 集成**（统一数据存储）
- ✅ TypeScript 类型安全
- ✅ 完整的错误处理

## 安装

```bash
cd subscription-service
pnpm install
```

## 配置

复制 `env.example` 到 `.env` 并填入你的 Creem API 密钥：

```bash
cp env.example .env
```

编辑 `.env` 文件：

```env
CREEM_API_KEY=your_creem_api_key_here
CREEM_WEBHOOK_SECRET=your_webhook_secret_here  # 可选，仅在需要接收 webhook 时使用
CREEM_TEST_MODE=true

# Supabase Configuration (必需，用于订阅管理)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key

PORT=3001
```

### 关于 CREEM_WEBHOOK_SECRET

`CREEM_WEBHOOK_SECRET` 是**可选的**，只有在需要接收 Creem 的 webhook 事件时才需要配置。

**如何获取 Webhook Secret：**

1. 登录 [Creem Dashboard](https://creem.io)
2. 进入 **Developers** 标签页
3. 点击 **Webhooks** 页面
4. 点击 **Add Webhook** 创建新的 webhook
5. 输入你的 webhook URL（例如：`https://your-domain.com/api/webhooks/creem`）
6. 保存后，会显示 **Signing Secret**，这就是 `CREEM_WEBHOOK_SECRET`

**本地开发：**

如果需要本地测试 webhook，可以使用 [ngrok](https://ngrok.com/) 暴露本地服务：

```bash
ngrok http 3001
```

然后将 ngrok 生成的 URL 作为 webhook URL 填入 Creem Dashboard。

**注意：** 如果不需要接收 webhook 事件，可以省略 `CREEM_WEBHOOK_SECRET` 配置。

## 运行

### 开发模式

```bash
pnpm dev
```

### 生产模式

```bash
pnpm build
pnpm start
```

## API 端点

### 健康检查

```
GET /health
```

### 订阅管理

#### 获取用户信息
```
GET /userinfo?user_id=<user_id>
```

#### 检查并消耗试穿次数
```
POST /subscription/check-try
Body: {
  "user_id": "user_123"
}
```

#### 更新订阅状态
```
POST /subscription/update
Body: {
  "user_id": "user_123",
  "plan": "premium",
  "creem_subscription_id": "sub_xxxxx",
  "creem_customer_id": "cus_xxxxx",
  "status": "active"
}
```

### Webhook 处理

#### 接收 Creem Webhook 事件
```
POST /webhook
Headers:
  creem-signature: <webhook_signature>
Body: <webhook_event_payload>
```

**支持的 Webhook 事件：**
- `onCheckoutCompleted` - 结账完成
- `onGrantAccess` - 授予访问权限
- `onRevokeAccess` - 撤销访问权限
- `onSubscriptionCreated` - 订阅创建
- `onSubscriptionUpdated` - 订阅更新
- `onSubscriptionCanceled` - 订阅取消
- `onPaymentSucceeded` - 支付成功
- `onPaymentFailed` - 支付失败

**配置：**
1. 在 Creem Dashboard 中设置 Webhook URL: `https://fashion-rec.com/webhook`
2. 确保 `.env` 文件中配置了 `CREEM_WEBHOOK_SECRET`
3. Webhook 请求会自动验证签名，确保安全性

**注意：** Webhook 端点会自动验证请求签名，只有来自 Creem 的合法请求才会被处理。

### 订阅管理

#### 获取订阅详情
```
GET /subscriptions/:subscriptionId
```

#### 更新订阅（修改座位数等）
```
POST /subscriptions/:subscriptionId/update
Body: {
  "units": 5,
  "updateBehavior": "proration-charge-immediately"
}
```

#### 升级/降级订阅
```
POST /subscriptions/:subscriptionId/upgrade
Body: {
  "productId": "prod_premium",
  "updateBehavior": "proration-charge-immediately"
}
```

#### 取消订阅
```
POST /subscriptions/:subscriptionId/cancel
```

### 结账

#### 创建结账会话
```
POST /checkouts
Body: {
  "productId": "prod_xxxxx",
  "successUrl": "https://yourapp.com/success",
  "cancelUrl": "https://yourapp.com/cancel",
  "metadata": {
    "userId": "user_123"
  }
}
```

#### 获取结账会话
```
GET /checkouts/:checkoutId
```

### 产品

#### 获取产品列表
```
GET /products
```

#### 获取产品详情
```
GET /products/:productId
```

### 客户

#### 获取客户详情
```
GET /customers/:customerId
```

#### 创建客户门户链接
```
POST /customers/:customerId/portal
Body: {
  "returnUrl": "https://yourapp.com"
}
```

## 使用示例

### 创建订阅

```typescript
// 1. 创建结账会话
const response = await fetch('http://localhost:3001/checkouts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'prod_xxxxx',
    successUrl: 'https://yourapp.com/success',
    cancelUrl: 'https://yourapp.com/cancel',
    metadata: { userId: 'user_123' }
  })
});

const { checkoutUrl } = await response.json();
// 重定向用户到 checkoutUrl
```

### 更新订阅

```typescript
const response = await fetch('http://localhost:3001/subscriptions/sub_abc123/update', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    units: 10,
    updateBehavior: 'proration-charge-immediately'
  })
});

const subscription = await response.json();
```

### 取消订阅

```typescript
const response = await fetch('http://localhost:3001/subscriptions/sub_abc123/cancel', {
  method: 'POST'
});

const canceledSubscription = await response.json();
```

## Webhook 配置

详细的 webhook 配置说明请查看 [WEBHOOK.md](./WEBHOOK.md)

**快速配置：**
1. Webhook URL: `https://fashion-rec.com/webhook` ✅
2. 在 `.env` 中配置 `CREEM_WEBHOOK_SECRET`
3. 服务会自动处理所有 webhook 事件并验证签名

## 部署

服务默认运行在端口 3001。你可以：

1. 使用 PM2 管理进程
2. 使用 Docker 容器化
3. 部署到 Fly.io、Railway 等平台

**重要：** 确保 webhook URL (`https://fashion-rec.com/webhook`) 可以公开访问。旧域名 `fashion.hdz73.com` 会自动 301 重定向到新域名。

## 许可证

MIT
