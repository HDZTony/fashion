# 订阅服务与Cloudflare Workers - 技术面试准备

## 1. 核心概念解释

### Q: 为什么选择Cloudflare Workers而不是传统后端？

**答案：**

**Cloudflare Workers的优势：**

1. **边缘计算**：
   - 代码运行在全球200+个边缘节点
   - 用户请求路由到最近的节点
   - 延迟极低（通常<50ms）

2. **无服务器架构**：
   - 无需管理服务器
   - 自动扩缩容
   - 按使用量付费

3. **成本效益**：
   - 免费额度：每天10万次请求
   - 超出后按请求数计费，成本极低

4. **开发体验**：
   - 使用熟悉的Web标准（JavaScript/TypeScript）
   - 快速部署（秒级）
   - 本地开发环境完善

**在我们的项目中的应用：**
- 订阅状态查询（高频操作）
- 使用次数检查（每次试穿前检查）
- Webhook处理（支付回调）

### Q: 订阅服务的架构设计是什么？

**答案：**

**架构设计：**

```
用户请求
    ↓
Cloudflare Worker (边缘节点)
    ↓
┌─────────────────────────┐
│  SubscriptionService    │
│  - 查询订阅状态         │
│  - 检查使用次数         │
│  - 更新订阅信息         │
└─────────────────────────┘
    ↓
Supabase (数据库)
    ↓
Creem.io (支付平台)
```

**核心组件：**

1. **SubscriptionService类**：
   ```typescript
   export class SubscriptionService {
     private client: SupabaseClient;
     
     // 获取订阅状态
     async getSubscriptionStatus(userId: string): Promise<UserInfo>
     
     // 检查并消费使用次数
     async checkAndConsumeTry(userId: string): Promise<CheckResult>
     
     // 更新订阅信息
     async updateSubscription(...): Promise<void>
   }
   ```

2. **API路由**：
   ```typescript
   // GET /userinfo - 获取用户订阅信息
   // POST /subscription/check-try - 检查并消费次数
   // POST /subscription/update - 更新订阅
   // POST /webhook - 处理支付回调
   ```

## 2. 订阅状态管理

### Q: 如何设计订阅状态的数据模型？

**答案：**

**数据模型：**

```typescript
interface SubscriptionRecord {
  user_id: string;                    // 用户ID
  plan: PlanType;                      // 订阅计划 (free/premium/pro)
  credits: number;                     // 剩余积分
  creem_subscription_id: string | null; // Creem订阅ID
  creem_customer_id: string | null;    // Creem客户ID
  status: string | null;                // 订阅状态 (active/canceled/expired)
  period_end: string | null;            // 订阅结束时间
  last_transaction_id: string | null;   // 最后交易ID
  daily_free_tries_used: number;       // 当天已用免费次数
  daily_free_tries_date: string;        // 免费次数日期
}
```

**设计考虑：**

1. **多数据源同步**：
   - 本地数据库存储（Supabase）
   - 支付平台数据（Creem.io）
   - 需要保持两者同步

2. **状态一致性**：
   ```typescript
   // 检查订阅状态的一致性
   if (localStatus !== creemStatus) {
     // 同步状态
     await syncSubscriptionStatus(userId);
   }
   ```

3. **时间管理**：
   - `period_end`: 订阅周期结束时间
   - `daily_free_tries_date`: 免费次数重置日期
   - 需要处理时区问题

### Q: 如何处理订阅状态的查询和更新？

**答案：**

**查询流程：**

```typescript
async getSubscriptionStatus(userId: string): Promise<UserInfo> {
  // 1. 从数据库获取本地记录
  const { data: record } = await this.table
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // 2. 检查是否需要重置每日免费次数
  const today = this.getTodayDateString();
  if (record.daily_free_tries_date !== today) {
    await this.resetDailyFreeTries(userId, today);
  }
  
  // 3. 根据计划类型计算剩余次数
  const plan = record.plan;
  let credits = record.credits;
  let dailyFreeTriesRemaining = 0;
  
  if (plan === 'free') {
    dailyFreeTriesRemaining = Math.max(0, 
      3 - record.daily_free_tries_used
    );
  } else if (plan === 'premium' || plan === 'pro') {
    credits = record.credits;
  }
  
  // 4. 返回用户信息
  return {
    planName: getPlanName(plan),
    credits,
    dailyFreeTriesRemaining,
    subscriptionId: record.creem_subscription_id,
    // ...
  };
}
```

