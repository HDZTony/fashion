/**
 * 订阅管理服务
 * 管理用户订阅状态和试穿次数限制
 * 使用配置模块，方便移植到其他项目
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  PlanType, 
  getPlanName, 
} from './plan-config';

const TABLE_NAME = 'user_subscriptions';

/**
 * 每个账号的初始 credits
 * 直接创建账号时默认给100 credits
 */
const INITIAL_CREDITS = 100;

interface UserInfo {
  planName: string;
  credits: number;
  period: 'daily'; // 免费次数重置周期
  nextResetDate: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  status: string | null;
  dailyFreeTriesRemaining?: number; // 当天剩余免费次数
}

interface SubscriptionRecord {
  user_id: string;
  plan: PlanType;
  credits: number;
  creem_subscription_id?: string | null;
  creem_customer_id?: string | null;
  // 存储来自 Creem 的原始状态（如 trialing/active/canceled/expired 等）
  status: string | null;
  last_reset_at: string;
  period_end?: string | null; // 订阅计费周期结束时间
  last_transaction_id?: string | null; // 最后一次交易的ID，用于判断是否是新交易
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
        persistSession: true, // localStorage in Cloudflare Worker
        autoRefreshToken: true, // Service role key doesn't expire, or handled by Supabase
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
   * 将任意 Creem 状态规范化为业务三态
   */
  private normalizeStatus(status: string | null | undefined): 'active' | 'canceled' | 'expired' {
    const lower = (status || '').toLowerCase();
    console.log(`🔍 [normalizeStatus] status: ${status}, lower: ${lower}`, {
      status,
      lower,
    });
    if (lower === 'canceled' || lower === 'scheduled_cancel') return 'canceled';
    if (lower === 'expired' || lower === 'unpaid') return 'expired';
    return 'active';
  }

