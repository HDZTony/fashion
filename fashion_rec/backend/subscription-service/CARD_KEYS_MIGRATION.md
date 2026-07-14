# 卡密系统迁移与接口

## 环境变量

在 Cloudflare Workers 中增加：

```env
ADMIN_API_KEY=replace-with-a-long-random-admin-key
CARD_KEY_HASH_SECRET=replace-with-a-long-random-hash-secret
SUBSCRIPTION_SERVICE_INTERNAL_KEY=replace-with-a-shared-internal-key
```

`SUPABASE_KEY` 需要具备写入 `card_key_batches`、`card_keys`、`user_subscriptions` 的权限。
`SUBSCRIPTION_SERVICE_INTERNAL_KEY` 需要和 Wormhole `control-plane-worker` 上配置的同名密钥一致。

## Supabase SQL

执行 `sql/card-keys.sql`。

## 管理接口

所有管理接口都需要 Header：

```http
X-Admin-Key: <ADMIN_API_KEY>
```

### 生成卡密

```bash
curl -X POST https://fashion-rec.com/admin/card-key-batches/generate \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "productId": "prod_xxx",
    "count": 100,
    "credits": 5,
    "faceValueCents": 500,
    "currency": "CNY",
    "expiresAt": "2027-01-01T00:00:00Z"
  }'
```

响应中的 `codes` 是明文卡密，只返回一次。数据库只保存 hash 和尾号。

### 直接生成 TXT

Worker 可以直接生成 TXT 文件，导入商城系统使用。TXT 内容只包含卡密本身，一行一个；`faceValueCents` 是卡密购买金额，`credits` 是 Fashion 账户入账次数。

```bash
curl -X POST https://fashion-rec.com/admin/card-key-batches/generate-txt \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -o card-keys.txt \
  -d '{
    "productId": "prod_xxx",
    "productName": "Product name",
    "count": 100,
    "credits": 5,
    "faceValueCents": 500,
    "currency": "CNY",
    "expiresAt": "2027-01-01T00:00:00Z",
    "codeLength": 20
  }'
```

### TXT 批量导入

TXT 内容一行一个卡密，只能包含数字和字母。

```bash
curl -X POST https://fashion-rec.com/admin/card-key-batches/import \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{
    "productId": "prod_xxx",
    "credits": 5,
    "faceValueCents": 500,
    "currency": "CNY",
    "text": "ABCD1234EFGH5678\nZXCV1234QWER5678"
  }'
```

### 命令行生成 TXT

在 `fashion_rec/backend/subscription-service` 目录运行：

```powershell
pnpm card-keys:txt
```

也可以一次性传参：

```powershell
pnpm card-keys:txt -- --count 100 --amount 5 --credits 5 --out card-keys.txt
```

默认会从 `.dev.vars` 读取 `ADMIN_API_KEY`，并调用 Worker 的 `/admin/card-key-batches/generate-txt`。

## 用户兑换接口

```bash
curl -X POST https://fashion-rec.com/card-keys/redeem \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <supabase-jwt>" \
  -d '{ "code": "ABCD1234EFGH5678" }'
```

成功响应：

```json
{
  "success": true,
  "creditsAdded": 5,
  "credits": 30,
  "productId": "prod_xxx",
  "batchId": "...",
  "redeemedAt": "2026-07-01T00:00:00.000Z"
}
```

## Wormhole 内部兑换接口

Wormhole `control-plane-worker` 使用该接口验证并占用卡密，然后把 `credits` 当作真实金额写入 Wormhole 自己的用户账户余额。此接口不会写入 `user_subscriptions.credits`。

```bash
curl -X POST https://fashion-rec.com/internal/card-keys/redeem-for-wormhole \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: $SUBSCRIPTION_SERVICE_INTERNAL_KEY" \
  -d '{
    "userId": "supabase-user-id",
    "code": "ABCD1234EFGH5678",
    "idempotencyKey": "optional-client-or-control-plane-key"
  }'
```

成功响应：

```json
{
  "success": true,
  "creditsAdded": 5,
  "productId": "prod_xxx",
  "batchId": "...",
  "cardKeyId": "...",
  "redeemedAt": "2026-07-01T00:00:00.000Z"
}
```
