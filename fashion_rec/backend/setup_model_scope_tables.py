"""
为侧边栏数据增加 model_id 作用域列。
运行: uv run python setup_model_scope_tables.py
"""

SQL = """
-- 1) 在需要按模特隔离的表增加 model_id（可空，兼容历史数据）
ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS model_id TEXT;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS model_id TEXT;
ALTER TABLE tryon_history ADD COLUMN IF NOT EXISTS model_id TEXT;
ALTER TABLE multiangle_history ADD COLUMN IF NOT EXISTS model_id TEXT;

-- 2) 常用查询索引（user_id + model_id）
CREATE INDEX IF NOT EXISTS idx_wardrobe_items_user_model_created
  ON wardrobe_items (user_id, model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_model_created
  ON favorites (user_id, model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tryon_history_user_model_created
  ON tryon_history (user_id, model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_multiangle_history_user_model_created
  ON multiangle_history (user_id, model_id, created_at DESC);
"""

RLS_CHECK_SQL = """
-- 3) RLS 检查建议：确认现有策略允许 model_id 列读写
--   如果策略仅校验 auth.uid() = user_id，通常无需新增策略。
--   可在 Supabase SQL Editor 执行以下语句审查:
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('wardrobe_items', 'favorites', 'tryon_history', 'multiangle_history')
ORDER BY tablename, policyname;
"""

if __name__ == "__main__":
    print("=" * 70)
    print("Model Scope Migration SQL")
    print("=" * 70)
    print(SQL)
    print("=" * 70)
    print("RLS Review SQL")
    print("=" * 70)
    print(RLS_CHECK_SQL)
