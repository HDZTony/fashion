CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS card_key_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  product_name TEXT,
  credits INTEGER NOT NULL CHECK (credits > 0),
  face_value_cents INTEGER CHECK (face_value_cents IS NULL OR face_value_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  valid_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'generated' CHECK (source IN ('generated', 'txt_import')),
  total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES card_key_batches(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  face_value_cents INTEGER CHECK (face_value_cents IS NULL OR face_value_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'CNY',
  code_hash TEXT NOT NULL UNIQUE,
  code_last4 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'redeemed', 'disabled', 'expired')),
  valid_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  redeemed_by_user_id TEXT,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_key_batches_product_id
ON card_key_batches(product_id);

CREATE INDEX IF NOT EXISTS idx_card_keys_product_status
ON card_keys(product_id, status);

CREATE INDEX IF NOT EXISTS idx_card_keys_batch_id
ON card_keys(batch_id);

CREATE INDEX IF NOT EXISTS idx_card_keys_redeemed_by_user_id
ON card_keys(redeemed_by_user_id);
