# 测试订阅更新

## 问题：订阅成功但 user_subscriptions 表中没有数据

如果订阅成功了但数据库中没有记录，可以手动测试订阅更新功能。

## 步骤 1：检查数据库连接

```bash
curl http://localhost:3001/diagnostics/db
```

应该返回：
```json
{
  "supabaseUrl": "Set",
  "supabaseKey": "Set",
  "tableName": "user_subscriptions",
  "dbConnection": {
    "status": "success",
    "canQuery": true
  }
}
```

如果返回错误，检查：
- `SUPABASE_URL` 是否正确
- `SUPABASE_KEY` 是否正确
- Supabase 项目是否正常运行

## 步骤 2：检查表是否存在

在 Supabase Dashboard 中：
1. 登录 https://app.supabase.com
2. 选择你的项目
3. 进入 **Table Editor**
4. 确认 `user_subscriptions` 表是否存在

如果表不存在，执行以下 SQL：

```sql
CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free',
    remaining_tries INTEGER NOT NULL DEFAULT 1,
    creem_subscription_id TEXT,
    creem_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## 步骤 3：手动测试订阅更新

替换以下命令中的用户 ID，然后执行：

```bash
curl -X POST http://localhost:3001/subscription/update \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "cfdbf997-329c-470d-b961-500fe7090655",
    "plan": "premium",
    "creem_subscription_id": "sub_test_123",
    "creem_customer_id": "cus_test_123",
    "status": "active"
  }'
```

查看终端日志，应该看到：
```
📝 Updating subscription for user: ...
📋 Existing subscription data: ...
➕ Creating new subscription...
📤 Insert data: ...
✅ Subscription created successfully: ...
```

如果出现错误，查看错误详情：
- `error.message`: 错误消息
- `error.details`: 详细错误信息
- `error.hint`: 修复建议
- `error.code`: 错误代码

## 步骤 4：验证订阅状态

```bash
curl "http://localhost:3001/subscription/status?user_id=cfdbf997-329c-470d-b961-500fe7090655"
```

应该返回：
```json
{
  "planName": "高级版",
  "remainingTries": 150,
  "totalTries": 150,
  "period": "monthly",
  "status": "active"
}
```

## 常见错误及解决方案

### 错误 1: relation "user_subscriptions" does not exist

**原因**：表不存在

**解决**：执行步骤 2 中的 SQL 创建表

### 错误 2: permission denied for table user_subscriptions

**原因**：Supabase 匿名 key 没有写入权限

**解决**：
1. 在 Supabase Dashboard 中进入 **Table Editor**
2. 选择 `user_subscriptions` 表
3. 点击 **Policies**
4. 创建策略允许匿名用户 INSERT 和 UPDATE：
   ```sql
   CREATE POLICY "Allow anonymous insert" ON user_subscriptions
     FOR INSERT TO anon
     WITH CHECK (true);

   CREATE POLICY "Allow anonymous update" ON user_subscriptions
     FOR UPDATE TO anon
     USING (true);
   ```

### 错误 3: new row violates row-level security policy

**原因**：RLS（Row Level Security）策略限制

**解决**：
1. 检查表的 RLS 是否启用
2. 如果启用，需要创建适当的策略或禁用 RLS（开发环境）
3. 或者使用 service_role key 而不是 anon key

### 错误 4: 网络连接错误

**原因**：无法连接到 Supabase

**解决**：
1. 检查 `SUPABASE_URL` 是否正确
2. 检查网络连接
3. 检查 Supabase 项目状态

## 调试技巧

1. **查看详细日志**：终端中会输出详细的数据库操作日志
2. **检查 Supabase 日志**：在 Supabase Dashboard 的 **Logs** 页面查看数据库查询日志
3. **使用 Supabase Dashboard**：直接在 Table Editor 中手动插入一条记录测试

## 如果还是不行

1. 检查终端日志中的完整错误信息
2. 复制错误信息给我，我可以帮你进一步排查
3. 或者直接在 Supabase Dashboard 中手动插入一条记录，看看是否有权限问题
