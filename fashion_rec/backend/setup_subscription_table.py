"""
设置订阅表 - 检查并自动创建 user_subscriptions 表
运行: uv run python setup_subscription_table.py

支持两种方式：
1. 自动创建（如果配置了 DATABASE_URL 或 DB_PASSWORD）
2. 手动创建（显示 SQL 代码供在 Dashboard 中执行）
"""
import os
import sys
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
DB_PASSWORD = os.getenv("DB_PASSWORD")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ 错误: SUPABASE_URL 和 SUPABASE_KEY 必须在环境变量中设置")
    exit(1)

print("="*70)
print("🚀 订阅表设置工具")
print("="*70)
print(f"📡 Supabase URL: {SUPABASE_URL}\n")

# 初始化 Supabase 客户端
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ 成功连接到 Supabase")
except Exception as e:
    print(f"❌ 连接失败: {e}")
    exit(1)

# 检查表是否存在
print("\n🔍 检查表 user_subscriptions 是否存在...")
try:
    result = supabase.table("user_subscriptions").select("user_id").limit(1).execute()
    print("✅ 表 user_subscriptions 已存在！")
    print("\n📊 表信息:")
    print("   - 表名: user_subscriptions")
    print("   - 状态: 已创建")
    print("\n✨ 你可以开始使用订阅功能了！")
    exit(0)
except Exception as e:
    error_msg = str(e).lower()
    if "relation" in error_msg or "does not exist" in error_msg or "not found" in error_msg:
        print("❌ 表 user_subscriptions 不存在")
    else:
        print(f"⚠️  检查表时出错: {e}")
        print("   假设表不存在，继续...")

# 表不存在，尝试自动创建或显示创建指南
print("\n" + "="*70)
print("📋 表不存在，尝试自动创建...")
print("="*70)

# 尝试自动创建表
can_auto_create = False
if DATABASE_URL:
    can_auto_create = True
    print("✅ 检测到 DATABASE_URL，可以自动创建表")
elif DB_PASSWORD and SUPABASE_URL:
    can_auto_create = True
    # 构建数据库连接字符串
    project_ref = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")
    DATABASE_URL = f"postgresql://postgres:{DB_PASSWORD}@db.{project_ref}.supabase.co:5432/postgres"
    print("✅ 检测到 DB_PASSWORD，可以自动创建表")