**更新流程：**

```typescript
async updateSubscription(
  userId: string,
  plan: PlanType,
  creemSubscriptionId?: string,
  creemCustomerId?: string,
  status?: string,
  periodEnd?: string
): Promise<void> {
  // 1. 检查是否存在记录
  const { data: existing } = await this.table
    .select('*')
    .eq('user_id', userId)
    .single();
  
  // 2. 构建更新数据
  const updateData = {
    plan,
    creem_subscription_id: creemSubscriptionId,
    creem_customer_id: creemCustomerId,
    status,
    period_end: periodEnd,
    updated_at: new Date().toISOString()
  };
  
  // 3. 更新或插入
  if (existing) {
    await this.table
      .update(updateData)
      .eq('user_id', userId);
  } else {
    await this.table.insert({
      user_id: userId,
      ...updateData,
      credits: INITIAL_CREDITS,
      daily_free_tries_used: 0,
      daily_free_tries_date: this.getTodayDateString()
    });
  }
}
```

## 3. 使用次数控制

### Q: 如何实现使用次数的检查和消费？

**答案：**

**检查流程：**

```typescript
async checkAndConsumeTry(userId: string): Promise<CheckResult> {
  // 1. 获取订阅状态
  const status = await this.getSubscriptionStatus(userId);
  
  // 2. 检查是否有可用次数
  let hasTries = false;
  let remaining = 0;
  
  if (status.planName === 'Free') {
    // 免费计划：检查每日免费次数
    hasTries = (status.dailyFreeTriesRemaining || 0) > 0;
    remaining = status.dailyFreeTriesRemaining || 0;
  } else {
    // 付费计划：检查积分
    hasTries = status.credits > 0;
    remaining = status.credits;
  }
  
  // 3. 如果没有可用次数，直接返回
  if (!hasTries) {
    return {
      allowed: false,
      remaining,
      message: 'No tries remaining'
    };
  }
  
  // 4. 消费次数
  if (status.planName === 'Free') {
    await this.consumeDailyFreeTry(userId);
  } else {
    await this.consumeCredit(userId);
  }
  
  // 5. 返回结果
  return {
    allowed: true,
    remaining: remaining - 1,
    message: 'Try consumed successfully'
  };
}
```

**消费实现：**

```typescript
private async consumeDailyFreeTry(userId: string): Promise<void> {
  const today = this.getTodayDateString();
  
  // 原子性更新：增加已用次数
  const { data: record } = await this.table
    .select('daily_free_tries_used, daily_free_tries_date')
    .eq('user_id', userId)
    .single();
  
  const currentUsed = record.daily_free_tries_used || 0;
  const currentDate = record.daily_free_tries_date;
  
  // 如果日期不同，重置计数
  if (currentDate !== today) {
    await this.table
      .update({
        daily_free_tries_used: 1,
        daily_free_tries_date: today
      })
      .eq('user_id', userId);
  } else {
    await this.table
      .update({
        daily_free_tries_used: currentUsed + 1
      })
      .eq('user_id', userId);
  }
}

private async consumeCredit(userId: string): Promise<void> {
  // 原子性减少积分
  await this.table
    .update({
      credits: this.client.raw('credits - 1')
    })
    .eq('user_id', userId)
    .gt('credits', 0);  // 确保积分大于0
}
```

## 4. Webhook处理

### Q: 如何处理支付平台的Webhook回调？

**答案：**

**Webhook处理流程：**

```typescript
app.post('/webhook', async (c) => {
  try {
    // 1. 验证Webhook签名
    const signature = c.req.header('x-creem-signature');
    const payload = await c.req.text();
    
    if (!verifyWebhookSignature(signature, payload)) {
      return c.json({ error: 'Invalid signature' }, 401);
    }
    
    // 2. 解析事件数据
    const event = JSON.parse(payload);
    
    // 3. 处理不同类型的事件
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated':
        await handleSubscriptionEvent(event, subscriptionService);
        break;
      
      case 'transaction.completed':
        await handleTransactionEvent(event, subscriptionService);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});
```

**事件处理：**

