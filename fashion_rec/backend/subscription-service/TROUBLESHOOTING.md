# 订阅服务故障排查指南

## Forbidden (403) 错误排查

如果遇到 "Error: Forbidden" 错误，请按以下步骤排查：

### 1. 检查 API Key 配置

访问诊断端点检查 API 连接：
```
GET http://localhost:3001/diagnostics
```

这会返回：
- API Key 是否设置
- 测试模式状态
- API 连接状态
- 可用产品列表

### 2. 验证 API Key

**可能的问题：**
- API Key 已过期或无效
- API Key 没有创建 checkout 的权限
- 使用了错误的 API Key（测试/生产环境混淆）

**解决方案：**
1. 登录 [Creem Dashboard](https://creem.io)
2. 进入 **Settings** > **API Keys**
3. 确认你的 API Key 是否有效
4. 如果在测试模式，确保使用的是测试环境的 API Key
5. 确认 API Key 具有创建 checkout 的权限

### 3. 验证产品 ID

**可能的问题：**
- 产品 ID 不存在
- 产品 ID 在测试环境中不存在（但你在测试模式）
- 产品 ID 在生产环境中不存在（但你在生产模式）

**解决方案：**
1. 访问诊断端点查看可用产品列表：
   ```
   GET http://localhost:3001/diagnostics
   ```
   
2. 或者直接查看产品列表：
   ```
   GET http://localhost:3001/products
   ```

3. 确认前端 `.env` 中的 `VITE_CREEM_PRODUCT_ID` 与可用产品列表中的 ID 匹配

4. 如果产品 ID 不匹配：
   - 在 Creem Dashboard 中创建产品（测试/生产环境分别创建）
   - 更新 `.env` 文件中的 `VITE_CREEM_PRODUCT_ID`

### 4. 检查测试模式配置

确保测试模式与 API Key 匹配：
- 如果 `CREEM_TEST_MODE=true`，使用测试环境的 API Key 和产品 ID
- 如果 `CREEM_TEST_MODE=false`，使用生产环境的 API Key 和产品 ID

**检查当前配置：**
```bash
# 查看 subscription-service/.env
cat subscription-service/.env | grep CREEM
```

### 5. 查看详细错误日志

改进后的错误处理会输出更详细的日志，包括：
- 请求的 productId
- 测试模式状态
- API Key 前缀（用于验证）
- 完整的错误响应

查看服务日志以获取更多信息。

### 6. 测试步骤

1. **测试 API 连接：**
   ```bash
   curl http://localhost:3001/diagnostics
   ```

2. **查看产品列表：**
   ```bash
   curl http://localhost:3001/products
   ```

3. **手动测试创建 checkout：**
   ```bash
   curl -X POST http://localhost:3001/checkouts \
     -H "Content-Type: application/json" \
     -d '{
       "productId": "prod_1W4roSJevbLIRwQyb3a8SQ",
       "successUrl": "http://localhost:5173/pricing?success=true",
       "cancelUrl": "http://localhost:5173/pricing?canceled=true",
       "metadata": {"userId": "test-user"}
     }'
   ```

### 7. 常见错误及解决方案

#### 错误：API 密钥无效或权限不足
- **原因**：API Key 无效或没有创建 checkout 的权限
- **解决**：在 Creem Dashboard 中重新生成 API Key 并确保有相应权限

#### 错误：产品 ID 不存在
- **原因**：产品 ID 在指定环境中不存在
- **解决**：使用诊断端点查看可用产品，或创建新产品

#### 错误：测试/生产环境不匹配
- **原因**：测试模式下使用了生产环境的 API Key 或产品 ID
- **解决**：确保 `CREEM_TEST_MODE` 与 API Key、产品 ID 的环境一致

## 联系支持

如果以上步骤都无法解决问题，请：
1. 收集诊断端点输出的完整信息
2. 查看服务日志的详细错误信息
3. 检查 Creem Dashboard 中的配置
4. 联系 Creem 支持团队
