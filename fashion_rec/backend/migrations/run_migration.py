"""
数据库迁移脚本：更新 user_images 表的 image_type 约束

将 image_type 约束从只允许 'sence' 更新为允许 'background' 和 'model'
"""
import os
import sys
from pathlib import Path

# 添加父目录到路径，以便导入服务模块
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.supabase_client import create_supabase_client
from dotenv import load_dotenv

load_dotenv()


def run_migration():
    """
    执行数据库迁移：更新 user_images 表的 image_type 约束
    """
    print("[Migration] Starting migration: Update user_images.image_type constraint")
    
    # 创建 Supabase 客户端（需要 service role key 来修改表结构）
    client = create_supabase_client()
    
    # 读取 SQL 文件
    sql_file = Path(__file__).parent / "001_update_image_type_constraint.sql"
    if not sql_file.exists():
        print(f"[Migration] Error: SQL file not found: {sql_file}")
        return False
    
    with open(sql_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    # 分割 SQL 语句（按分号分割，但保留注释）
    statements = []
    current_statement = []
    
    for line in sql_content.split('\n'):
        line = line.strip()
        # 跳过注释和空行
        if not line or line.startswith('--'):
            continue
        
        current_statement.append(line)
        
        # 如果行以分号结尾，说明是一个完整的语句
        if line.endswith(';'):
            statement = ' '.join(current_statement)
            if statement.strip():
                statements.append(statement)
            current_statement = []
    
    # 执行每个 SQL 语句
    try:
        for i, statement in enumerate(statements, 1):
            print(f"[Migration] Executing statement {i}/{len(statements)}...")
            print(f"[Migration] SQL: {statement[:100]}...")
            
            # 使用 Supabase 的 RPC 或者直接执行 SQL
            # 注意：Supabase Python 客户端可能不支持直接执行 DDL 语句
            # 可能需要通过 Supabase Dashboard 的 SQL Editor 执行
            # 或者使用 psycopg2 直接连接 PostgreSQL
            
            # 尝试使用 Supabase 的 REST API 执行 SQL
            # 但 Supabase REST API 通常不支持 DDL 操作
            # 所以这里我们只是打印 SQL，建议用户在 Supabase Dashboard 中执行
            
            print(f"[Migration] ⚠️  Warning: Supabase Python client may not support DDL operations.")
            print(f"[Migration] Please execute the following SQL in Supabase Dashboard > SQL Editor:")
            print("\n" + "="*80)
            print(statement)
            print("="*80 + "\n")
        
        print("[Migration] ✅ Migration instructions printed above.")
        print("[Migration] Please execute the SQL statements in Supabase Dashboard > SQL Editor.")
        return True
        
    except Exception as e:
        print(f"[Migration] ❌ Error executing migration: {e}")
        return False


if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
