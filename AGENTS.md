# AGENTS.md

## Repository Structure

This is a monorepo containing multiple independent services and one pnpm workspace sub-monorepo:

```
fashion/                          # Git root
├── src/YIDEA/                    # DeepAgent: LangChain + DeepSeek LLM + FLUX image generation (Python, uv)
├── weather_mcp/                  # MCP weather server (Python, uv)
├── fashion_rec/                  # Main application (pnpm workspace + Python backend)
│   ├── frontend/                 # Vue 3 SPA (Vite + vue-tsc + vite-ssg, Tailwind 4, shadcn-vue)
│   ├── backend/                  # FastAPI API (Python 3.12+, uv, port 8001)
│   ├── backend/subscription-service/  # Cloudflare Worker (Hono, Creem.io subscriptions)
│   ├── shared/                   # @fashion-rec/shared: types, i18n, API client
│   └── uniapp-v2/                # UniApp mobile app (has its own AGENTS.md)
├── cloudflare-blog/              # Cloudflare Worker: blog API + R2 media storage
├── cloudflare-router/            # Cloudflare Worker: routing/canary/blue-green proxy
└── .shared/ui-ux-pro-max/        # Shared UI/UX reference
```

## Development

**Node.js (local):** Use **24** (see repo root `.nvmrc`). CI uses the same version.

| Tool | Windows commands |
|------|------------------|
| **fnm** | `winget install Schniz.fnm` → restart terminal → `cd` to repo → `fnm install` → `fnm use` |
| **nvm-windows** | Install [nvm-windows](https://github.com/coreybutler/nvm-windows) → `nvm install 24` → `nvm use 24` |
| **Installer** | [nodejs.org](https://nodejs.org/) → download **24.x LTS** |

Verify: `node -v` should show `v24.x.x`.

**Start all services at once (PowerShell):** `.\start-dev.ps1` — opens each service in a separate window.

### fashion_rec/backend (Python)
```bash
cd fashion_rec/backend
uv sync                                    # install deps
uv run run.py                              # dev server on :8001 (uvicorn with hot reload)
```
- FastAPI app defined in `main.py` (entrypoint: `main:app`)
- Env vars loaded from `.env` via python-dotenv
- Requires Python >=3.12

### fashion_rec/frontend (Vue 3)
```bash
cd fashion_rec
pnpm install --filter fashion-rec-frontend...   # install frontend + shared only
cd frontend
pnpm dev                                        # Vite dev on :5173, proxies /chatkit → backend :8001
pnpm build                                      # vue-tsc --noEmit && vite-ssg build (SSG)
pnpm build:spa                                  # vue-tsc --noEmit && vite build (SPA mode)
```
- Uses vite-ssg for static site generation; `build` produces pre-rendered HTML
- `@fashion-rec/shared` is a workspace dependency (aliased in vite.config.ts)
- Path alias: `@/` → `src/`

### fashion_rec/uniapp-v2
```bash
cd fashion_rec/uniapp-v2
pnpm install                # includes postinstall: builds forked supabase packages
pnpm dev                    # H5 dev
pnpm dev:mp                 # WeChat Mini Program
pnpm lint / pnpm lint:fix   # ESLint (@uni-helper/eslint-config)
pnpm type-check             # vue-tsc --noEmit
```
- See `fashion_rec/uniapp-v2/AGENTS.md` for full conventions and structure

### Cloudflare Workers (blog, router, subscription-service)
```bash
cd <service-dir>
pnpm install
pnpm dev                    # wrangler dev (local)
pnpm deploy                 # wrangler deploy (production)
```
- Secrets are set via `wrangler secret put` or Cloudflare Dashboard, never in wrangler.toml

## Deployment (CI)

Single workflow: `.github/workflows/deploy.yml`
- Triggers on push to `main` or `v2`
- Path-based change detection per service
- Backend deploys to Fly.io (`fashion-rec-backend` only; v2 Fly app dormant — `fly.v2.toml` kept for future testing)
- Frontend deploys to Cloudflare Pages
- Subscription service and router deploy to Cloudflare Workers
- `v2` branch CI can recreate `fashion-rec-backend-v2` when re-enabling canary backend tests
- pnpm 11.5.0, Node 24, `--frozen-lockfile`

## Key Conventions

- **Language:** All services are TypeScript/JavaScript except `fashion_rec/backend` and `src/YIDEA` (Python)
- **Python:** Uses `uv` for package management (not pip/poetry). Dev deps: pytest, ruff
- **Node:** pnpm 11+, Node 24+ (LTS; Wrangler 4.92+ requires ≥22). Each top-level directory has its own `pnpm-lock.yaml`
- **fashion_rec is a pnpm workspace** with packages: frontend, uniapp-v2, shared
- **Frontend build order matters:** `shared` must be resolvable before `frontend` builds (workspace link handles this)
- **No root-level lint/test/typecheck** — each service runs its own
