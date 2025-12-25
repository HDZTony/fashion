# 计费周期和试穿次数累加逻辑

## 概述

订阅服务实现了**试穿次数累加机制**：
- ✅ **未用完的次数保留到下个月**
- ✅ **续费时自动累加新的次数**
- ✅ **升级/降级时累加新套餐的月度次数**
- ✅ **避免重复重置导致次数丢失**

## 工作原理

### 1. 每月重置逻辑（累加模式）

当到达重置周期时（例如每月30天），系统会：
1. **保留**当前未用完的次数
2. **累加**新一个月的次数

**示例**：
- 用户有 Premium 套餐（30次/月）
- 本月使用了 20 次，剩余 10 次
- 下个月重置后：10（保留） + 30（新增） = **40 次**

### 2. 续费检测逻辑

系统通过以下方式检测续费（新计费周期）：

#### 方法一：通过 `period_end` 比较
- 如果新的 `period_end` 比现有的晚，说明进入了新的计费周期
- 这是最准确的检测方法

#### 方法二：通过 `last_reset_at` 判断
- 如果距离上次重置已经超过一个周期（30天），说明应该进入新周期
- 这是后备检测方法

### 3. 续费时的处理

当检测到续费时：
1. **保留**当前剩余次数
2. **累加**新一个月的次数
3. 更新 `period_end` 和 `last_reset_at`

**示例**：
- 用户有 Premium 套餐（30次/月）
- 第一个月剩余 10 次
- 续费后：10（保留） + 30（新增） = **40 次**

### 4. 升级/降级时的处理

当用户升级或降级套餐时：
1. **保留**当前剩余次数
2. **累加**新套餐的月度次数
3. 更新套餐类型和 `last_reset_at`

**升级示例**：
- 当前：Premium（30次/月），剩余 10 次
- 升级到 Premium Plus（100次/月）
- 升级后：10（保留） + 100（新套餐月度次数） = **110 次**

**降级示例**：
- 当前：Premium Plus（100次/月），剩余 50 次
- 降级到 Premium（30次/月）
- 降级后：50（保留） + 30（新套餐月度次数） = **80 次**

## 代码实现

### `resetTries` 方法（累加模式）

```typescript
private async resetTries(userId: string, plan: PlanType): Promise<void> {
  // 获取当前剩余次数
  const currentRemaining = data?.remaining_tries || 0;
  
  // 累加新的次数（保留未用完的次数）
  const newRemaining = currentRemaining + planConfig.monthlyTries;
  
  // 更新数据库
  await this.table.update({
    remaining_tries: newRemaining,
    last_reset_at: now,
    // ...
  });
}
```

### `isNewBillingPeriod` 方法（续费检测）

```typescript
private isNewBillingPeriod(
  existingData: SubscriptionRecord | null,
  newPeriodEnd: string | null | undefined,
  planConfig: PlanConfig
): boolean {
  // 方法一：比较 period_end
  if (newPeriodEnd && existingData?.period_end) {
    const newPeriodEndDate = new Date(newPeriodEnd);
    const existingPeriodEnd = new Date(existingData.period_end);
    if (newPeriodEndDate > existingPeriodEnd) {
      return true; // 新计费周期
    }
  }
  
  // 方法二：检查 last_reset_at
  if (existingData?.last_reset_at) {
    const daysSinceReset = /* 计算天数 */;
    if (daysSinceReset >= planConfig.resetPeriodDays) {
      return true; // 新计费周期
    }
  }
  
  return false;
}
```

### `updateSubscription` 方法（续费和升级/降级处理）

```typescript
async updateSubscription(...) {
  // 检测是否是新的计费周期
  const isNewBillingPeriod = this.isNewBillingPeriod(data, periodEnd, planConfig);
  
  if (!data) {
    // 新订阅：设置初始次数
    remaining = planConfig.monthlyTries;
  } else if (data.plan !== plan) {
    // 升级/降级：累加新套餐的月度次数
    const currentRemaining = data.remaining_tries || 0;
    remaining = currentRemaining + planConfig.monthlyTries;
  } else if (isNewBillingPeriod) {
    // 续费：累加新的次数
    const currentRemaining = data.remaining_tries || 0;
    remaining = currentRemaining + planConfig.monthlyTries;
  } else {
    // 非续费且非升级：保留现有次数
    remaining = data.remaining_tries;
  }
}
```

## Webhook 处理

### `onCheckoutCompleted`（首次订阅）

- 传递 `periodEnd` 给 `updateSubscription`
- 新订阅，设置初始次数

### `onSubscriptionUpdated`（续费）

- 检测到 `period_end` 更新时，自动累加次数
- 确保续费时正确累加

### `onPaymentSucceeded`（支付成功）

- 可能触发续费，通过 `onSubscriptionUpdated` 处理

## 使用场景

### 场景 1：正常月度重置

```
第1个月：30次（Premium）
使用：20次
剩余：10次

第2个月重置：
保留：10次
新增：30次
总计：40次 ✅
```

### 场景 2：续费时累加

```
第1个月：30次
剩余：10次
period_end: 2024-01-31

续费（第2个月）：
period_end: 2024-02-29（更新）
检测到新计费周期
保留：10次
新增：30次
总计：40次 ✅
```

### 场景 3：升级套餐（累加）

```
当前：Premium（30次/月）
剩余：10次

升级到 Premium Plus（100次/月）：
保留：10次
新增：100次（新套餐的月度次数）
总计：110次 ✅
```

### 场景 4：降级套餐（累加）

```
当前：Premium Plus（100次/月）
剩余：50次

降级到 Premium（30次/月）：
保留：50次
新增：30次（新套餐的月度次数）
总计：80次 ✅
```

## 注意事项

1. **套餐类型变化**：升级/降级时，会累加新套餐的月度次数（保留现有次数 + 新套餐次数）
2. **免费版**：每天重置，不累加
3. **取消订阅**：在 `period_end` 之前仍可使用，但不会累加
4. **数据库字段**：需要 `period_end` 字段来准确检测续费
5. **新订阅**：首次订阅时，设置初始次数（不累加）

## 测试建议

### 测试累加逻辑

1. **月度重置测试**：
   - 创建订阅，使用部分次数
   - 等待或手动触发重置
   - 验证次数是否累加

2. **续费测试**：
   - 创建订阅，使用部分次数
   - 模拟续费（更新 `period_end`）
   - 调用 `updateSubscription`
   - 验证次数是否累加

3. **升级/降级测试**：
   - 创建订阅，使用部分次数
   - 升级/降级套餐
   - 验证次数是否重置（不累加）

## 数据库迁移

确保数据库表包含以下字段：

```sql
ALTER TABLE user_subscriptions 
ADD COLUMN IF NOT EXISTS period_end TIMESTAMP;
```

这个字段用于准确检测续费和新计费周期。

