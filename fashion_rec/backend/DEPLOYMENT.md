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

