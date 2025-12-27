/**
 * 订阅管理服务
 * 管理用户订阅状态和试穿次数限制
 * 使用配置模块，方便移植到其他项目
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  PlanType, 
  getPlanConfig, 
  PLAN_CONFIGS 
} from './plan-config';

const TABLE_NAME = 'user_subscriptions';

interface SubscriptionStatus {
  planName: string;
  remainingTries: number;
  totalTries: number;
  period: 'daily' | 'monthly';
  nextResetDate: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  status: string | null;
  dailyFreeTriesRemaining?: number; // 当天剩余免费次数
}

interface SubscriptionRecord {
  user_id: string;
  plan: PlanType;
  remaining_tries: number;
  creem_subscription_id?: string | null;
  creem_customer_id?: string | null;
  status: 'active' | 'canceled' | 'expired';
  last_reset_at: string;
  period_end?: string | null; // 订阅计费周期结束时间
  daily_free_tries_used?: number; // 当天已使用的免费次数
  daily_free_tries_date?: string; // 免费次数使用的日期(YYYY-MM-DD)
  created_at?: string;
  updated_at?: string;
}

export class SubscriptionService {
  private client: SupabaseClient;
  private table: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    /**
     * Create Supabase client with explicit configuration.
     * 
     * For subscription service (Cloudflare Worker):
     * - persistSession: false (no localStorage in Worker)
     * - autoRefreshToken: false (service role key doesn't expire, or handled by Supabase)
     * - detectSessionInUrl: false (not needed for service role)
     */
    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // No localStorage in Cloudflare Worker
        autoRefreshToken: false, // Service role key doesn't expire, or handled by Supabase
        detectSessionInUrl: false, // Not needed for service role
      },
    });
    this.table = this.client.from(TABLE_NAME);
  }

  /**
   * 获取今天的日期字符串 (YYYY-MM-DD)
   */
  private getTodayDateString(): string {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * 检查并重置每日免费次数（如果日期已变更）
   */
  private async checkAndResetDailyFreeTries(
    userId: string, 
    currentDate: string, 
    record: SubscriptionRecord
  ): Promise<{ dailyFreeTriesUsed: number; dailyFreeTriesDate: string }> {
    // 如果日期已变更，重置免费次数
    if (record.daily_free_tries_date !== currentDate) {
      await this.table
        .update({
          daily_free_tries_used: 0,
          daily_free_tries_date: currentDate,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      return { dailyFreeTriesUsed: 0, dailyFreeTriesDate: currentDate };
    }
    return {
      dailyFreeTriesUsed: record.daily_free_tries_used || 0,
      dailyFreeTriesDate: record.daily_free_tries_date || currentDate,
    };
  }

  /**
   * 获取用户订阅状态和试穿次数信息
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    try {
      const { data, error } = await this.table
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting subscription:', error);
      }

      if (data) {
        const sub = data as SubscriptionRecord;
        const plan: PlanType = (sub.plan || 'free') as PlanType;
        const planConfig = getPlanConfig(plan);
        const today = this.getTodayDateString();
        
        // 检查并重置每日免费次数
        const { dailyFreeTriesUsed, dailyFreeTriesDate } = 
          await this.checkAndResetDailyFreeTries(userId, today, sub);

        // 记录当前订阅状态，用于调试
        console.log(`📊 Getting subscription status for user ${userId}:`, {
          plan,
          status: sub.status,
          period_end: sub.period_end,
          remaining_tries: sub.remaining_tries,
          daily_free_tries_used: dailyFreeTriesUsed,
        });

        // 检查是否需要重置
        const now = new Date();
        const lastReset = new Date(sub.last_reset_at);
        const daysSinceReset = Math.floor(
          (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
        );

        // 如果订阅已取消，检查是否还在计费周期内
        if (sub.status === 'canceled' || sub.status === 'expired') {
          if (sub.period_end) {
            const periodEnd = new Date(sub.period_end);
            
            // 如果还在计费周期内，继续提供高级功能（直到 period_end）
            if (periodEnd > now) {
              const nextReset = this.addDays(lastReset, planConfig.resetPeriodDays);
              const actualNextReset = periodEnd < nextReset ? periodEnd : nextReset;
              console.log(`✅ ${planConfig.name} subscription canceled but still active until ${periodEnd.toISOString()}`);
              
              const dailyFreeTriesRemaining = Math.max(0, planConfig.dailyFreeTries - dailyFreeTriesUsed);
              
              return {
                planName: planConfig.name,
                remainingTries: sub.remaining_tries || planConfig.monthlyTries,
                totalTries: planConfig.monthlyTries,
                period: planConfig.resetPeriodDays === 1 ? 'daily' : 'monthly',
                nextResetDate: actualNextReset.toISOString(),
                subscriptionId: sub.creem_subscription_id || null,
                customerId: sub.creem_customer_id || null,
                status: sub.status || 'canceled',
                dailyFreeTriesRemaining,
              };
            } else {
              console.log(`⚠️ ${planConfig.name} subscription period ended at ${periodEnd.toISOString()}, downgrading to Free`);
            }
          } else {
            console.log(`⚠️ ${planConfig.name} subscription canceled but no period_end found, downgrading to Free`);
          }
          
          // 计费周期已结束，降级为免费版
          const freeConfig = getPlanConfig('free');
          const nextReset = this.addDays(new Date(), 1);
          const dailyFreeTriesRemaining = Math.max(0, freeConfig.dailyFreeTries - dailyFreeTriesUsed);
          
          return {
            planName: freeConfig.name,
            remainingTries: freeConfig.monthlyTries,
            totalTries: freeConfig.monthlyTries,
            period: 'daily',
            nextResetDate: nextReset.toISOString(),
            subscriptionId: sub.creem_subscription_id || null,
            customerId: sub.creem_customer_id || null,
            status: sub.status || 'canceled',
            dailyFreeTriesRemaining,
          };
        }
        
        // 订阅是 active 状态，正常处理
        if (daysSinceReset >= planConfig.resetPeriodDays) {
          // 保存当前剩余次数，用于累加
          const currentRemaining = sub.remaining_tries || 0;
          await this.resetTries(userId, plan);
          
          // 累加后的次数
          const newRemaining = currentRemaining + planConfig.monthlyTries;
          
          const dailyFreeTriesRemaining = Math.max(0, planConfig.dailyFreeTries - dailyFreeTriesUsed);
          
          return {
            planName: planConfig.name,
            remainingTries: newRemaining, // 返回累加后的次数
            totalTries: planConfig.monthlyTries, // 每月新增的次数
            period: planConfig.resetPeriodDays === 1 ? 'daily' : 'monthly',
            nextResetDate: this.addDays(lastReset, planConfig.resetPeriodDays).toISOString(),
            subscriptionId: sub.creem_subscription_id || null,
            customerId: sub.creem_customer_id || null,
            status: sub.status || 'active',
            dailyFreeTriesRemaining,
          };
        } else {
          const nextReset = this.addDays(lastReset, planConfig.resetPeriodDays);
          const dailyFreeTriesRemaining = Math.max(0, planConfig.dailyFreeTries - dailyFreeTriesUsed);
          
          return {
            planName: planConfig.name,
            remainingTries: sub.remaining_tries || planConfig.monthlyTries,
            totalTries: planConfig.monthlyTries,
            period: planConfig.resetPeriodDays === 1 ? 'daily' : 'monthly',
            nextResetDate: nextReset.toISOString(),
            subscriptionId: sub.creem_subscription_id || null,
            customerId: sub.creem_customer_id || null,
            status: sub.status || 'active',
            dailyFreeTriesRemaining,
          };
        }
      } else {
        // 新用户，创建免费订阅
        await this.createFreeSubscription(userId);
        const freeConfig = getPlanConfig('free');
        const nextReset = this.addDays(new Date(), 1);
        
        return {
          planName: freeConfig.name,
          remainingTries: freeConfig.monthlyTries,
          totalTries: freeConfig.monthlyTries,
          period: 'daily',
          nextResetDate: nextReset.toISOString(),
          subscriptionId: null,
          customerId: null,
          status: 'active',
          dailyFreeTriesRemaining: freeConfig.dailyFreeTries,
        };
      }
    } catch (error: any) {
      console.error('Error getting subscription status:', error);
      // 返回默认免费版
      const freeConfig = getPlanConfig('free');
      return {
        planName: freeConfig.name,
        remainingTries: freeConfig.monthlyTries,
        totalTries: freeConfig.monthlyTries,
        period: 'daily',
        nextResetDate: null,
        subscriptionId: null,
        customerId: null,
        status: 'active',
        dailyFreeTriesRemaining: freeConfig.dailyFreeTries,
      };
    }
  }

  /**
   * 检查并消耗一次试穿次数
   * 实现每天前N次不计入次数的逻辑
   */
  async checkAndConsumeTry(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const status = await this.getSubscriptionStatus(userId);
      const { data } = await this.table.select('*').eq('user_id', userId).single();
      
      if (!data) {
        return { success: false, message: '订阅记录不存在' };
      }

      const record = data as SubscriptionRecord;
      const plan: PlanType = (record.plan || 'free') as PlanType;
      const planConfig = getPlanConfig(plan);
      const today = this.getTodayDateString();

      // 检查并重置每日免费次数（如果日期已变更）
      const { dailyFreeTriesUsed, dailyFreeTriesDate } = 
        await this.checkAndResetDailyFreeTries(userId, today, record);

      // 如果还有免费次数可用，使用免费次数
      if (dailyFreeTriesUsed < planConfig.dailyFreeTries) {
        // 使用免费次数，不扣除 remaining_tries
        await this.table
          .update({
            daily_free_tries_used: dailyFreeTriesUsed + 1,
            daily_free_tries_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        
        console.log(`✅ Used free try (${dailyFreeTriesUsed + 1}/${planConfig.dailyFreeTries}), remaining_tries unchanged`);
        return { success: true, message: '成功（使用免费次数）' };
      }

      // 免费次数已用完，检查付费次数
      if (status.remainingTries <= 0) {
        if (plan === 'free') {
          return {
            success: false,
            message: 'Your daily free try-on limit has been reached. Please try again tomorrow, or upgrade to a premium plan for more tries.',
          };
        } else {
          return {
            success: false,
            message: 'Your monthly try-on limit has been reached. Please wait for next month\'s reset, or contact support.',
          };
        }
      }

      // 消耗付费次数
      const newRemaining = (record.remaining_tries || 0) - 1;
      await this.table
        .update({
          remaining_tries: newRemaining,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      console.log(`✅ Used paid try, remaining: ${newRemaining}`);
      return { success: true, message: '成功' };
    } catch (error: any) {
      console.error('Error checking try:', error);
      return { success: false, message: `检查试穿次数失败: ${error.message}` };
    }
  }

  /**
   * 更新或创建订阅
   */
  async updateSubscription(
    userId: string,
    plan: PlanType,
    creemSubscriptionId?: string | null,
    creemCustomerId?: string | null,
    status: 'active' | 'canceled' | 'expired' = 'active',
    periodEnd?: string | null
  ): Promise<void> {
    try {
      console.log(`📝 Updating subscription for user: ${userId}`, {
        plan,
        creemSubscriptionId,
        creemCustomerId,
        status,
      });

      // 先检查现有记录
      const { data, error: selectError } = await this.table
        .select('*')
        .eq('user_id', userId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('❌ Error checking existing subscription:', selectError);
        throw selectError;
      }

      console.log('📋 Existing subscription data:', data ? 'Found' : 'Not found (will create new)');

      const now = new Date().toISOString();
      const planConfig = getPlanConfig(plan);
      const today = this.getTodayDateString();
      
      // 判断是否是新的计费周期（续费）
      const isNewBillingPeriod = this.isNewBillingPeriod(data, periodEnd, planConfig);
      
      // 如果是新订阅，设置初始次数
      // 如果是套餐类型变化（升级/降级）或续费（新计费周期），累加新的次数
      // 否则保留现有的 remaining_tries（避免状态更新时错误重置次数）
      let remaining: number;
      if (!data) {
        // 新订阅，设置初始次数
        remaining = planConfig.monthlyTries;
        console.log(`📊 New subscription, setting initial tries: ${remaining}`);
      } else if (data.plan !== plan) {
        // 套餐类型变化（升级/降级），累加新套餐的次数
        const currentRemaining = data.remaining_tries !== undefined ? data.remaining_tries : 0;
        remaining = currentRemaining + planConfig.monthlyTries;
        console.log(`📊 Plan changed from ${data.plan} to ${plan}, adding tries: ${currentRemaining} (current) + ${planConfig.monthlyTries} (new ${plan}) = ${remaining} (total)`);
      } else if (isNewBillingPeriod) {
        // 续费（新计费周期），累加新的次数
        const currentRemaining = data.remaining_tries !== undefined ? data.remaining_tries : 0;
        remaining = currentRemaining + planConfig.monthlyTries;
        console.log(`📊 New billing period detected, adding tries: ${currentRemaining} (current) + ${planConfig.monthlyTries} (new) = ${remaining} (total)`);
      } else {
        // 套餐类型未变化且不是新计费周期，保留现有的 remaining_tries
        remaining = data.remaining_tries !== undefined ? data.remaining_tries : planConfig.monthlyTries;
        console.log(`📊 Plan unchanged (${plan}), keeping existing remaining_tries: ${remaining}`);
      }

      const subscriptionData = {
        plan,
        remaining_tries: remaining,
        creem_subscription_id: creemSubscriptionId || null,
        creem_customer_id: creemCustomerId || null,
        status,
        period_end: periodEnd || null,
        last_reset_at: now,
        daily_free_tries_used: 0, // 重置免费次数
        daily_free_tries_date: today,
        updated_at: now,
      };

      if (data) {
        // 更新现有订阅
        console.log('🔄 Updating existing subscription...');
        const { data: updateData, error: updateError } = await this.table
          .update(subscriptionData)
          .eq('user_id', userId)
          .select();

        if (updateError) {
          console.error('❌ Error updating subscription:', updateError);
          console.error('❌ Update error details:', {
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint,
            code: updateError.code,
          });
          throw updateError;
        }

        console.log('✅ Subscription updated successfully:', updateData);
      } else {
        // 创建新订阅
        console.log('➕ Creating new subscription...');
        const insertData = {
          user_id: userId,
          ...subscriptionData,
          created_at: now,
        };

        console.log('📤 Insert data:', insertData);

        const { data: insertResult, error: insertError } = await this.table
          .insert(insertData)
          .select();

        if (insertError) {
          console.error('❌ Error inserting subscription:', insertError);
          console.error('❌ Insert error details:', {
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint,
            code: insertError.code,
        });
          throw insertError;
        }

        console.log('✅ Subscription created successfully:', insertResult);
      }
    } catch (error: any) {
      console.error('❌ Error updating subscription:', error);
      console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      throw error;
    }
  }

  /**
   * 创建免费订阅
   */
  private async createFreeSubscription(userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const today = this.getTodayDateString();
      const freeConfig = getPlanConfig('free');
      
      await this.table.insert({
        user_id: userId,
        plan: 'free',
        remaining_tries: freeConfig.monthlyTries,
        status: 'active',
        last_reset_at: now,
        daily_free_tries_used: 0,
        daily_free_tries_date: today,
        created_at: now,
        updated_at: now,
      });
    } catch (error: any) {
      console.error('Error creating free subscription:', error);
    }
  }

  /**
   * 重置试穿次数（累加模式：保留未用完的次数，并累加新的次数）
   */
  private async resetTries(userId: string, plan: PlanType): Promise<void> {
    try {
      const now = new Date().toISOString();
      const today = this.getTodayDateString();
      const planConfig = getPlanConfig(plan);

      // 获取当前剩余次数
      const { data } = await this.table.select('remaining_tries').eq('user_id', userId).single();
      const currentRemaining = data?.remaining_tries || 0;

      // 累加新的次数（保留未用完的次数）
      const newRemaining = currentRemaining + planConfig.monthlyTries;

      console.log(`🔄 Resetting tries for plan ${plan}: ${currentRemaining} (current) + ${planConfig.monthlyTries} (new) = ${newRemaining} (total)`);

      await this.table
        .update({
          remaining_tries: newRemaining,
          last_reset_at: now,
          daily_free_tries_used: 0, // 重置免费次数
          daily_free_tries_date: today,
          updated_at: now,
        })
        .eq('user_id', userId);
    } catch (error: any) {
      console.error('Error resetting tries:', error);
    }
  }

  /**
   * 判断是否是新的计费周期（续费）
   * 通过比较 period_end 或 last_reset_at 来判断
   */
  private isNewBillingPeriod(
    existingData: SubscriptionRecord | null,
    newPeriodEnd: string | null | undefined,
    planConfig: ReturnType<typeof getPlanConfig>
  ): boolean {
    if (!existingData) {
      return false; // 新订阅，不是续费
    }

    // 如果提供了新的 period_end，检查是否更新了
    if (newPeriodEnd) {
      const newPeriodEndDate = new Date(newPeriodEnd);
      const existingPeriodEnd = existingData.period_end ? new Date(existingData.period_end) : null;
      
      // 如果新的 period_end 比现有的晚，说明进入了新的计费周期
      if (existingPeriodEnd && newPeriodEndDate > existingPeriodEnd) {
        console.log(`📅 New billing period detected: period_end updated from ${existingPeriodEnd.toISOString()} to ${newPeriodEndDate.toISOString()}`);
        return true;
      }
    }

    // 如果 period_end 没有更新，检查 last_reset_at 是否已经超过一个周期
    if (existingData.last_reset_at) {
      const lastReset = new Date(existingData.last_reset_at);
      const now = new Date();
      const daysSinceReset = Math.floor(
        (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 如果距离上次重置已经超过一个周期，说明应该进入新周期
      if (daysSinceReset >= planConfig.resetPeriodDays) {
        console.log(`📅 New billing period detected: ${daysSinceReset} days since last reset (>= ${planConfig.resetPeriodDays} days)`);
        return true;
      }
    }

    return false;
  }

  /**
   * 添加天数
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
