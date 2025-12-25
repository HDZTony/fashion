# 订阅服务迁移指南

## 概述

本次更新实现了以下功能：
1. **套餐配置解耦**：所有套餐信息集中在 `plan-config.ts` 中，方便移植到其他项目
2. **套餐额度调整**：
   - Premium: $5 → 30次/月
   - Premium Plus: $15 → 100次/月
   - Premium Pro: $29.9 → 250次/月（新增）
3. **每天前3次免费**：所有订阅每天的前3次试穿不计入次数限制

## 数据库迁移

### 需要添加的字段

在 `user_subscriptions` 表中添加以下字段：

```sql
-- 添加每日免费次数跟踪字段
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS daily_free_tries_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_free_tries_date DATE;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_daily_free_tries_date 
ON user_subscriptions(daily_free_tries_date);
```

### 字段说明

- `daily_free_tries_used`: 当天已使用的免费次数（整数，默认0）
- `daily_free_tries_date`: 免费次数使用的日期（DATE类型，格式：YYYY-MM-DD）

### 数据迁移脚本

如果需要为现有记录设置默认值：

```sql
-- 为现有记录设置默认值
UPDATE user_subscriptions
SET 
  daily_free_tries_used = 0,
  daily_free_tries_date = CURRENT_DATE
WHERE daily_free_tries_used IS NULL OR daily_free_tries_date IS NULL;
```

## 环境变量配置

### 后端（subscription-service）

在 Cloudflare Workers 环境变量中添加：

```
CREEM_TEST_PRODUCT_ID_PREMIUM_PRO=your_test_premium_pro_product_id
CREEM_PROD_PRODUCT_ID_PREMIUM_PRO=your_prod_premium_pro_product_id
```

### 前端

在 `.env` 文件中添加：

```env
VITE_CREEM_PRODUCT_ID_PREMIUM_PRO_TEST=your_test_premium_pro_product_id
VITE_CREEM_PRODUCT_ID_PREMIUM_PRO_PROD=your_prod_premium_pro_product_id
```

## 套餐配置

所有套餐配置在 `src/plan-config.ts` 中，可以轻松修改：

```typescript
export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  free: {
    type: 'free',
    name: 'Free',
    price: 0,
    monthlyTries: 3,
    resetPeriodDays: 1,
    dailyFreeTries: 3,
  },
  premium: {
    type: 'premium',
    name: 'Premium',
    price: 5,
    monthlyTries: 30,
    resetPeriodDays: 30,
    dailyFreeTries: 3, // 每天前3次不计入次数
  },
  premium_plus: {
    type: 'premium_plus',
    name: 'Premium Plus',
    price: 15,
    monthlyTries: 100,
    resetPeriodDays: 30,
    dailyFreeTries: 3,
  },
  premium_pro: {
    type: 'premium_pro',
    name: 'Premium Pro',
    price: 29.9,
    monthlyTries: 250,
    resetPeriodDays: 30,
    dailyFreeTries: 3,
  },
};
```

## 功能说明

### 每天前3次免费逻辑

1. 每次调用 `checkAndConsumeTry` 时：
   - 首先检查当天是否还有免费次数可用
   - 如果有免费次数，使用免费次数，**不扣除** `remaining_tries`
   - 如果免费次数已用完，才扣除 `remaining_tries`

2. 每天自动重置：
   - 当日期变更时（`daily_free_tries_date` 不等于今天），自动重置 `daily_free_tries_used` 为 0

3. 所有套餐都享受此优惠：
   - Free: 每天3次免费
   - Premium: 每天3次免费 + 30次付费
   - Premium Plus: 每天3次免费 + 100次付费
   - Premium Pro: 每天3次免费 + 250次付费

## 移植到其他项目

### 步骤

1. **复制配置文件**：
   - 复制 `src/plan-config.ts` 到新项目
   - 根据新项目需求修改套餐配置

2. **复制订阅服务**：
   - 复制 `src/subscription-service.ts` 到新项目
   - 确保数据库表结构匹配

3. **更新数据库**：
   - 执行上述 SQL 迁移脚本
   - 确保表结构包含所有必需字段

4. **配置环境变量**：
   - 设置 Supabase 连接信息
   - 配置 Creem 产品ID（如果需要）

5. **调整业务逻辑**：
   - 根据新项目需求调整套餐类型和额度
   - 修改 `plan-config.ts` 中的配置即可

## 测试

### 测试每天免费次数

1. 使用任意套餐用户进行试穿
2. 前3次应该不扣除 `remaining_tries`
3. 第4次开始才扣除 `remaining_tries`
4. 第二天应该重置免费次数

### 测试套餐额度

1. 创建不同套餐的订阅
2. 验证 `remaining_tries` 是否正确：
   - Premium: 30
   - Premium Plus: 100
   - Premium Pro: 250

## 注意事项

1. **数据库兼容性**：确保 Supabase 支持 `DATE` 类型
2. **时区处理**：日期比较使用 UTC 时间，确保时区设置正确
3. **并发安全**：在高并发场景下，可能需要添加数据库锁或使用事务
4. **迁移顺序**：先执行数据库迁移，再部署新代码

## 回滚方案

如果出现问题，可以回滚：

1. **代码回滚**：恢复到之前的版本
2. **数据库回滚**（可选）：
   ```sql
   ALTER TABLE user_subscriptions 
   DROP COLUMN IF EXISTS daily_free_tries_used,
   DROP COLUMN IF EXISTS daily_free_tries_date;
   ```

注意：回滚后，每天免费次数功能将失效，但不会影响现有订阅数据。

