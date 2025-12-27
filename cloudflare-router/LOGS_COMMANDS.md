# Cloudflare Workers 日志命令

本文档包含查看和管理 Cloudflare Worker 日志的常用命令。

## 实时查看日志

### 基本命令

```bash
cd cloudflare-router

# 实时查看生产环境日志（默认格式）
pnpm exec wrangler tail fashion-rec-router

# 或者简写（如果在 wrangler.toml 中已配置 name）
pnpm exec wrangler tail
```

### 格式化输出

```bash
# 使用 pretty 格式（更易读）
pnpm exec wrangler tail --format pretty

# 使用 JSON 格式（适合脚本处理）
pnpm exec wrangler tail --format json
```

### 过滤日志

```bash
# 只查看错误日志
pnpm exec wrangler tail --status error

# 只查看成功请求
pnpm exec wrangler tail --status ok

# 同时查看多个状态
pnpm exec wrangler tail --status error --status canceled
```

### 环境指定

```bash
# 查看生产环境日志（默认）
pnpm exec wrangler tail

# 查看 staging 环境日志
pnpm exec wrangler tail --env staging
```

### 搜索过滤

```bash
# 搜索包含特定文本的日志
pnpm exec wrangler tail | grep "error"

# 在 PowerShell 中搜索
pnpm exec wrangler tail | Select-String "error"

# 搜索特定用户 ID
pnpm exec wrangler tail | Select-String "user-id-here"
```

## 在 Cloudflare Dashboard 中查看

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → `fashion-rec-router`
3. 点击 **Logs** 标签页
4. 可以查看实时日志和历史日志
5. 支持过滤、搜索和导出

### Dashboard 日志功能

- **实时日志流**：实时查看 Worker 执行日志
- **日志搜索**：按时间范围、状态码、错误类型过滤
- **日志导出**：导出日志为 CSV 格式
- **性能指标**：查看请求耗时、错误率等指标

## 常用日志场景

### 调试路由问题

```bash
# 查看所有路由相关的日志
pnpm exec wrangler tail --format pretty | Select-String "routing\|version\|KV"
```

### 查看错误

```bash
# 只查看错误日志
pnpm exec wrangler tail --status error --format pretty
```

### 监控特定路径

```bash
# 监控 API 请求
pnpm exec wrangler tail --format pretty | Select-String "/api/"
```

### 查看 KV 缓存操作

```bash
# 查看 KV 相关日志
pnpm exec wrangler tail --format pretty | Select-String "KV\|cache"
```

## 日志格式说明

### Pretty 格式示例

```
[2024-01-15 10:30:45] GET https://fashion.hdz73.com/api/test
  Status: 200
  Duration: 45ms
  User ID: abc123
  Version: v2
```

### JSON 格式示例

```json
{
  "timestamp": 1705315845000,
  "event": {
    "request": {
      "method": "GET",
      "url": "https://fashion.hdz73.com/api/test"
    },
    "response": {
      "status": 200
    }
  },
  "duration": 45,
  "outcome": "ok"
}
```

## 日志持久化

根据 `wrangler.toml` 配置，日志已启用持久化：

```toml
[observability]
[observability.logs]
enabled = false
head_sampling_rate = 1
invocation_logs = true
persist = true
```

**注意**：当前 `enabled = false`，如需启用日志持久化，需要：
1. 在 Dashboard 中启用日志
2. 或设置 `enabled = true` 并重新部署

## 性能监控

```bash
# 查看慢请求（需要配合 grep/Select-String）
pnpm exec wrangler tail --format json | jq 'select(.duration > 100)'

# 统计请求数量
pnpm exec wrangler tail --format json | Measure-Object
```

## 故障排查流程

1. **查看实时错误日志**
   ```bash
   pnpm exec wrangler tail --status error --format pretty
   ```

2. **查看 Dashboard 日志**
   - 更详细的错误堆栈
   - 时间范围筛选
   - 性能分析

