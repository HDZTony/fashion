# V2 应用 Secrets 设置指南

## 问题

V2 应用（`fashion-rec-backend-v2`）启动失败，错误信息：
```
RuntimeError: DASHSCOPE_API_KEY_SG must be set in environment variables for Singapore endpoint.
```

这是因为 V2 应用是一个独立的 Fly.io 应用，需要单独设置所有环境变量。

## 前置要求

### 安装 Fly.io CLI

如果还没有安装 Fly CLI，请先安装：

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

安装完成后，重启终端或执行：
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

验证安装：
```powershell
fly version
```

详细安装说明请参考：`INSTALL_FLY_CLI.md`

### 登录 Fly.io

```powershell
fly auth login
```

## 解决方案

### 方法 1：使用自动化脚本（推荐）

在 `fashion_rec/backend` 目录下执行以下命令：

```bash
fly secrets set \
  DASHSCOPE_API_KEY_SG=sk-bdf76674a9d5495492ee556a4ff32ac1 \
  DASHSCOPE_API_KEY=sk-2927da63a9e045cb9adf945a1708e4bc \
  R2_ENDPOINT_URL=https://a69a5620c481efdb002669a375d72efd.r2.cloudflarestorage.com \
  R2_ACCESS_KEY_ID=932a0f21f9086becf73c1ca08bf2ba59 \
  R2_SECRET_ACCESS_KEY=2e88209f9c40235e627adad7c5abfd70ee9af36b85b97f623f38c952cde451a0 \
  R2_BUCKET_NAME=fashion \
  R2_PUBLIC_URL=https://pub-da29e362d6934e738ef0234d04c252d5.r2.dev \
  SUPABASE_URL=https://eufhccrelpucppognlym.supabase.co \
  SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZmhjY3JlbHB1Y3Bwb2dubHltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzU4NjQsImV4cCI6MjA3OTYxMTg2NH0.9xB3Peua7MeaRGYPsSrmHYbpWpQmyqpJSSNqyGjqdIo \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1ZmhjY3JlbHB1Y3Bwb2dubHltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDAzNTg2NCwiZXhwIjoyMDc5NjExODY0fQ.f6ISQDuHZ0mw8jAUFFy8yj5totMKiGNVijqOdftyk9E \
  DATABASE_URL=postgresql://postgres:SXbPqnaF8zDEGFtx@db.eufhccrelpucppognlym.supabase.co:5432/postgres \
  WEATHER_API_KEY=d48c54cc715d4301be8161624252511 \
  CREEM_API_KEY=creem_test_4WsdDJBIaJR4UcGoGkBPMb \
  --app fashion-rec-backend-v2
```

### 方法 3：使用 Bash 脚本（Linux/macOS）

```bash
cd fashion_rec/backend
chmod +x setup_v2_secrets.sh
./setup_v2_secrets.sh
```

## 验证设置

设置完成后，验证环境变量：

```bash
fly ssh console --app fashion-rec-backend-v2 -C "printenv | grep -E 'DASHSCOPE|SUPABASE|R2|DATABASE|WEATHER|CREEM' | sort"
```

## 重新部署

设置 secrets 后，应用会自动重启。如果没有自动重启，可以手动触发：

```bash
fly deploy --config fly.v2.toml --remote-only --app fashion-rec-backend-v2
```

## 替代方案：通过 Fly.io Dashboard

如果无法安装 Fly CLI，可以通过 Web 界面设置：

1. 访问 https://fly.io/dashboard
2. 选择 `fashion-rec-backend-v2` 应用
3. 进入 **Settings** > **Secrets**
4. 点击 **Add Secret** 添加每个环境变量
5. 添加完成后，应用会自动重启

## 注意事项

1. **Secrets 是敏感信息**：上述命令中的值来自 `.env` 文件，仅用于开发/测试环境
2. **生产环境**：如果这是生产环境，请使用生产环境的 API keys 和配置
3. **独立应用**：V2 应用与稳定版应用完全独立，需要单独管理所有配置
4. **Fly CLI 未安装**：如果遇到 "fly command not found" 错误，请先安装 Fly CLI（见前置要求）

