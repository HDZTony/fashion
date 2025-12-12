/**
 * 订阅管理服务
 * 管理用户订阅状态和试穿次数限制
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const TABLE_NAME = 'user_subscriptions';

interface SubscriptionStatus {
  planName: 'Free' | 'Premium' | 'Premium Plus';
  remainingTries: number;
  totalTries: number;
  period: 'daily' | 'monthly';
  nextResetDate: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  status: string | null;
}

interface SubscriptionRecord {
  user_id: string;
  plan: 'free' | 'premium' | 'premium_plus';
  remaining_tries: number;
  creem_subscription_id?: string | null;
  creem_customer_id?: string | null;
  status: 'active' | 'canceled' | 'expired';
  last_reset_at: string;
  period_end?: string | null; // 订阅计费周期结束时间
  created_at?: string;
  updated_at?: string;
}

export class SubscriptionService {
  private client: SupabaseClient;
  private table: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.client = createClient(supabaseUrl, supabaseKey);
    this.table = this.client.from(TABLE_NAME);
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
        // PGRST116 是"未找到"错误，这是正常的（新用户）
        console.error('Error getting subscription:', error);
      }

      if (data) {
        const sub = data as SubscriptionRecord;
        const plan = sub.plan || 'free';

        // 检查是否需要重置
        const now = new Date();
        const lastReset = new Date(sub.last_reset_at);
        const daysSinceReset = Math.floor(
          (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (plan === 'free') {
          // 免费版：每天重置
          if (daysSinceReset >= 1) {
            await this.resetTries(userId, 'free');
            return {
              planName: 'Free',
              remainingTries: 1,
              totalTries: 1,
              period: 'daily',
              nextResetDate: this.addDays(lastReset, 1).toISOString(),
              subscriptionId: sub.creem_subscription_id || null,
              customerId: sub.creem_customer_id || null,
              status: sub.status || 'active',
            };
          } else {
            const nextReset = this.addDays(lastReset, 1);
            return {
              planName: 'Free',
              remainingTries: sub.remaining_tries || 1,
              totalTries: 1,
              period: 'daily',
              nextResetDate: nextReset.toISOString(),
              subscriptionId: sub.creem_subscription_id || null,
              customerId: sub.creem_customer_id || null,
              status: sub.status || 'active',
            };
          }
        } else if (plan === 'premium') {
          // 高级版：每月重置
          // 如果订阅已取消，检查是否还在计费周期内
          if (sub.status === 'canceled' || sub.status === 'expired') {
            // 检查是否有 period_end，如果有且还没过期，继续使用高级功能
            if (sub.period_end) {
              const periodEnd = new Date(sub.period_end);
              const now = new Date();
              
              // 如果还在计费周期内，继续提供高级功能
              if (periodEnd > now) {
                const nextReset = this.addDays(lastReset, 30);
                return {
                  planName: 'Premium',
                  remainingTries: sub.remaining_tries || 50,
                  totalTries: 50,
                  period: 'monthly',
                  nextResetDate: nextReset.toISOString(),
                  subscriptionId: sub.creem_subscription_id || null,
                  customerId: sub.creem_customer_id || null,
                  status: sub.status || 'canceled', // 状态显示为已取消，但功能仍可用
                };
              }
            }
            
            // 计费周期已结束，降级为免费版
            const nextReset = this.addDays(new Date(), 1);
            return {
              planName: 'Free',
              remainingTries: 1,
              totalTries: 1,
              period: 'daily',
              nextResetDate: nextReset.toISOString(),
              subscriptionId: sub.creem_subscription_id || null,
              customerId: sub.creem_customer_id || null,
              status: sub.status || 'canceled',
            };
          }
          
          if (daysSinceReset >= 30) {
            await this.resetTries(userId, 'premium');
            return {
              planName: 'Premium',
              remainingTries: 50,
              totalTries: 50,
              period: 'monthly',
              nextResetDate: this.addDays(lastReset, 30).toISOString(),
              subscriptionId: sub.creem_subscription_id || null,
              customerId: sub.creem_customer_id || null,
              status: sub.status || 'active',
            };
          } else {
            const nextReset = this.addDays(lastReset, 30);
            return {
              planName: 'Premium',
              remainingTries: sub.remaining_tries || 50,
              totalTries: 50,
              period: 'monthly',
              nextResetDate: nextReset.toISOString(),
              subscriptionId: sub.creem_subscription_id || null,
              customerId: sub.creem_customer_id || null,
              status: sub.status || 'active',
            };
          }
        } else {
          // Premium Plus：每月重置，200次
          // 如果订阅已取消，检查是否还在计费周期内
          if (sub.status === 'canceled' || sub.status === 'expired') {
            // 检查是否有 period_end，如果有且还没过期，继续使用高级功能
            if (sub.period_end) {
              const periodEnd = new Date(sub.period_end);
              const now = new Date();
              
              // 如果还在计费周期内，继续提供高级功能
              if (periodEnd > now) {
                const nextReset = this.addDays(lastReset, 30);
                return {
                  planName: 'Premium Plus',
                  remainingTries: sub.remaining_tries || 200,
                  totalTries: 200,
                  period: 'monthly',
                  nextResetDate: nextReset.toISOString(),
                  subscriptionId: sub.creem_subscription_id || null,
                  customerId: sub.creem_customer_id || null,
                  status: sub.status || 'canceled', // 状态显示为已取消，但功能仍可用
                };
              }
            }
            
            // 计费周期已结束，降级为免费版
            const nextReset = this.addDays(new Date(), 1);
            return {
              planName: 'Free',
              remainingTries: 1,
              totalTries: 1,
              period: 'daily',
              nextResetDate: nextReset.toISOString(),
              subscriptionId: sub.creem_subscription_id || null,
              customerId: sub.creem_customer_id || null,
              status: sub.status || 'canceled',
            };
          }
          
          if (daysSinceReset >= 30) {
            await this.resetTries(userId, 'premium_plus');
            return {
              planName: 'Premium Plus',
              remainingTries: 200,
              totalTries: 200,
              period: 'monthly',
              nextResetDate: this.addDays(lastReset, 30).toISOString(),
              subscriptionId: sub.creem_subscription_id || null,
              customerId: sub.creem_customer_id || null,
              status: sub.status || 'active',
            };
          } else {
            const nextReset = this.addDays(lastReset, 30);
            return {
              planName: 'Premium Plus',
              remainingTries: sub.remaining_tries || 200,
              totalTries: 200,
              period: 'monthly',
              nextResetDate: nextReset.toISOString(),
              subscriptionId: sub.creem_subscription_id || null,
              customerId: sub.creem_customer_id || null,
              status: sub.status || 'active',
            };
          }
        }
      } else {
        // 新用户，创建免费订阅
        await this.createFreeSubscription(userId);
        const nextReset = this.addDays(new Date(), 1);
        return {
          planName: 'Free',
          remainingTries: 1,
          totalTries: 1,
          period: 'daily',
          nextResetDate: nextReset.toISOString(),
          subscriptionId: null,
          customerId: null,
          status: 'active',
        };
      }
    } catch (error: any) {
      console.error('Error getting subscription status:', error);
      // 返回默认免费版
      return {
        planName: 'Free',
        remainingTries: 1,
        totalTries: 1,
        period: 'daily',
        nextResetDate: null,
        subscriptionId: null,
        customerId: null,
        status: 'active',
      };
    }
  }

  /**
   * 检查并消耗一次试穿次数
   */
  async checkAndConsumeTry(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const status = await this.getSubscriptionStatus(userId);

      if (status.remainingTries <= 0) {
        if (status.planName === 'Free') {
          return {
            success: false,
            message:
              'Your daily free try-on limit has been reached. Please try again tomorrow, or upgrade to a premium plan for more tries.',
          };
        } else {
          return {
            success: false,
            message: 'Your monthly try-on limit has been reached. Please wait for next month\'s reset, or contact support.',
          };
        }
      }

      // 消耗一次
      const { data } = await this.table.select('*').eq('user_id', userId).single();
      if (data) {
        const newRemaining = (data.remaining_tries || 0) - 1;
        await this.table
          .update({
            remaining_tries: newRemaining,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }

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
    plan: 'free' | 'premium' | 'premium_plus',
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
        // PGRST116 是"未找到"错误，这是正常的（新用户）
        console.error('❌ Error checking existing subscription:', selectError);
        throw selectError;
      }

      console.log('📋 Existing subscription data:', data ? 'Found' : 'Not found (will create new)');

      const now = new Date().toISOString();
      const remaining = plan === 'premium' ? 150 : 1;

      const subscriptionData = {
            plan,
            remaining_tries: remaining,
        creem_subscription_id: creemSubscriptionId || null,
        creem_customer_id: creemCustomerId || null,
            status,
            period_end: periodEnd || null,
            last_reset_at: now,
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
      await this.table.insert({
        user_id: userId,
        plan: 'free',
        remaining_tries: 1,
        status: 'active',
        last_reset_at: now,
        created_at: now,
        updated_at: now,
      });
    } catch (error: any) {
      console.error('Error creating free subscription:', error);
    }
  }

  /**
   * 重置试穿次数
   */
  private async resetTries(userId: string, plan: 'free' | 'premium' | 'premium_plus'): Promise<void> {
    try {
      const now = new Date().toISOString();
      const remaining = plan === 'premium_plus' ? 200 : (plan === 'premium' ? 50 : 1);

      await this.table
        .update({
          remaining_tries: remaining,
          last_reset_at: now,
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