  /**
   * 获取用户订阅状态和试穿次数信息
   */
  /**
   * 获取订阅状态
   * @param userId 用户ID
   * @param cachedData 可选的缓存数据，如果提供则跳过数据库查询（优化性能）
   */
  async getUserInfo(userId: string, cachedData?: any): Promise<UserInfo> {
    try {
      let data: any = null;
      let error: any = null;
      
      // 如果提供了缓存数据，直接使用，避免重复查询数据库
      if (cachedData) {
        data = cachedData;
      } else {
        // 如果没有缓存数据，查询数据库
        const queryResult = await this.table
          .select('*')
          .eq('user_id', userId)
          .single();
        data = queryResult.data;
        error = queryResult.error;
      }

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting subscription:', error);
      }

      if (data) {
        const sub = data as SubscriptionRecord;
        if (!sub.plan) {
          throw new Error(`Plan is missing for user ${userId}`);
        }
        const plan: PlanType = sub.plan;
        const today = this.getTodayDateString();
        
        // 检查并重置每日免费次数
        const { dailyFreeTriesUsed, dailyFreeTriesDate } = 
          await this.checkAndResetDailyFreeTries(userId, today, sub);

        // 记录当前订阅状态，用于调试
        console.log(`📊 Getting subscription status for user ${userId}:`, {
          plan,
          status: sub.status,
          period_end: sub.period_end,
          credits: sub.credits,
          daily_free_tries_used: dailyFreeTriesUsed,
        });

        // 检查是否需要重置
        const now = new Date();
        const lastReset = new Date(sub.last_reset_at);
        const normalizedStatus = this.normalizeStatus(sub.status);
        const daysSinceReset = Math.floor(
          (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
        );

        // 如果订阅已取消/过期，检查是否还在计费周期内
        if (normalizedStatus === 'canceled' || normalizedStatus === 'expired') {
          if (sub.period_end) {
            const periodEnd = new Date(sub.period_end);
            
            // 如果还在计费周期内，继续提供高级功能（直到 period_end）
            if (periodEnd > now) {
              const RESET_PERIOD_DAYS = 30; // 重置周期（天数）
              const DAILY_FREE_TRIES = 3; // 每天免费次数
              const nextReset = this.addDays(lastReset, RESET_PERIOD_DAYS);
              const actualNextReset = periodEnd < nextReset ? periodEnd : nextReset;
              console.log(`✅ ${getPlanName(plan)} subscription canceled but still active until ${periodEnd.toISOString()}`);
              
              const dailyFreeTriesRemaining = Math.max(0, DAILY_FREE_TRIES - dailyFreeTriesUsed);
              
              // 订阅和次数无关，直接使用现有次数
              const currentRemaining = sub.credits ?? 0;
              
              return {
                planName: getPlanName(plan),
                credits: currentRemaining,
                period: 'daily',
                nextResetDate: actualNextReset.toISOString(),
                subscriptionId: sub.creem_subscription_id || null,
                customerId: sub.creem_customer_id || null,
                status: sub.status || 'canceled',
                dailyFreeTriesRemaining,
              };
            } else {
              console.log(`⚠️ ${getPlanName(plan)} subscription period ended at ${periodEnd.toISOString()}`);
            }
          } else {
            console.log(`⚠️ ${getPlanName(plan)} subscription canceled but no period_end found`);
          }
          
          // 计费周期已结束，保持当前 plan 但状态为 expired
          // 注意：订阅和次数无关，直接使用用户现有的剩余次数
          const DAILY_FREE_TRIES = 3; // 每天免费次数
          const nextReset = this.addDays(new Date(), 1);
          const dailyFreeTriesRemaining = Math.max(0, DAILY_FREE_TRIES - dailyFreeTriesUsed);
          
          // 订阅和次数无关，直接使用现有次数
          const currentRemaining = sub.credits ?? 0;
          
          return {
            planName: getPlanName(plan),
            credits: currentRemaining,
            period: 'daily',
            nextResetDate: nextReset.toISOString(),
            subscriptionId: sub.creem_subscription_id || null,
            customerId: sub.creem_customer_id || null,
            status: 'expired',
            dailyFreeTriesRemaining,
          };
        }
        
        // 订阅是 active 状态，正常处理
        const RESET_PERIOD_DAYS = 30; // 重置周期（天数）
        const DAILY_FREE_TRIES = 3; // 每天免费次数
        if (daysSinceReset >= RESET_PERIOD_DAYS) {
          // 注意：订阅和次数无关，重置时保持现有次数
          const currentRemaining = sub.credits ?? 0;
          await this.resetTries(userId, plan);
          
          // 订阅不影响次数，保持现有次数
          const newRemaining = currentRemaining;
          
          const dailyFreeTriesRemaining = Math.max(0, DAILY_FREE_TRIES - dailyFreeTriesUsed);
          
          return {
            planName: getPlanName(plan),
            credits: newRemaining, // 订阅不影响次数
            period: 'daily',
            nextResetDate: this.addDays(lastReset, RESET_PERIOD_DAYS).toISOString(),
            subscriptionId: sub.creem_subscription_id || null,
            customerId: sub.creem_customer_id || null,
            status: sub.status || 'active',
            dailyFreeTriesRemaining,
          };
        } else {
          const nextReset = this.addDays(lastReset, RESET_PERIOD_DAYS);
          const dailyFreeTriesRemaining = Math.max(0, DAILY_FREE_TRIES - dailyFreeTriesUsed);
          
          return {
            planName: getPlanName(plan),
            credits: sub.credits ?? 0, // 订阅和次数无关，直接使用现有次数
            period: 'daily',
            nextResetDate: nextReset.toISOString(),
            subscriptionId: sub.creem_subscription_id || null,
            customerId: sub.creem_customer_id || null,
            status: sub.status || 'active',
            dailyFreeTriesRemaining,
          };
        }
      } else {
        // 新用户，插入新记录（数据库默认 credits 为 100）
        const now = new Date().toISOString();
        const today = this.getTodayDateString();
        
        // 插入新记录，依赖数据库默认值 credits = 100
        const { data: newRecord } = await this.table.insert({
          user_id: userId,
          plan: 'member',
          status: 'active',
          last_reset_at: now,
          daily_free_tries_used: 0,
          daily_free_tries_date: today,
          created_at: now,
          updated_at: now,
        }).select().single();
        
        const RESET_PERIOD_DAYS = 30; // 重置周期（天数）
        const DAILY_FREE_TRIES = 3; // 每天免费次数
        const nextReset = this.addDays(new Date(), RESET_PERIOD_DAYS);
        
        return {
          planName: getPlanName('member'),
          credits: newRecord?.credits ?? INITIAL_CREDITS,
          period: 'daily',
          nextResetDate: nextReset.toISOString(),
          subscriptionId: null,
          customerId: null,
          status: 'active',
          dailyFreeTriesRemaining: DAILY_FREE_TRIES,
        };
      }
    } catch (error: any) {
      console.error('Error getting subscription status:', error);
      // 返回默认 member plan（直接创建账号时默认给100次）
      const DAILY_FREE_TRIES = 3; // 每天免费次数
      return {
        planName: getPlanName('member'),
        credits: INITIAL_CREDITS,
        period: 'daily',
        nextResetDate: null,
        subscriptionId: null,
        customerId: null,
        status: 'active',
        dailyFreeTriesRemaining: DAILY_FREE_TRIES,
      };
    }
  }

  /**
   * 获取订阅状态（getUserInfo 的别名，保持向后兼容）
   * @param userId 用户ID
   * @param cachedData 可选的缓存数据
   */
  async getSubscriptionStatus(userId: string, cachedData?: any): Promise<UserInfo> {
    return this.getUserInfo(userId, cachedData);
  }

