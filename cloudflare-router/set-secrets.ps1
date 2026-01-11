# PowerShell script to set environment variables for fashion-rec-router worker
# 从 backend/.env 文件中读取 SUPABASE 配置

$workerName = "fashion-rec-router"
$backendEnvFile = "../fashion-rec/backend/.env"

Write-Host "Setting environment variables for $workerName..." -ForegroundColor Green
Write-Host ""

# 从 .env 文件读取 Supabase 配置
$supabaseUrl = ""
$supabaseServiceRoleKey = ""

if (Test-Path $backendEnvFile) {
    Write-Host "Reading Supabase configuration from $backendEnvFile..." -ForegroundColor Yellow
    $envContent = Get-Content $backendEnvFile
    
    foreach ($line in $envContent) {
        if ($line -match "^SUPABASE_URL=(.+)$") {
            $supabaseUrl = $matches[1].Trim()
        }
        if ($line -match "^SUPABASE_SERVICE_ROLE_KEY=(.+)$") {
            $supabaseServiceRoleKey = $matches[1].Trim()
        }
    }
}

# 配置值
$stableFrontendHost = "fashion-rec-frontend.pages.dev"  # 前端 hostname（stable 和 v2 共用同一个 Pages 项目）
$v2FrontendHost = "fashion-rec-frontend.pages.dev"      # 前端 hostname（stable 和 v2 共用同一个 Pages 项目）
$stableBackendUrl = "https://fashion-rec-backend.fly.dev"       # 稳定版后端 URL
$v2BackendUrl = "https://fashion-rec-backend-v2.fly.dev"        # v2 后端 URL

# 设置 SUPABASE_URL
if ($supabaseUrl) {
    Write-Host "Setting SUPABASE_URL..." -ForegroundColor Yellow
    $supabaseUrl | pnpm exec wrangler secret put SUPABASE_URL
} else {
    Write-Host "⚠️  SUPABASE_URL 未找到，请手动设置" -ForegroundColor Red
}

# 设置 SUPABASE_SERVICE_ROLE_KEY
if ($supabaseServiceRoleKey) {
    Write-Host "Setting SUPABASE_SERVICE_ROLE_KEY..." -ForegroundColor Yellow
    $supabaseServiceRoleKey | pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
} else {
    Write-Host "⚠️  SUPABASE_SERVICE_ROLE_KEY 未找到，请手动设置" -ForegroundColor Red
}

# 设置 STABLE_SUBSCRIPTION_SERVICE_URL
Write-Host "Setting STABLE_SUBSCRIPTION_SERVICE_URL..." -ForegroundColor Yellow
"https://fashion-rec-subscription-service.954504788.workers.dev" | pnpm exec wrangler secret put STABLE_SUBSCRIPTION_SERVICE_URL

# 设置 V2_SUBSCRIPTION_SERVICE_URL
Write-Host "Setting V2_SUBSCRIPTION_SERVICE_URL..." -ForegroundColor Yellow
"https://fashion-rec-subscription-service-v2.954504788.workers.dev" | pnpm exec wrangler secret put V2_SUBSCRIPTION_SERVICE_URL

# 设置 STABLE_FRONTEND_HOST
Write-Host "Setting STABLE_FRONTEND_HOST..." -ForegroundColor Yellow
$stableFrontendHost | pnpm exec wrangler secret put STABLE_FRONTEND_HOST

# 设置 V2_FRONTEND_HOST
Write-Host "Setting V2_FRONTEND_HOST..." -ForegroundColor Yellow
$v2FrontendHost | pnpm exec wrangler secret put V2_FRONTEND_HOST

# 设置 STABLE_BACKEND_URL
Write-Host "Setting STABLE_BACKEND_URL..." -ForegroundColor Yellow
$stableBackendUrl | pnpm exec wrangler secret put STABLE_BACKEND_URL

# 设置 V2_BACKEND_URL
Write-Host "Setting V2_BACKEND_URL..." -ForegroundColor Yellow
$v2BackendUrl | pnpm exec wrangler secret put V2_BACKEND_URL

Write-Host "`n✅ 所有环境变量设置完成！" -ForegroundColor Green
Write-Host "`n⚠️  请检查以下配置是否正确（如不正确，请修改脚本中的值后重新运行）：" -ForegroundColor Yellow
Write-Host "   STABLE_FRONTEND_HOST: $stableFrontendHost" -ForegroundColor Cyan
Write-Host "   V2_FRONTEND_HOST: $v2FrontendHost" -ForegroundColor Cyan
Write-Host "   STABLE_BACKEND_URL: $stableBackendUrl" -ForegroundColor Cyan
Write-Host "   V2_BACKEND_URL: $v2BackendUrl" -ForegroundColor Cyan
