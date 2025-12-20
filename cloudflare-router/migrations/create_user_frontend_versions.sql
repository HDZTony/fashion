-- 创建用户前端版本表
-- 在 Supabase SQL Editor 中执行此脚本

CREATE TABLE IF NOT EXISTS user_frontend_versions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT 'stable' CHECK (version IN ('stable', 'v2')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_frontend_versions_user_id 
ON user_frontend_versions(user_id);

-- 启用行级安全策略
ALTER TABLE user_frontend_versions ENABLE ROW LEVEL SECURITY;

-- 允许 Service Role 访问（Worker 使用 Service Role Key 可以绕过 RLS）
-- 注意：Service Role Key 本身可以绕过 RLS，这个策略主要是为了其他场景
CREATE POLICY "Service role can read all versions"
ON user_frontend_versions FOR SELECT
USING (true);

-- 用户可以通过 Supabase Dashboard 或 SQL 直接更新自己的版本
CREATE POLICY "Users can update their own version"
ON user_frontend_versions FOR ALL
USING (auth.uid() = user_id);

