/**
 * 数据库迁移脚本：添加 period_end 字段
 * 使用 Supabase 客户端执行迁移
 * 
 * 使用方法：
 *   pnpm tsx src/migrate-period-end.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as readline from 'readline';

// 加载环境变量
config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 错误: SUPABASE_URL 和 SUPABASE_KEY 必须在 .env 文件中设置');
  process.exit(1);
}

// 创建 readline 接口用于用户输入
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function migrate() {
  console.log('🚀 开始数据库迁移: 添加 period_end 字段...\n');

  const migrationSQL = `
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_subscriptions' 
        AND column_name = 'period_end'
    ) THEN
        ALTER TABLE user_subscriptions 
        ADD COLUMN period_end TIMESTAMPTZ;
        
        COMMENT ON COLUMN user_subscriptions.period_end IS '订阅计费周期结束时间（取消订阅后，用户可继续使用高级功能直到此时间）';
        
        RAISE NOTICE 'period_end 字段已成功添加';
    ELSE
        RAISE NOTICE 'period_end 字段已存在，跳过添加';
    END IF;
END $$;
  `.trim();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('由于 Supabase JS 客户端限制，请使用以下方式执行迁移：');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('方法 1: 使用 Supabase Dashboard (推荐)');
  console.log('───────────────────────────────────────────────────────────');
  console.log('1. 打开浏览器访问:', SUPABASE_URL?.replace('/rest/v1', ''));
  console.log('2. 登录后点击左侧菜单 "SQL Editor"');
  console.log('3. 点击 "New query" 创建新查询');
  console.log('4. 复制并粘贴以下 SQL 代码：\n');
  console.log(migrationSQL);
  console.log('\n5. 点击 "Run" 执行查询');
  console.log('6. 如果看到 "Success. No rows returned" 表示迁移成功\n');

  console.log('方法 2: 使用 Supabase CLI (如果已安装)');
  console.log('───────────────────────────────────────────────────────────');
  console.log('1. 安装 Supabase CLI: npm install -g supabase');
  console.log('2. 登录: supabase login');
  console.log('3. 链接项目: supabase link --project-ref YOUR_PROJECT_REF');
  console.log('4. 执行迁移: supabase db push\n');

  console.log('方法 3: 使用 PostgreSQL 客户端 (psql)');
  console.log('───────────────────────────────────────────────────────────');
  console.log('如果已安装 PostgreSQL 客户端，可以运行 PowerShell 脚本:');
  console.log('  .\\migrate.ps1\n');

  // 尝试使用 Supabase REST API (通常不可用，但尝试一下)
  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    
    // 检查字段是否已存在（通过查询表结构）
    console.log('正在检查 period_end 字段是否存在...');
    
    // 尝试查询表来检查字段
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('period_end')
      .limit(1);

    if (error) {
      // 如果错误是字段不存在，这是预期的
      if (error.message.includes('column') && error.message.includes('period_end')) {
        console.log('✅ 确认: period_end 字段不存在，需要添加\n');
      } else {
        console.log('⚠️  无法自动检查字段状态:', error.message);
        console.log('   请使用方法 1 (Supabase Dashboard) 执行迁移\n');
      }
    } else {
      console.log('✅ period_end 字段已存在，无需迁移\n');
      rl.close();
      return;
    }
  } catch (error: any) {
    console.log('⚠️  自动检查失败:', error.message);
    console.log('   请使用方法 1 (Supabase Dashboard) 执行迁移\n');
  }

  // 询问用户是否要查看 SQL
  const answer = await question('\n是否要复制 SQL 到剪贴板？(y/n): ');
  
  if (answer.toLowerCase() === 'y') {
    // 在 Windows 上复制到剪贴板
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Windows 使用 clip 命令
      const command = `echo ${JSON.stringify(migrationSQL)} | clip`;
      await execAsync(command);
      console.log('✅ SQL 已复制到剪贴板！');
    } catch (err) {
      console.log('⚠️  无法复制到剪贴板，请手动复制上面的 SQL');
    }
  }

  rl.close();
  console.log('\n✨ 迁移指导完成！请按照上述方法执行迁移。');
}

migrate().catch(console.error);
