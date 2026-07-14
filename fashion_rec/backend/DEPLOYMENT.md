# 部署说明

## 模型下载说明

### CLIP 模型缓存机制

`sentence-transformers` 库会自动将下载的模型缓存到 `~/.cache/huggingface/` 目录。这意味着：

1. **本地开发**：模型只需要下载一次，之后会从缓存加载
2. **Docker 容器**：
   - 如果使用持久化卷挂载 `~/.cache/huggingface/`，模型只需要下载一次
   - 如果每次都是新容器，需要在构建时预下载模型（Dockerfile 已包含）

### Fly.io 部署

#### 方案 1：使用持久化卷（推荐）

1. 创建持久化卷：
```bash
fly volumes create model_cache --size 1
```

2. 在 `fly.toml` 中挂载卷：
```toml
[mounts]
  source = "model_cache"
  destination = "/root/.cache/huggingface"
```

这样模型只需要下载一次，之后会从卷中加载。

#### 方案 2：构建时预下载（当前 Dockerfile 已实现）

Dockerfile 在构建时会尝试预下载模型。如果构建时网络有问题，模型会在首次运行时下载。

#### 方案 3：手动预下载

在部署前运行：
```bash
python download_model.py
```

然后将 `~/.cache/huggingface/` 目录包含在部署中。

## 图片 URL 上传说明

### 工作原理

当用户通过 URL 上传图片时：

1. **先下载到本地**：服务器会先下载图片到临时文件
2. **分析本地文件**：使用本地文件路径进行分析，避免 API 下载超时
3. **上传到 R2**：分析完成后，图片会上传到 R2 存储
4. **清理临时文件**：临时文件会被自动删除

### 优势

- **避免超时**：Qwen-VL API 不需要自己下载图片，避免超时错误
- **更可靠**：使用本地文件更稳定，不受网络波动影响
- **支持更多 URL**：可以处理有反爬机制的网站（如 LV）

### 错误处理

如果 URL 下载失败，会返回友好的中文错误信息，提示用户检查 URL 或网络连接。

## 环境变量配置

### 必需的环境变量

在 Fly.io 中设置以下环境变量：

**重要：API 密钥与端点的对应关系**

- `DASHSCOPE_API_KEY_SG`: 用于新加坡端点（国外地址），必须与新加坡端点配对使用
- `DASHSCOPE_API_KEY`: 用于北京端点（中国调用），必须与北京端点配对使用

**当前配置（使用新加坡端点）：**

```bash
# 新加坡端点 API Key（必需，因为代码使用新加坡端点）
fly secrets set DASHSCOPE_API_KEY_SG=your_singapore_api_key_here
```

**如果使用北京端点：**

需要修改代码中的端点配置，并设置：

```bash
# 北京端点 API Key
fly secrets set DASHSCOPE_API_KEY=your_beijing_api_key_here
```

**注意**：代码默认使用新加坡端点，因此必须设置 `DASHSCOPE_API_KEY_SG`。不能混用 API 密钥和端点。

### 验证环境变量

部署后，可以通过以下命令验证环境变量是否设置成功：

```bash
fly ssh console -C "printenv | grep DASHSCOPE"
```

### 其他必需的环境变量

除了 Qwen-VL API 密钥外，还需要设置以下环境变量：

- `SUPABASE_URL`: Supabase 项目 URL
- `SUPABASE_KEY`: Supabase anon key
- `DATABASE_URL`: PostgreSQL 数据库连接字符串
- `R2_ENDPOINT_URL`: Cloudflare R2 端点 URL
- `R2_ACCESS_KEY_ID`: R2 访问密钥 ID
- `R2_SECRET_ACCESS_KEY`: R2 密钥
- `R2_BUCKET_NAME`: R2 存储桶名称
- `R2_PUBLIC_URL`: R2 公共 URL
- `WEATHER_API_KEY`: WeatherAPI 密钥（用于获取天气信息）