if can_auto_create:
    print("\n🔧 正在尝试自动创建表...")
    try:
        # 尝试使用 psycopg2
        try:
            import psycopg2
            from psycopg2 import OperationalError
            
            # 尝试多个连接方式
            connection_attempts = []
            
            # 方式1: 使用原始 DATABASE_URL
            connection_attempts.append(("原始连接", DATABASE_URL))
            
            # 方式2: 尝试使用连接池端口 (6543)
            if ":5432/" in DATABASE_URL:
                pool_url = DATABASE_URL.replace(":5432/", ":6543/")
                connection_attempts.append(("连接池端口 (6543)", pool_url))
            
            # 方式3: 尝试使用 aws-0 前缀（某些 Supabase 项目需要）
            if "db." in DATABASE_URL:
                aws_url = DATABASE_URL.replace("db.", "aws-0.")
                connection_attempts.append(("AWS 前缀", aws_url))
            
            conn = None
            used_method = None
            
            for method_name, url in connection_attempts:
                try:
                    print(f"   尝试 {method_name}...")
                    conn = psycopg2.connect(url, connect_timeout=10)
                    used_method = method_name
                    print(f"   ✅ {method_name} 连接成功")
                    break
                except OperationalError as e:
                    error_msg = str(e).lower()
                    if "could not translate host name" in error_msg or "name or service" in error_msg:
                        print(f"   ❌ {method_name} DNS 解析失败")
                        continue
                    else:
                        print(f"   ❌ {method_name} 连接失败: {e}")
                        continue
                except Exception as e:
                    print(f"   ❌ {method_name} 连接失败: {e}")
                    continue
            
            if not conn:
                raise Exception("所有连接方式都失败了。可能是网络问题或 Supabase 配置问题。")
            
            conn.autocommit = True
            cursor = conn.cursor()
            
            # 读取 SQL 文件
            sql_file = os.path.join(os.path.dirname(__file__), "subscription_migration.sql")
            if os.path.exists(sql_file):
                with open(sql_file, 'r', encoding='utf-8') as f:
                    migration_sql = f.read()
            else:
                # 使用内联 SQL
                migration_sql = """-- 创建 user_subscriptions 表
CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    remaining_tries INTEGER NOT NULL DEFAULT 1,
    creem_subscription_id TEXT,
    creem_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
    last_reset_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_creem_subscription_id ON user_subscriptions(creem_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_creem_customer_id ON user_subscriptions(creem_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON user_subscriptions(plan);

-- 创建或更新触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();"""
            
            # 执行 SQL
            cursor.execute(migration_sql)
            cursor.close()
            conn.close()
            
            print("✅ 表创建成功！")
            print("\n🔍 验证表是否创建成功...")
            # 再次检查表
            result = supabase.table("user_subscriptions").select("user_id").limit(1).execute()
            print("✅ 表 user_subscriptions 已存在！")
            print("\n✨ 你可以开始使用订阅功能了！")
            exit(0)
            
        except ImportError:
            print("⚠️  psycopg2 未安装，无法自动创建表")
            print("   安装方法: uv add psycopg2-binary")
            can_auto_create = False
        except Exception as e:
            error_msg = str(e).lower()
            print(f"⚠️  自动创建失败: {e}")
            
            # 提供更详细的错误信息和建议
            if "could not translate host name" in error_msg or "name or service" in error_msg:
                print("\n💡 DNS 解析失败的可能原因:")
                print("   1. 网络连接问题 - 请检查网络连接")
                print("   2. 防火墙阻止 - 请检查防火墙设置")
                print("   3. DNS 服务器问题 - 尝试更换 DNS 服务器")
                print("   4. Supabase 项目配置 - 请确认项目引用 ID 正确")
                print("\n   建议: 使用 Supabase Dashboard 手动创建表（见下方指南）")
            elif "password authentication failed" in error_msg:
                print("\n💡 密码认证失败:")
                print("   请检查 DATABASE_URL 中的密码是否正确")
            elif "timeout" in error_msg:
                print("\n💡 连接超时:")
                print("   可能是网络问题，请稍后重试")
            
            print("   将显示手动创建指南...")
            can_auto_create = False
    except Exception as e:
        print(f"⚠️  自动创建失败: {e}")
        can_auto_create = False

if not can_auto_create:
    print("\n" + "="*70)
    print("📋 需要在 Supabase Dashboard 中创建表")
    print("="*70)

print("\n📝 创建步骤:")
print("1. 打开 Supabase Dashboard: https://app.supabase.com")
print("2. 选择你的项目")
print("3. 点击左侧菜单的 'SQL Editor'")
print("4. 点击 'New query' 按钮")
print("5. 复制下面的 SQL 代码并执行")

print("\n" + "-"*70)
print("SQL 代码 (复制以下内容):")
print("-"*70)
print()

# 读取 SQL 文件
sql_file = os.path.join(os.path.dirname(__file__), "subscription_migration.sql")
if os.path.exists(sql_file):
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    print(sql_content)
else:
    # 如果文件不存在，直接输出 SQL
    print("""-- 创建 user_subscriptions 表
CREATE TABLE IF NOT EXISTS user_subscriptions (
    user_id TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    remaining_tries INTEGER NOT NULL DEFAULT 1,
    creem_subscription_id TEXT,
    creem_customer_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
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
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan 
    ON user_subscriptions(plan);

-- 创建或更新触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS update_user_subscriptions_updated_at ON user_subscriptions;
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();""")

print()
print("-"*70)
print("\n💡 提示:")
print("   - 执行 SQL 后，可以再次运行此脚本验证表是否创建成功")
print("   - SQL 文件位置: fashion_rec/backend/subscription_migration.sql")
print("\n🔗 直接链接:")
print(f"   https://app.supabase.com/project/{SUPABASE_URL.split('//')[1].split('.')[0]}/sql/new")
print("\n" + "="*70)

exit(1)
