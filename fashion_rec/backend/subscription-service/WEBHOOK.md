# Webhook 配置说明

## Webhook URL

你的 webhook URL 已配置为：
```
https://fashion-rec.com/webhook
```

注意：旧域名 `fashion.hdz73.com` 会自动 301 重定向到新域名 `fashion-rec.com`。

## 配置步骤

1. ✅ **Creem Dashboard 配置**
   - 登录 [Creem Dashboard](https://creem.io)
   - 进入 **Developers** > **Webhooks**
   - 添加 Webhook URL: `https://fashion-rec.com/webhook`
   - 复制 **Signing Secret** 到 `.env` 文件

2. ✅ **环境变量配置**
   ```env
   CREEM_WEBHOOK_SECRET=whsec_69DfxHi6SXZ60pnoLaRI12
   ```

3. ✅ **服务部署**
   - 确保服务运行在 `https://fashion-rec.com`（旧域名会自动重定向）
   - Webhook 端点路径: `/webhook`

## 支持的 Webhook 事件

服务会自动处理以下事件：

| 事件 | 说明 | 触发时机 |
|------|------|----------|
| `onCheckoutCompleted` | 结账完成 | 用户完成支付流程 |
| `onGrantAccess` | 授予访问权限 | 订阅激活时 |
| `onRevokeAccess` | 撤销访问权限 | 订阅取消时 |
| `onSubscriptionCreated` | 订阅创建 | 新订阅创建 |
| `onSubscriptionUpdated` | 订阅更新 | 订阅信息变更 |
| `onSubscriptionCanceled` | 订阅取消 | 订阅被取消 |
| `onPaymentSucceeded` | 支付成功 | 支付成功 |
| `onPaymentFailed` | 支付失败 | 支付失败 |

## 安全验证

- ✅ 所有 webhook 请求都会自动验证签名
- ✅ 使用 `creem-signature` 头进行 HMAC-SHA256 验证
- ✅ 只有来自 Creem 的合法请求才会被处理
- ✅ 无效签名会返回 401 错误

## 测试 Webhook

### 1. 使用 Creem Dashboard 测试

在 Creem Dashboard 的 Webhooks 页面，可以：
- 查看 webhook 事件历史
- 手动触发测试事件
- 查看 webhook 响应状态

### 2. 查看日志

服务会输出详细的 webhook 事件日志：

```bash
✅ Checkout completed: { checkoutId: '...', customerEmail: '...' }
🔓 Grant access: { customerId: '...', subscriptionId: '...' }
💳 Payment succeeded: { transactionId: '...', amount: 100 }
```

### 3. 本地测试（使用 ngrok）

如果需要本地测试：

```bash
# 1. 启动本地服务
pnpm dev

# 2. 在另一个终端启动 ngrok
ngrok http 3001

# 3. 在 Creem Dashboard 中使用 ngrok URL
# 例如: https://xxxx.ngrok.io/webhook
```

## 实现业务逻辑

在 `src/index.ts` 中的 webhook 处理函数里，你可以添加自己的业务逻辑：

```typescript
onCheckoutCompleted: async (data) => {
  const userId = data.checkout?.metadata?.userId;
  if (userId) {
    // 激活用户订阅
    await activateUserSubscription(userId);
    // 发送欢迎邮件
    await sendWelcomeEmail(data.customer?.email);
  }
},
```

## 故障排查

### Webhook 未收到事件

1. 检查服务是否正常运行
2. 检查 `CREEM_WEBHOOK_SECRET` 是否正确配置
3. 检查防火墙/反向代理配置
4. 查看服务日志

### 签名验证失败

1. 确认 `CREEM_WEBHOOK_SECRET` 与 Dashboard 中的一致
2. 确认请求头 `creem-signature` 存在
3. 检查服务是否正确获取原始请求体

### 常见错误

- **401 Invalid webhook signature**: 签名验证失败，检查 secret
- **400 Missing signature header**: 请求缺少签名头
- **500 Webhook secret not configured**: 环境变量未配置

## 监控建议

建议添加以下监控：

1. **Webhook 接收率**: 监控成功接收的 webhook 数量
2. **错误率**: 监控签名验证失败等错误
3. **响应时间**: 监控 webhook 处理时间
4. **事件类型分布**: 统计各类事件的数量