可以使用以下命令一次性设置多个环境变量：

```bash
fly secrets set DASHSCOPE_API_KEY_SG=your_key SUPABASE_URL=your_url ...
```

### V2 Fly 后端（当前未部署）

生产环境仅运行 **`fashion-rec-backend`**。`fashion-rec-backend-v2` Fly 应用已下线；[`fly.v2.toml`](fly.v2.toml) 与 [`setup_v2_secrets.ps1`](setup_v2_secrets.ps1) 保留，供日后 canary 测试。

Cloudflare Router 的 `V2_BACKEND_URL` secret 当前指向 stable 后端（`https://fashion-rec-backend.fly.dev`），即使用户标记为 `v2` 也不会访问已销毁的 Fly 应用。

#### 重新启用 V2 Fly 测试

1. 创建应用：`fly apps create fashion-rec-backend-v2`
2. 设置 secrets：`.\setup_v2_secrets.ps1`（从 `.env` 读取）
3. 部署：`fly deploy --config fly.v2.toml`
4. Router：`cd cloudflare-router && echo https://fashion-rec-backend-v2.fly.dev | pnpm exec wrangler secret put V2_BACKEND_URL`
5. 为测试用户在 Supabase `user_frontend_versions` 设 `version = 'v2'`，或 push 到 `v2` 分支触发 CI

验证 secrets：

```powershell
fly secrets list --app fashion-rec-backend-v2
fly ssh console --app fashion-rec-backend-v2 -C "printenv | grep -E 'DASHSCOPE|SUPABASE|R2|DATABASE|WEATHER|CREEM' | sort"
```

## Wormhole iroh relay（同机 sidecar）

与 FastAPI 共用 `fashion-rec-backend` 一台 Fly Machine，避免单独为 relay 开第二台 VM。

| 服务 | 容器端口 | 公网 |
|------|----------|------|
| FastAPI | 8000 | `https://fashion-rec-backend.fly.dev/` |
| iroh-relay | 3340 | `https://fashion-rec-backend.fly.dev:3340/` |

- 配置：`config/iroh-relay.toml`
- 启动：`scripts/fly-start.sh` 在 uvicorn 前后台执行 `iroh-relay --dev`
- Fly：`fly.toml` 中 `[[services]]` 暴露 3340；VM 内存 1536MB

部署（relay 随 backend 一起更新）：

```bash
cd fashion_rec/backend
fly deploy --app fashion-rec-backend --region sin
```

Wormhole 各节点 `network.json`：

```json
{ "transport": "iroh", "iroh_relays": ["https://fashion-rec-backend.fly.dev:3340/"] }
```

验收：`curl -I https://fashion-rec-backend.fly.dev:3340/`

## 为何不用 Cloudflare Containers 替代 Fly

Cloudflare Containers 是 Workers 旁的按需 Linux 容器，不是 Fly 这类常驻 Docker 主机。对本后端不适用整机迁移：

| 需求 | Fly（当前） | Cloudflare Containers |
|------|-------------|------------------------|
| FastAPI HTTP | `http_service` → 8000，可常驻 | Worker → Container 可行，但默认空闲 sleep、冷启动、磁盘 ephemeral |
| iroh relay :3340 | 同机 `[[services]]` 直连 | **不可行**：入站须经 Worker，终端用户不能对 Container 发非 HTTP TCP/UDP |
| `min_machines_running = 1` | `auto_stop_machines = 'off'` | 需 `sleepAfter` / `renewActivityTimeout` 硬撑，成本与复杂度通常不如 Fly |

结论：继续用 Fly 跑 FastAPI + relay；国内 relay 用京东云。仅当新负载是可休眠、纯 HTTP、状态外置（R2/D1）且已接 Workers 时，再考虑 Containers。详见 [Containers lifecycle](https://developers.cloudflare.com/containers/platform-details/architecture/)。