  /**
   * 检查并消耗一次试穿次数
   * 实现每天前N次不计入次数的逻辑
   */
  async checkAndConsumeTry(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const status = await this.getUserInfo(userId);
      const { data } = await this.table.select('*').eq('user_id', userId).single();
      
      if (!data) {
        return { success: false, message: '订阅记录不存在' };
      }

      const record = data as SubscriptionRecord;
      if (!record.plan) {
        throw new Error(`Plan is missing for user ${userId}`);
      }
      const plan: PlanType = record.plan;
      const today = this.getTodayDateString();

      // 检查并重置每日免费次数（如果日期已变更）
      const { dailyFreeTriesUsed, dailyFreeTriesDate } = 
        await this.checkAndResetDailyFreeTries(userId, today, record);

      // 如果还有免费次数可用，使用免费次数
      const DAILY_FREE_TRIES = 3; // 每天免费次数
      if (dailyFreeTriesUsed < DAILY_FREE_TRIES) {
        // 使用免费次数，不扣除 credits
        await this.table
          .update({
            daily_free_tries_used: dailyFreeTriesUsed + 1,
            daily_free_tries_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        
        console.log(`✅ Used free try (${dailyFreeTriesUsed + 1}/${DAILY_FREE_TRIES}), credits unchanged`);
        return { success: true, message: '成功（使用免费次数）' };
      }

      // 免费次数已用完，检查付费次数
      if (status.credits <= 0) {
        return {
          success: false,
          message: 'Your try-on limit has been reached. Please try again tomorrow, or contact support.',
        };
      }

      // 消耗付费次数
      const newRemaining = (record.credits ?? 0) - 1;
      await this.table
        .update({
          credits: newRemaining,
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
    status: string = 'active',
    periodEnd?: string | null,
    lastTransactionId?: string | null
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
      const today = this.getTodayDateString();

      const subscriptionData: any = {
        plan,
        creem_subscription_id: creemSubscriptionId || null,
        creem_customer_id: creemCustomerId || null,
        status,
        period_end: periodEnd || null,
        last_transaction_id: lastTransactionId || null, // 保存最后一次交易的ID
        last_reset_at: now,
        daily_free_tries_used: 0, // 重置免费次数
        daily_free_tries_date: today,
        updated_at: now,
      };
      
    

      if (data) {
        // 优化：检查数据是否真的改变了，避免不必要的数据库更新
        const hasChanges = 
          data.plan !== subscriptionData.plan ||
          data.creem_subscription_id !== subscriptionData.creem_subscription_id ||
          data.creem_customer_id !== subscriptionData.creem_customer_id ||
          data.status !== subscriptionData.status ||
          data.period_end !== subscriptionData.period_end ||
          (subscriptionData.last_transaction_id && data.last_transaction_id !== subscriptionData.last_transaction_id);
        
        if (!hasChanges) {
          console.log('⏭️ Skipping database update: no changes detected');
          return;
        }
        
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
   * 增加试穿次数（用于购买 credits）
   * @param userId 用户ID
   * @param additionalTries 要增加的次数
   */
  async addTries(userId: string, additionalTries: number): Promise<void> {
    try {
      console.log(`➕ Adding ${additionalTries} tries for user: ${userId}`);
      
      // 先检查现有记录
      const { data, error: selectError } = await this.table
        .select('credits')
        .eq('user_id', userId)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('❌ Error checking existing subscription:', selectError);
        throw selectError;
      }

      const currentRemaining = data?.credits ?? INITIAL_CREDITS;
      const newRemaining = currentRemaining + additionalTries;

      console.log(`📊 Current credits: ${currentRemaining}, Adding: ${additionalTries}, New total: ${newRemaining}`);

      // 如果记录不存在，创建新记录
      if (!data) {
        const now = new Date().toISOString();
        const today = this.getTodayDateString();

        await this.table.insert({
          user_id: userId,
          plan: 'member',
          status: 'active',
          credits: newRemaining,
          last_reset_at: now,
          daily_free_tries_used: 0,
          daily_free_tries_date: today,
          created_at: now,
          updated_at: now,
        });
      } else {
        // 更新现有记录
        await this.table
          .update({
            credits: newRemaining,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }

      console.log(`✅ Successfully added ${additionalTries} credits for user: ${userId}, new total: ${newRemaining}`);
    } catch (error: any) {
      console.error('❌ Error adding tries:', error);
      throw error;
    }
  }

  /**
   * 重置试穿次数
   * 注意：订阅和次数无关，重置时保持现有次数
   */
  private async resetTries(userId: string, plan: PlanType): Promise<void> {
    try {
      const now = new Date().toISOString();
      const today = this.getTodayDateString();

      // 获取当前剩余次数
      const { data } = await this.table.select('credits').eq('user_id', userId).single();
      const currentRemaining = data?.credits ?? 0;

      // 订阅不影响次数，保持现有次数
      const newRemaining = currentRemaining;
      console.log(`🔄 Resetting tries for plan ${plan}: ${currentRemaining} (kept, subscription does not affect tries)`);

      await this.table
        .update({
          credits: newRemaining,
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
   * 添加天数
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
