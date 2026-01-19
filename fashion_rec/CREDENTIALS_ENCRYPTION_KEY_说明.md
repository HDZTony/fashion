# CREDENTIALS_ENCRYPTION_KEY 说明

## 这是什么？

`CREDENTIALS_ENCRYPTION_KEY` 是一个**加密密钥**，用于加密存储在数据库中的 Google Search Console OAuth 凭据。

## 为什么需要它？

当用户连接 Google Search Console 时，系统会获取用户的 OAuth token 和 refresh token。这些敏感信息需要：
1. **加密存储**在数据库中
2. 使用这个密钥进行加密/解密

## 如何生成？

### 方法一：使用 Python（推荐）

```bash
cd fashion_rec/backend
uv run python -c "import secrets; print('CREDENTIALS_ENCRYPTION_KEY=' + secrets.token_urlsafe(32))"
```

或者使用系统 Python：

```bash
python -c "import secrets; print('CREDENTIALS_ENCRYPTION_KEY=' + secrets.token_urlsafe(32))"
```

### 方法二：使用 OpenSSL

```bash
openssl rand -base64 32
```

### 方法三：使用在线工具

访问：https://generate-secret.vercel.app/32

## 已生成的密钥

我已经为你生成了一个密钥，并添加到了 `fashion_rec/backend/.env` 文件中：

```
CREDENTIALS_ENCRYPTION_KEY=PTpBbI9nIKKIdJzKuNYL9auMck5yFtn4y6mSX93rxtY
```

## 重要安全提示

1. **不要提交到代码仓库**
   - 确保 `.env` 文件在 `.gitignore` 中
   - 不要将密钥提交到 Git

2. **生产环境使用更强的密钥**
   - 当前密钥是自动生成的，可以用于开发
   - 生产环境建议使用更长的随机密钥（至少 64 字符）

3. **密钥丢失的后果**
   - 如果密钥丢失，已加密的凭据将无法解密
   - 用户需要重新连接 Google Search Console

4. **密钥轮换**
   - 如果需要更换密钥，需要先解密所有现有凭据
   - 使用新密钥重新加密
   - 或者让用户重新连接

## 验证配置

检查密钥是否已正确配置：

```bash
# 在 backend 目录下
grep CREDENTIALS_ENCRYPTION_KEY .env
```

应该看到：
```
CREDENTIALS_ENCRYPTION_KEY=PTpBbI9nIKKIdJzKuNYL9auMck5yFtn4y6mSX93rxtY
```

## 工作原理

1. **存储时**：
   - 用户连接 Google Search Console
   - 获取 OAuth 凭据（token, refresh_token 等）
   - 使用 `CREDENTIALS_ENCRYPTION_KEY` 加密
   - 存储到数据库

2. **读取时**：
   - 从数据库读取加密的凭据
   - 使用 `CREDENTIALS_ENCRYPTION_KEY` 解密
   - 返回给 API 使用

## 故障排查

### 问题：提示 "Failed to decrypt credentials"

**原因**：密钥不匹配或密钥格式错误

**解决**：
1. 检查 `.env` 文件中的密钥是否正确
2. 确认密钥长度至少 32 字符
3. 如果密钥已更改，用户需要重新连接

### 问题：找不到环境变量

**原因**：环境变量未正确加载

**解决**：
1. 确认 `.env` 文件在 `fashion_rec/backend/` 目录下
2. 重启后端服务
3. 检查环境变量是否被正确读取
