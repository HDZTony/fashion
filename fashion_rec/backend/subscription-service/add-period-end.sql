-- 添加 period_end 字段到 user_subscriptions 表
-- 在 Supabase Dashboard > SQL Editor 中执行此 SQL

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
