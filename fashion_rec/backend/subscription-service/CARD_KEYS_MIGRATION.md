# 卡密系统迁移与接口

## 环境变量

在 Cloudflare Workers 中增加：

```env
ADMIN_API_KEY=replace-with-a-long-random-admin-key
CARD_KEY_HASH_SECRET=replace-with-a-long-random-hash-secret
```

`SUPABASE_KEY` 需要具备写入 `card_key_batches`、`card_keys`、`user_subscriptions` 的权限。

## Supabase SQL

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS card_key_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  product_name TEXT,
  credits INTEGER NOT NULL CHECK (credits > 0),
  face_value_cents INTEGER CHECK (face_value_cents IS NULL OR face_value_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
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
  currency TEXT NOT NULL DEFAULT 'USD',
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
```

## 管理接口

所有管理接口都需要 Header：

```http
X-Admin-Key: <ADMIN_API_KEY>
```

### 生成卡密

```bash
curl -X POST https://fashion-rec-subscription-service.954504788.workers.dev/admin/card-key-batches/generate \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "productId": "prod_xxx",
    "count": 100,
    "credits": 100,
    "faceValueCents": 999,
    "currency": "USD",
    "expiresAt": "2027-01-01T00:00:00Z"
  }'
```

响应中的 `codes` 是明文卡密，只返回一次。数据库只保存 hash 和尾号。

### 直接生成 TXT

Worker 可以直接生成 TXT 文件，导入商城系统使用。TXT 内容只包含卡密本身，一行一个；金额、credits、有效期保存在 Worker 数据库中，用户兑换时通过 hash 验证出来。

```bash
curl -X POST https://fashion-rec-subscription-service.954504788.workers.dev/admin/card-key-batches/generate-txt \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -o card-keys.txt \
  -d '{
    "productId": "prod_xxx",
    "productName": "Product name",
    "count": 100,
    "credits": 100,
    "faceValueCents": 999,
    "currency": "USD",
    "expiresAt": "2027-01-01T00:00:00Z",
    "codeLength": 20
  }'
```

不再支持把商城 TXT 反向导入 Worker；`POST /admin/card-key-batches/import` 已禁用。

## 用户兑换接口

```bash
curl -X POST https://fashion-rec-subscription-service.954504788.workers.dev/card-keys/redeem \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-jwt>" \
  -d '{ "code": "ABCD1234EFGH5678" }'
```

成功响应：

```json
{
  "success": true,
  "creditsAdded": 100,
  "credits": 300,
  "productId": "prod_xxx",
  "batchId": "...",
  "redeemedAt": "2026-07-01T00:00:00.000Z"
}
```
