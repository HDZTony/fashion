# 前端部署说明

## 部署目标

前端部署到 **Cloudflare Pages**，项目名：`fashion-rec-frontend`。默认使用 **SSG（静态站点生成）** 构建，预渲染首页、定价、隐私政策、服务条款等页面。

## 方式一：本地通过 Wrangler 部署

### 1. 安装依赖并构建

```powershell
cd fashion_rec/frontend
pnpm install
pnpm run build
```

> 默认 `pnpm build` 为 **SSG 构建**，产物输出到 `dist/`。若需 SPA 构建，可使用 `pnpm run build:spa`，再执行部署命令。

### 2. 配置 Cloudflare 认证

任选其一：

- **交互登录**（本机首次建议）：在终端执行  
  `pnpm exec wrangler login`  
  按提示在浏览器完成登录。
- **CI/非交互**：设置环境变量  
  - `CLOUDFLARE_API_TOKEN`：在 [Cloudflare 创建 API Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)（需包含 “Cloudflare Pages Edit” 权限）  
  - `CLOUDFLARE_ACCOUNT_ID`：在 Cloudflare 控制台 → 右侧栏或 “Workers & Pages” 页的 URL 中查看

### 3. 执行部署

```powershell
pnpm exec wrangler pages deploy dist --project-name fashion-rec-frontend
```

或一键 **SSG 构建并部署**：

```powershell
pnpm run deploy
```

（`deploy` 内部执行 `pnpm run build` + `wrangler pages deploy dist`。）

---

## 方式二：通过 GitHub Actions 自动部署

推送代码到 `main` / `v2` 且 `fashion_rec/frontend/**` 有变更时，会自动构建并部署到 Cloudflare Pages。

需在仓库中配置：

- **Secrets**：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
- **Variables**：如 `VITE_API_URL`、`VITE_SUBSCRIPTION_API_URL`、`VITE_SUPABASE_URL`（应为 `https://fashion-rec.com/supabase`）、`VITE_SUPABASE_KEY`、`VITE_GOOGLE_CLIENT_ID` 等（与 `.github/workflows/deploy.yml` 中 `deploy-frontend` 的 `env` 一致）

Supabase Auth 国内代理与 Dashboard 配置详见 [`doc/supabase-auth-proxy.md`](supabase-auth-proxy.md)。

本地未配置 Cloudflare 时，可直接推代码触发上述流水线完成部署。

---

## 构建环境变量（可选）

若需覆盖默认 API 地址等，可在 `fashion_rec/frontend` 下建 `.env` 或 `.env.production`，例如：

```env
VITE_API_URL=https://fashion-rec.com
VITE_SUBSCRIPTION_API_URL=https://your-subscription.workers.dev
VITE_SUPABASE_URL=https://fashion-rec.com/supabase
VITE_SUPABASE_KEY=your-anon-key
VITE_GOOGLE_CLIENT_ID=your-web-oauth-client-id.apps.googleusercontent.com
```

未设置时使用 `src/config/api.ts` 和 `src/lib/supabase.ts` 中的默认值（Supabase URL 默认 `https://fashion-rec.com/supabase`）。

---

## LocateAnything-3B（GPU bbox 服务）

Studio 意图裁剪的主 bbox 路径，部署在 Tailscale 节点 **`100.73.75.78`**（`desktop-kdsvgm5`）。

- 代码与脚本：仓库根目录 [`locateanything-service/`](../locateanything-service/)
- 后端对接：`fashion_rec/backend/services/locateanything_client.py`（默认 `LOCATEANYTHING_BASE_URL=http://100.73.75.78:8000`）
- 流水线说明：[`doc/grok-multimodal-and-qwen-batch.md`](grok-multimodal-and-qwen-batch.md)

**Fly.io 后端**（Tailscale + secrets，一键脚本）：

1. 在 [Tailscale Keys](https://login.tailscale.com/admin/settings/keys) 生成 **Reusable** 密钥（与 `desktop-kdsvgm5` 同一 tailnet）。
2. 写入 `fashion_rec/backend/.env`：`TS_AUTHKEY=tskey-auth-...`
3. 安装并登录 Fly CLI 后执行：

```powershell
cd fashion_rec/backend
iwr https://fly.io/install.ps1 -useb | iex   # 首次
fly auth login
.\setup_locateanything_fly.ps1              # stable: fashion-rec-backend
fly deploy
# v2 Fly 应用当前未部署；恢复测试时先 fly apps create fashion-rec-backend-v2，再 setup_locateanything_fly.ps1 -V2 与 fly deploy --config fly.v2.toml
```

4. 验证 Fly 机器能访问 GPU 服务：

```powershell
fly ssh console --app fashion-rec-backend -C "curl -s http://100.73.75.78:8000/health"
```

Docker 镜像内 `scripts/fly-start.sh` 会在有 `TS_AUTHKEY` 时以 userspace 模式启动 Tailscale，再启动 uvicorn。

| Secret | 说明 |
|--------|------|
| `TS_AUTHKEY` | Tailscale 入网密钥（必需，否则 Fly 无法访问 100.x） |
| `TS_HOSTNAME` | 节点名（脚本默认 `fashion-rec-backend` / `-v2` 应用名） |
| `LOCATEANYTHING_BASE_URL` | `http://100.73.75.78:8000` |

运维与重装步骤见 [`locateanything-service/README.md`](../locateanything-service/README.md)。