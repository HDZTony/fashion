# 测试数据库写入功能

## 当前配置状态

✅ Secret Key 已配置：`sb_secret_8xyn99rc8H4QlQVD46h4ug_zlavdAmP`

## 测试步骤

### 1. 确认服务已重启

检查服务是否已加载新的 Secret Key：

1. 查看终端日志，应该看到：
   ```
   🚀 Subscription service starting on port 3001
   🌍 Environment: TEST
   📝 Creem API Key: creem_test_4Wsd...
   🔐 Webhook Secret: Set
   🧪 Test Mode: Enabled
   ```

2. 如果没有看到这些日志，说明服务需要重启：
   ```bash
   # 停止当前服务（Ctrl+C）
   # 然后重新启动
   cd fashion_rec/backend/subscription-service
   pnpm dev
   ```

### 2. 测试订阅更新（使用之前的 checkout）

之前的 checkout ID: `ch_2KHN0UOzmTL3Gk2KzAHtdd`

在浏览器中或使用 curl 测试同步：

```bash
# 方法 1：使用 curl（PowerShell）
$body = @{
    checkoutId = 'ch_2KHN0UOzmTL3Gk2KzAHtdd'
    userId = 'cfdbf997-329c-470d-b961-500fe7090655'
} | ConvertTo-Json

Invoke-WebRequest -Uri 'http://localhost:3001/subscription/sync-from-checkout' `
  -Method POST `
  -Body $body `
  -ContentType 'application/json'
```

### 3. 或者直接测试订阅更新 API

```bash
$body = @{
    user_id = 'cfdbf997-329c-470d-b961-500fe7090655'
    plan = 'premium'
    creem_subscription_id = 'sub_2LNZJEJ0Z5D1kn0RiM3g2i'
    creem_customer_id = 'cust_73EJe8ZX323MKVoaUD1Id4'
    status = 'active'
} | ConvertTo-Json

Invoke-WebRequest -Uri 'http://localhost:3001/subscription/update' `
  -Method POST `
  -Body $body `
  -ContentType 'application/json'
```

### 4. 检查终端日志

查看终端输出，应该看到：

**如果成功：**
```
📝 Updating subscription for user: cfdbf997-329c-470d-b961-500fe7090655
📋 Existing subscription data: Not found (will create new)
➕ Creating new subscription...
📤 Insert data: {...}
✅ Subscription created successfully: [...]
```

**如果失败（RLS 错误）：**
```
❌ Error inserting subscription: {
  code: '42501',
  message: 'new row violates row-level security policy...'
}
```

**如果失败（其他错误）：**
查看完整的错误信息，包括：
- error.code
- error.message
- error.details
- error.hint

### 5. 验证数据已写入

查询订阅状态：
```bash
Invoke-WebRequest -Uri 'http://localhost:3001/subscription/status?user_id=cfdbf997-329c-470d-b961-500fe7090655'
```

应该返回：
```json
{
  "planName": "高级版",
  "remainingTries": 150,
  "totalTries": 150,
  "period": "monthly",
  "status": "active",
  "subscriptionId": "sub_2LNZJEJ0Z5D1kn0RiM3g2i",
  "customerId": "cust_73EJe8ZX323MKVoaUD1Id4"
}
```

## 如果仍然失败

### 检查 Secret Key 格式

新的 Secret Key 格式 (`sb_secret_...`) 应该被 Supabase JS SDK 支持。但如果出现问题，可以：

1. **检查 Supabase Dashboard**：
   - 确认 Secret Key 是否正确复制（完整，没有遗漏字符）

2. **尝试旧格式**（如果新格式不工作）：
   - 在 Supabase Dashboard > Settings > API
   - 找到 "Legacy anon, service_role API keys"
   - 复制 service_role key（JWT 格式）
   - 更新 `.env` 文件使用旧格式

3. **检查 SDK 版本**：
   - 当前版本：`@supabase/supabase-js@^2.39.0`
   - 如果需要，可以升级到最新版本：`pnpm update @supabase/supabase-js`

## 常见问题

### Q: 新格式的 Secret Key 不被支持？

A: Supabase JS SDK 应该支持新格式。如果确实不支持，请：
1. 升级 SDK：`pnpm update @supabase/supabase-js`
2. 或使用旧格式的 service_role key

### Q: 仍然看到 RLS 错误？

A: 可能的原因：
1. 服务没有重启（仍在使用旧的 anon key）
2. Secret Key 没有正确配置
3. Supabase SDK 版本太旧，不支持新格式

## 下一步

执行测试后，请告诉我：
1. 终端日志显示了什么？
2. 是否有错误信息？
3. 如果成功，订阅状态是否更新了？
