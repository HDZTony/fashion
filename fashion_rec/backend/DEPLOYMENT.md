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

### V2 应用环境变量设置

**重要**：`fashion-rec-backend-v2` 是一个独立的 Fly.io 应用，需要单独设置所有环境变量。

#### 方法 1：使用自动化脚本（推荐）

**Linux/macOS:**
```bash
cd fashion-rec/backend
chmod +x setup_v2_secrets.sh
./setup_v2_secrets.sh
```

**Windows PowerShell:**
```powershell
cd fashion-rec/backend
.\setup_v2_secrets.ps1
```

脚本会自动从 `.env` 文件读取所有配置并设置到 V2 应用。

#### 方法 2：手动设置

如果 `.env` 文件中有所有必要的值，可以手动执行：

```bash
# 在 fashion-rec/backend 目录下执行
fly secrets set \
  DASHSCOPE_API_KEY_SG=sk-bdf76674a9d5495492ee556a4ff32ac1 \
  DASHSCOPE_API_KEY=sk-2927da63a9e045cb9adf945a1708e4bc \
  R2_ENDPOINT_URL=https://a69a5620c481efdb002669a375d72efd.r2.cloudflarestorage.com \
  R2_ACCESS_KEY_ID=932a0f21f9086becf73c1ca08bf2ba59 \
  R2_SECRET_ACCESS_KEY=2e88209f9c40235e627adad7c5abfd70ee9af36b85b97f623f38c952cde451a0 \
  R2_BUCKET_NAME=fashion \
  R2_PUBLIC_URL=https://pub-da29e362d6934e738ef0234d04c252d5.r2.dev \
  SUPABASE_URL=https://eufhccrelpucppognlym.supabase.co \
  SUPABASE_KEY=your_supabase_key \
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key \
  DATABASE_URL=postgresql://postgres:password@db.eufhccrelpucppognlym.supabase.co:5432/postgres \
  WEATHER_API_KEY=your_weather_api_key \
  CREEM_API_KEY=your_creem_api_key \
  --app fashion-rec-backend-v2
```

**注意**：请将上述命令中的值替换为实际的值（可以从 `.env` 文件中获取）。

#### 验证 V2 应用环境变量

设置完成后，验证环境变量：

```bash
fly ssh console --app fashion-rec-backend-v2 -C "printenv | grep -E 'DASHSCOPE|SUPABASE|R2|DATABASE|WEATHER|CREEM' | sort"
```

#### 从稳定版应用复制 Secrets

如果需要从稳定版应用（`fashion-rec-backend`）复制 secrets 到 V2 应用，可以：

1. 查看稳定版应用的 secrets（注意：Fly.io 不允许直接读取 secrets 值）
2. 手动在 V2 应用中设置相同的值
3. 或使用 `.env` 文件中的值（如果与生产环境一致）

