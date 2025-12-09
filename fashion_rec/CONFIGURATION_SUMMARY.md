# 订阅功能配置总结

## ✅ 已配置项

### 1. Creem.io 产品
- **产品 ID**: `prod_1W4roSJevbLIRwQyb3a8SQ`
- **价格**: $5/月
- **状态**: 已创建并激活

### 2. 环境变量配置

#### 前端 (`fashion_rec/frontend/.env`)
```env
VITE_API_URL=http://localhost:8000
VITE_SUBSCRIPTION_API_URL=http://localhost:3001
VITE_CREEM_PRODUCT_ID=prod_1W4roSJevbLIRwQyb3a8SQ
```

#### 订阅服务 (`fashion_rec/backend/subscription-service/.env`)
```env
CREEM_API_KEY=creem_4il5BwHAk8vS02yf0g9tQL
CREEM_WEBHOOK_SECRET=whsec_69DfxHi6SXZ60pnoLaRI12
CREEM_TEST_MODE=true
SUPABASE_URL=https://eufhccrelpucppognlym.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PORT=3001
```

### 3. Webhook 配置
- **Webhook URL**: `https://fashion.hdz73.com/webhook`
- **Webhook Secret**: `whsec_69DfxHi6SXZ60pnoLaRI12`
- **状态**: 已配置

## 🔍 还需要完成的配置

### 1. 数据库表（必需）
在 Supabase Dashboard 中执行以下 SQL：

```sql
-- 运行文件: fashion_rec/backend/subscription_migration.sql
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_creem_subscription_id 
    ON user_subscriptions(creem_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_creem_customer_id 
    ON user_subscriptions(creem_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status 
    ON user_subscriptions(status);
```

**步骤**:
1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择项目
3. 进入 **SQL Editor**
4. 执行 `subscription_migration.sql` 中的 SQL

### 2. 验证产品配置（可选但推荐）
在 Creem Dashboard 中确认：
- ✅ 产品价格: $5.00
- ✅ 计费周期: 每月
- ✅ 产品状态: 激活
- ✅ 产品 ID 匹配: `prod_1W4roSJevbLIRwQyb3a8SQ`

### 3. 生产环境配置（部署时）
如果部署到生产环境，需要更新：

**前端**:
```env
VITE_API_URL=https://your-backend-domain.com
VITE_SUBSCRIPTION_API_URL=https://your-subscription-service.com
VITE_CREEM_PRODUCT_ID=prod_1W4roSJevbLIRwQyb3a8SQ
```

**订阅服务**:
```env
CREEM_TEST_MODE=false  # 生产环境设为 false
# 其他配置保持不变
```

## 🚀 快速测试

### 1. 启动所有服务
```bash
# Terminal 1: 订阅服务
cd fashion_rec/backend/subscription-service
pnpm install  # 首次运行
pnpm dev

# Terminal 2: 后端服务
cd fashion_rec/backend
uv run python main.py

# Terminal 3: 前端
cd fashion_rec/frontend
pnpm install  # 首次运行
pnpm dev
```

### 2. 测试流程
1. 访问 `http://localhost:5173/pricing`
2. 点击"立即订阅"
3. 应该重定向到 Creem 支付页面
4. 使用测试卡号完成支付（如果 `CREEM_TEST_MODE=true`）

### 3. 测试卡号（测试模式）
- 卡号: `4242 4242 4242 4242`
- 过期日期: 任意未来日期（如 12/25）
- CVC: 任意 3 位数字（如 123）

## 📋 配置检查清单

- [x] Creem.io 产品已创建 (`prod_1W4roSJevbLIRwQyb3a8SQ`)
- [x] 前端环境变量已配置
- [x] 订阅服务环境变量已配置
- [x] Webhook URL 已配置
- [x] Webhook Secret 已配置
- [ ] **数据库表已创建** ⚠️ 需要完成
- [ ] 产品配置已验证（可选）

## ⚠️ 重要提示

1. **数据库表是必需的**：没有 `user_subscriptions` 表，订阅功能无法工作
2. **环境变量**：确保所有 `.env` 文件都已正确配置
3. **Webhook**：确保 webhook URL 可以公开访问
4. **测试模式**：开发时使用 `CREEM_TEST_MODE=true`，生产环境设为 `false`

## 🎯 下一步

1. ✅ 在 Supabase 中创建数据库表
2. ✅ 启动所有服务
3. ✅ 测试支付流程
4. ✅ 验证订阅状态更新
5. ✅ 测试试穿次数限制

完成以上步骤后，订阅功能就可以正常工作了！