3. **搜索特定用户/请求**
   ```bash
   pnpm exec wrangler tail --format pretty | Select-String "user-id-or-request-id"
   ```

4. **检查 KV 操作**
   ```bash
   pnpm exec wrangler tail --format pretty | Select-String "KV\|cache\|USER_VERSIONS"
   ```

## 连接超时问题排查（ETIMEDOUT）

如果遇到 `ETIMEDOUT` 错误，可能是网络连接问题：

### 问题症状
```
AggregateError [ETIMEDOUT]: 
  Error: connect ETIMEDOUT 2a03:2880:f131:83:face:b00c:0:25de:443
```

### 解决方案

#### 1. 使用 Dashboard 查看日志（推荐）
如果 CLI 连接失败，直接在 Dashboard 查看：
- 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
- Workers & Pages → `fashion-rec-router` → Logs
- 这是最可靠的方式，不需要本地网络连接到 Cloudflare API

#### 2. 检查网络连接
```powershell
# 测试 Cloudflare API 连接
Test-NetConnection -ComputerName api.cloudflare.com -Port 443

# 测试 DNS 解析
Resolve-DnsName api.cloudflare.com
```

#### 3. 配置代理（如果需要）
如果在中国大陆，可能需要配置代理：
```bash
# 设置 HTTP 代理
$env:HTTP_PROXY="http://proxy-server:port"
$env:HTTPS_PROXY="http://proxy-server:port"

# 或使用系统代理
$env:HTTPS_PROXY="system"
```

#### 4. 禁用 IPv6（如果 IPv6 连接有问题）
```powershell
# 临时禁用 IPv6（需要管理员权限）
netsh interface ipv6 set global randomizeidentifiers=disabled
netsh interface ipv6 set global randomizeidentifiers=enabled
```

#### 5. 检查防火墙
- 确保防火墙允许连接到 Cloudflare API（端口 443）
- 检查公司/学校网络是否阻止了连接

#### 6. 使用环境变量指定超时
```powershell
# 增加超时时间
$env:WRANGLER_LOG_LEVEL="debug"
pnpm exec wrangler tail --help
```

#### 7. 验证认证
```powershell
# 检查是否已登录
pnpm exec wrangler whoami

# 如果未登录，先登录
pnpm exec wrangler login
```

### 替代方案

**方案 1：使用 Dashboard（最可靠）**
- 不需要本地网络连接
- 功能更强大（搜索、过滤、导出）
- 可以查看历史日志

**方案 2：导出日志查询**
如果 Worker 代码中有日志记录，可以通过 API 查询：
```bash
# 通过 Cloudflare API 查询日志（需要 API Token）
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{script_name}/tail" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

**方案 3：在 Worker 代码中添加日志端点**
可以在 Worker 中添加一个调试端点来查看最近的日志（通过 KV 或其他存储）

## 注意事项

- `wrangler tail` 命令会持续运行，按 `Ctrl+C` 退出
- 日志可能会延迟几秒钟
- 免费计划有日志查看限制
- 生产环境建议启用日志持久化以便后续分析
- **如果遇到连接问题，优先使用 Dashboard 查看日志**

## 相关命令

```bash
# 查看 Worker 信息
pnpm exec wrangler whoami

# 查看部署列表
pnpm exec wrangler deployments list

# 查看 Worker 配置
pnpm exec wrangler deployments describe <deployment-id>

# 查看 KV 数据（调试缓存）
pnpm exec wrangler kv key get "<user-id>" --namespace-id=e335d5ff4f4948718434187ca14f94b7
```

## 参考链接

- [Wrangler Tail 文档](https://developers.cloudflare.com/workers/wrangler/commands/#tail)
- [Cloudflare Workers 日志](https://developers.cloudflare.com/workers/observability/logging/)
- [Dashboard 日志查看](https://developers.cloudflare.com/workers/observability/logs/)

