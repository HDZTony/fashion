"""
设置模特档案表 - 显示 SQL 代码供在 Supabase Dashboard 中执行
运行: uv run python setup_model_profiles_table.py
"""

SQL = """
-- 模特档案表：存储每个模特的昵称、身高、体重、出生年份
-- model_id 使用 TEXT 类型，支持用户上传模特(UUID)和系统示例模特(如 example-IMG_9953)
CREATE TABLE IF NOT EXISTS model_profiles (
    user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    nickname TEXT,          -- 昵称
    height   REAL,         -- 身高 (cm)
    weight   REAL,         -- 体重 (kg)
    birth_year INT,        -- 出生年份
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, model_id)
);

-- RLS: 用户只能读写自己的数据
ALTER TABLE model_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profiles"
    ON model_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profiles"
    ON model_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profiles"
    ON model_profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profiles"
    ON model_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- updated_at 自动更新
CREATE OR REPLACE FUNCTION update_model_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_profiles_updated_at
    BEFORE UPDATE ON model_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_model_profiles_updated_at();
"""

MIGRATE_SQL = """
-- 如果表已存在，将 image_id 列重命名为 model_id
ALTER TABLE model_profiles RENAME COLUMN image_id TO model_id;
"""

ADD_NICKNAME_SQL = """
-- 给已有的表添加 nickname 列
ALTER TABLE model_profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
"""

if __name__ == "__main__":
    print("=" * 70)
    print("模特档案表 (model_profiles) 设置")
    print("=" * 70)
    print()
    print("【新建表】如果还没有建表，请执行以下 SQL：")
    print(SQL)
    print()
    print("=" * 70)
    print("【迁移】如果表已经存在（列名是 image_id），请执行以下 SQL：")
    print(MIGRATE_SQL)
