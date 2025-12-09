/**
 * 数据迁移脚本：为现有订阅数据填充 period_end 字段
 * 
 * 使用方法：
 *   pnpm tsx src/migrate-fill-period-end.ts
 */

import { createClient } from '@supabase/supabase-js';
import { createCreem } from 'creem_io';
import { config } from 'dotenv';

// 加载环境变量
config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 错误: SUPABASE_URL 和 SUPABASE_KEY 必须在 .env 文件中设置');
  process.exit(1);
}

// 初始化 Creem 客户端
const isTestMode = process.env.CREEM_TEST_MODE === 'true';
const creemApiKey = isTestMode 
  ? process.env.CREEM_TEST_API_KEY! 
  : process.env.CREEM_PROD_API_KEY!;

if (!creemApiKey) {
  console.error(`❌ ${isTestMode ? '测试' : '生产'}环境 API Key 未配置`);
  process.exit(1);
}

const creem = createCreem({
  apiKey: creemApiKey,
  testMode: isTestMode,
});

async function migrateFillPeriodEnd() {
  console.log('🚀 开始数据迁移: 为现有订阅填充 period_end 字段...\n');

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

    // 1. 查找所有需要填充 period_end 的记录
    console.log('📋 查找需要更新的订阅记录...');
    
    const { data: subscriptions, error: selectError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .is('period_end', null)
      .not('creem_subscription_id', 'is', null);

    if (selectError) {
      console.error('❌ 查询失败:', selectError);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('✅ 所有订阅记录都已包含 period_end，无需迁移');
      return;
    }

    console.log(`📊 找到 ${subscriptions.length} 条需要更新的记录\n`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // 2. 为每条记录获取 period_end
    for (const sub of subscriptions) {
      const subscriptionId = sub.creem_subscription_id;
      const userId = sub.user_id;
      const status = sub.status;

      console.log(`\n处理订阅: ${subscriptionId} (用户: ${userId}, 状态: ${status})`);

      try {
        // 从 Creem API 获取订阅详情
        const creemSubscription = await creem.subscriptions.get({
          subscriptionId: subscriptionId!,
        });

        // 获取 period_end（尝试多个可能的字段名）
        const periodEnd = creemSubscription.current_period_end 
          || creemSubscription.period_end 
          || (creemSubscription.periods && creemSubscription.periods[0]?.end_date)
          || null;

        if (!periodEnd) {
          console.log(`  ⚠️  无法从 Creem API 获取 period_end，尝试估算...`);
          
          // 如果无法获取，基于创建时间估算
          // 对于已取消的订阅，使用 canceled_at + 剩余天数
          // 对于活跃的订阅，使用当前时间 + 30天（月度订阅）
          if (status === 'canceled' || status === 'expired') {
            // 已取消的订阅，如果 canceled_at 存在，使用它
            // 否则使用 created_at + 30天作为估算
            const createdAt = new Date(sub.created_at || sub.updated_at);
            const estimatedEnd = new Date(createdAt);
            estimatedEnd.setDate(estimatedEnd.getDate() + 30);
            
            console.log(`  📅 使用估算的 period_end: ${estimatedEnd.toISOString()}`);
            
            const { error: updateError } = await supabase
              .from('user_subscriptions')
              .update({ period_end: estimatedEnd.toISOString() })
              .eq('user_id', userId);

            if (updateError) {
              console.log(`  ❌ 更新失败: ${updateError.message}`);
              errorCount++;
            } else {
              console.log(`  ✅ 已使用估算值更新`);
              successCount++;
            }
          } else {
            // 活跃订阅，使用当前时间 + 30天
            const estimatedEnd = new Date();
            estimatedEnd.setDate(estimatedEnd.getDate() + 30);
            
            console.log(`  📅 使用估算的 period_end: ${estimatedEnd.toISOString()}`);
            
            const { error: updateError } = await supabase
              .from('user_subscriptions')
              .update({ period_end: estimatedEnd.toISOString() })
              .eq('user_id', userId);

            if (updateError) {
              console.log(`  ❌ 更新失败: ${updateError.message}`);
              errorCount++;
            } else {
              console.log(`  ✅ 已使用估算值更新`);
              successCount++;
            }
          }
        } else {
          // 成功获取 period_end
          const periodEndDate = new Date(periodEnd);
          console.log(`  📅 从 Creem API 获取 period_end: ${periodEndDate.toISOString()}`);

          const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({ period_end: periodEndDate.toISOString() })
            .eq('user_id', userId);

          if (updateError) {
            console.log(`  ❌ 更新失败: ${updateError.message}`);
            errorCount++;
          } else {
            console.log(`  ✅ 更新成功`);
            successCount++;
          }
        }

        // 添加延迟以避免 API 限流
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.log(`  ❌ 处理失败: ${error.message}`);
        errorCount++;
        
        // 如果 API 调用失败，使用估算值
        try {
          const estimatedEnd = new Date();
          if (status === 'canceled' || status === 'expired') {
            const createdAt = new Date(sub.created_at || sub.updated_at);
            estimatedEnd.setTime(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
          } else {
            estimatedEnd.setDate(estimatedEnd.getDate() + 30);
          }

          const { error: updateError } = await supabase
            .from('user_subscriptions')
            .update({ period_end: estimatedEnd.toISOString() })
            .eq('user_id', userId);

          if (!updateError) {
            console.log(`  ✅ 已使用估算值作为后备方案`);
            successCount++;
            errorCount--;
          }
        } catch (fallbackError: any) {
          console.log(`  ❌ 后备方案也失败: ${fallbackError.message}`);
        }
      }
    }

    // 3. 处理没有 creem_subscription_id 的记录（免费版用户）
    console.log('\n📋 处理免费版用户（无 creem_subscription_id）...');
    
    const { data: freeSubscriptions, error: freeSelectError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .is('creem_subscription_id', null)
      .is('period_end', null);

    if (!freeSelectError && freeSubscriptions && freeSubscriptions.length > 0) {
      console.log(`📊 找到 ${freeSubscriptions.length} 条免费版记录`);
      
      // 免费版用户不需要 period_end，但可以设置为 null 或未来日期
      // 这里设置为 null 即可，因为免费版不受 period_end 影响
      console.log('✅ 免费版用户不需要 period_end，跳过');
      skippedCount += freeSubscriptions.length;
    }

    // 4. 输出迁移结果
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('迁移完成！');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`✅ 成功更新: ${successCount} 条`);
    console.log(`⚠️  跳过: ${skippedCount} 条（免费版）`);
    console.log(`❌ 失败: ${errorCount} 条`);
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  }
}

migrateFillPeriodEnd().catch(console.error);
