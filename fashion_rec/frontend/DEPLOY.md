# 前端部署说明

## 部署目标

前端部署到 **Cloudflare Pages**，项目名：`fashion-rec-frontend`。

## 方式一：本地通过 Wrangler 部署

### 1. 安装依赖并构建

```powershell
cd fashion_rec/frontend
pnpm install
pnpm run build:spa
```

> 若 `pnpm build`（SSG）报错 `Invalid script option`，请使用 `pnpm run build:spa` 进行 SPA 构建，产物同样输出到 `dist/`。

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

或一键构建并部署：

```powershell
pnpm run deploy
```

---

## 方式二：通过 GitHub Actions 自动部署

推送代码到 `main` / `v2` 且 `fashion_rec/frontend/**` 有变更时，会自动构建并部署到 Cloudflare Pages。

需在仓库中配置：

- **Secrets**：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
- **Variables**：如 `VITE_API_URL`、`VITE_SUBSCRIPTION_API_URL`、`VITE_SUPABASE_URL`、`VITE_SUPABASE_KEY` 等（与 `.github/workflows/deploy.yml` 中 `deploy-frontend` 的 `env` 一致）

本地未配置 Cloudflare 时，可直接推代码触发上述流水线完成部署。

---

## 构建环境变量（可选）

若需覆盖默认 API 地址等，可在 `fashion_rec/frontend` 下建 `.env` 或 `.env.production`，例如：

```env
VITE_API_URL=https://fashion-rec.com
VITE_SUBSCRIPTION_API_URL=https://your-subscription.workers.dev
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_KEY=your-anon-key
```

未设置时使用 `src/config/api.ts` 和 `src/lib/supabase.ts` 中的默认值。
