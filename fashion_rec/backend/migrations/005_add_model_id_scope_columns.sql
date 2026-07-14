-- Model scope: isolate wardrobe / favorites / history per virtual model (sidebar).
-- Run in Supabase SQL Editor or: apply via Supabase MCP migration add_model_id_scope_columns.

ALTER TABLE wardrobe_items ADD COLUMN IF NOT EXISTS model_id TEXT;
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS model_id TEXT;
ALTER TABLE tryon_history ADD COLUMN IF NOT EXISTS model_id TEXT;
ALTER TABLE multiangle_history ADD COLUMN IF NOT EXISTS model_id TEXT;

CREATE INDEX IF NOT EXISTS idx_wardrobe_items_user_model_created
  ON wardrobe_items (user_id, model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user_model_created
  ON favorites (user_id, model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tryon_history_user_model_created
  ON tryon_history (user_id, model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_multiangle_history_user_model_created
  ON multiangle_history (user_id, model_id, created_at DESC);
