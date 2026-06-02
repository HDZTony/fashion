# LocateAnything-3B 服务

为 `fashion_rec` Studio 意图裁剪提供 bbox 推理 API（`POST /v1/locate`）。后端默认通过 Tailscale 调用：

`http://100.73.75.78:8000`（`desktop-kdsvgm5`）

## 生产部署（已配置）

| 项 | 值 |
|----|-----|
| 主机 | `desktop-kdsvgm5` / Tailscale `100.73.75.78` |
| 目录 | `D:\source_code\LocateAnything-3B` |
| 端口 | `8000` |
| 开机任务 | `LocateAnything-3B-Service` |

## 运维命令（SSH）

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519_kdsvgm5 hdz@100.73.75.78

# 健康检查
Invoke-RestMethod http://127.0.0.1:8000/health

# 手动启动（前台，调试用）
cd D:\source_code\LocateAnything-3B
.\launch.ps1

# 注册/更新开机自启
.\register-task.ps1
Start-ScheduledTask -TaskName LocateAnything-3B-Service

# 停止占用 8000 端口的进程
.\stop.ps1
```

## 首次安装

```powershell
cd D:\source_code\LocateAnything-3B
.\install.ps1          # venv + PyTorch + 依赖
.\download-model.ps1   # 下载 nvidia/LocateAnything-3B 到 model_weights
.\install-transformers.ps1
.\test-run.ps1         # 验证 GPU 加载
.\register-task.ps1
.\launch.ps1
```

> Windows 上不要用 `start.ps1` 作为文件名（系统保留名），请用 `run-service.ps1` 或 `launch.ps1`。

## API

```http
GET  /health
POST /v1/locate
Content-Type: application/json

{"image_url": "https://...", "prompt": "Locate a single instance that matches..."}
```

本地 / ChatKit / localhost 图片（GPU 无法直接 HTTP 拉取时）：

```http
POST /v1/locate_bytes
Content-Type: application/json

{"image_base64": "<standard base64>", "prompt": "..."}
```

响应示例：

```json
{"status": "success", "result": "<ref>shirt</ref><box><146><56><848><946></box>..."}
```

## fashion_rec 后端环境变量

| 变量 | 默认 |
|------|------|
| `LOCATEANYTHING_ENABLED` | `true` |
| `LOCATEANYTHING_BASE_URL` | `http://100.73.75.78:8000` |
| `LOCATEANYTHING_TIMEOUT_SECONDS` | `30` |
| `LOCATEANYTHING_MAX_CONCURRENCY` | `3` |

Fly.io 生产环境：

```powershell
cd fashion_rec/backend
fly auth login
# .env 中添加 TS_AUTHKEY=tskey-auth-...（Tailscale 管理后台 Reusable key）
.\setup_locateanything_fly.ps1
fly deploy
```

镜像内 `scripts/fly-start.sh` 会在启动 uvicorn 前加入 tailnet。验证：`fly ssh console --app fashion-rec-backend -C "curl -s http://100.73.75.78:8000/health"`

详见 `doc/DEPLOY.md` 与 `doc/grok-multimodal-and-qwen-batch.md`。