```typescript
async function handleSubscriptionEvent(
  event: any,
  subscriptionService: SubscriptionService
): Promise<void> {
  // 1. 提取订阅信息
  const subscription = event.data.object;
  const userId = extractUserId(event);
  const subscriptionId = subscription.id;
  
  // 2. 确定订阅计划
  const plan = getPlanFromProduct(subscription.product);
  
  // 3. 更新数据库
  await subscriptionService.updateSubscription(
    userId,
    plan,
    subscriptionId,
    subscription.customer,
    subscription.status,
    subscription.currentPeriodEndDate
  );
}
```

## 5. 性能优化

### Q: 如何优化订阅服务的性能？

**答案：**

**优化策略：**

1. **缓存策略**：
   ```typescript
   // 使用Cloudflare KV缓存订阅状态
   const cacheKey = `subscription:${userId}`;
   const cached = await env.KV.get(cacheKey);
   
   if (cached) {
     return JSON.parse(cached);
   }
   
   // 查询数据库
   const status = await getSubscriptionStatus(userId);
   
   // 缓存5分钟
   await env.KV.put(cacheKey, JSON.stringify(status), {
     expirationTtl: 300
   });
   ```

2. **批量查询**：
   ```typescript
   // 如果需要查询多个用户，批量查询
   async function batchGetSubscriptionStatus(
     userIds: string[]
   ): Promise<Map<string, UserInfo>> {
     const { data } = await supabase
       .from('user_subscriptions')
       .select('*')
       .in('user_id', userIds);
     
     return new Map(data.map(r => [r.user_id, formatUserInfo(r)]));
   }
   ```

3. **数据库优化**：
   ```sql
   -- 为user_id创建索引
   CREATE INDEX idx_user_subscriptions_user_id 
   ON user_subscriptions(user_id);
   
   -- 为日期查询创建索引
   CREATE INDEX idx_user_subscriptions_date 
   ON user_subscriptions(daily_free_tries_date);
   ```

## 6. 错误处理

### Q: 如何处理订阅服务的错误情况？

**答案：**

**错误处理策略：**

1. **数据库错误**：
   ```typescript
   try {
     const { data, error } = await this.table
       .select('*')
       .eq('user_id', userId)
       .single();
     
     if (error) {
       if (error.code === 'PGRST116') {
         // 记录不存在，创建新记录
         return await this.createDefaultSubscription(userId);
       }
       throw error;
     }
   } catch (error) {
     console.error('Database error:', error);
     // 返回默认值或抛出错误
   }
   ```

2. **支付平台错误**：
   ```typescript
   try {
     const subscription = await creem.subscriptions.get({
       subscriptionId
     });
   } catch (error) {
     // 如果支付平台不可用，使用本地数据
     console.warn('Creem API error, using local data:', error);
     return await getLocalSubscriptionStatus(userId);
   }
   ```

3. **并发控制**：
   ```typescript
   // 使用数据库锁防止并发更新
   async function consumeTryWithLock(userId: string): Promise<boolean> {
     // 使用事务确保原子性
     const { data, error } = await supabase.rpc('consume_try', {
       p_user_id: userId
     });
     
     return data && data.success;
   }
   ```

## 7. 面试加分点

### 技术深度展示：

1. **边缘计算理解**：
   - 为什么选择边缘计算
   - 如何利用边缘节点降低延迟
   - 数据一致性的挑战

2. **无服务器架构经验**：
   - 如何设计无服务器应用
   - 如何处理状态管理
   - 如何优化冷启动

3. **支付集成经验**：
   - Webhook处理
   - 支付状态同步
   - 错误处理和重试

### 代码示例准备：

```typescript
// 准备一个完整的订阅服务实现
export class CompleteSubscriptionService {
  async handleSubscriptionCheck(
    userId: string,
    action: 'try-on' | 'outfit-generation'
  ): Promise<CheckResult> {
    // 1. 获取订阅状态（带缓存）
    const status = await this.getCachedStatus(userId);
    
    // 2. 检查权限
    const requiredPlan = this.getRequiredPlan(action);
    if (!this.hasPermission(status, requiredPlan)) {
      return { allowed: false, reason: 'Plan upgrade required' };
    }
    
    // 3. 检查次数
    if (!this.hasAvailableTries(status)) {
      return { allowed: false, reason: 'No tries remaining' };
    }
    
    // 4. 消费次数（原子性）
    await this.consumeTry(userId, status);
    
    return { allowed: true };
  }
}
```
