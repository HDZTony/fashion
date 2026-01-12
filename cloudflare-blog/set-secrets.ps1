# PowerShell script to set Cloudflare Workers secrets for fashion-rec-blog
# 从 .dev.vars 文件中读取配置并批量设置到生产环境

$ErrorActionPreference = "Stop"

$WORKER_NAME = "fashion-rec-blog"
$ENV_FILE = ".dev.vars"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setting Cloudflare Workers Secrets" -ForegroundColor Cyan
Write-Host "Worker: $WORKER_NAME" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if wrangler command is available
$wranglerCmd = Get-Command wrangler -ErrorAction SilentlyContinue
if (-not $wranglerCmd) {
    Write-Host "❌ Error: 'wrangler' command not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Wrangler CLI first:" -ForegroundColor Yellow
    Write-Host "  pnpm add -D wrangler" -ForegroundColor Cyan
    Write-Host "  Or: npm install -g wrangler" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "✅ Found wrangler command" -ForegroundColor Green
Write-Host ""

# Check if .dev.vars file exists
if (-not (Test-Path $ENV_FILE)) {
    Write-Host "❌ Error: $ENV_FILE not found!" -ForegroundColor Red
    Write-Host "Please create $ENV_FILE file first." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found $ENV_FILE" -ForegroundColor Green
Write-Host ""

# Function to get value from .dev.vars file
function Get-EnvValue {
    param([string]$Key)
    $line = Get-Content $ENV_FILE | Where-Object { $_ -match "^$Key=(.+)$" }
    if ($line) {
        $value = ($line -replace "^$Key=", "").Trim()
        # Remove quotes if present
        $value = $value -replace '^"|"$', ''
        # Remove comments
        $value = $value -replace '\s*#.*$', ''
        return $value
    }
    return $null
}

# Read values from .dev.vars file
Write-Host "Reading environment variables from $ENV_FILE..." -ForegroundColor Yellow
Write-Host ""

$SUPABASE_URL = Get-EnvValue "SUPABASE_URL"
$SUPABASE_SERVICE_ROLE_KEY = Get-EnvValue "SUPABASE_SERVICE_ROLE_KEY"
$R2_ENDPOINT_URL = Get-EnvValue "R2_ENDPOINT_URL"
$R2_ACCESS_KEY_ID = Get-EnvValue "R2_ACCESS_KEY_ID"
$R2_SECRET_ACCESS_KEY = Get-EnvValue "R2_SECRET_ACCESS_KEY"
$R2_BUCKET_NAME = Get-EnvValue "R2_BUCKET_NAME"
$R2_PUBLIC_URL = Get-EnvValue "R2_PUBLIC_URL"

# Validate required values
$missing = @()
if (-not $SUPABASE_URL) { $missing += "SUPABASE_URL" }
if (-not $SUPABASE_SERVICE_ROLE_KEY) { $missing += "SUPABASE_SERVICE_ROLE_KEY" }
if (-not $R2_ENDPOINT_URL) { $missing += "R2_ENDPOINT_URL" }
if (-not $R2_ACCESS_KEY_ID) { $missing += "R2_ACCESS_KEY_ID" }
if (-not $R2_SECRET_ACCESS_KEY) { $missing += "R2_SECRET_ACCESS_KEY" }
if (-not $R2_BUCKET_NAME) { $missing += "R2_BUCKET_NAME" }
if (-not $R2_PUBLIC_URL) { $missing += "R2_PUBLIC_URL" }

if ($missing.Count -gt 0) {
    Write-Host "❌ Error: Missing required environment variables:" -ForegroundColor Red
    foreach ($key in $missing) {
        Write-Host "   - $key" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please add these to $ENV_FILE and try again." -ForegroundColor Yellow
    exit 1
}

# Display configuration summary
Write-Host "Configuration Summary:" -ForegroundColor Cyan
Write-Host "  SUPABASE_URL: $($SUPABASE_URL.Substring(0, [Math]::Min(50, $SUPABASE_URL.Length)))..." -ForegroundColor Gray
Write-Host "  R2_ENDPOINT_URL: $R2_ENDPOINT_URL" -ForegroundColor Gray
Write-Host "  R2_BUCKET_NAME: $R2_BUCKET_NAME" -ForegroundColor Gray
Write-Host "  R2_PUBLIC_URL: $R2_PUBLIC_URL" -ForegroundColor Gray
Write-Host ""

# Confirm before proceeding
Write-Host "⚠️  This will set secrets for production environment!" -ForegroundColor Yellow
$confirm = Read-Host "Continue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Setting secrets..." -ForegroundColor Yellow
Write-Host ""

# Set secrets one by one
$secrets = @(
    @{ Name = "SUPABASE_URL"; Value = $SUPABASE_URL },
    @{ Name = "SUPABASE_SERVICE_ROLE_KEY"; Value = $SUPABASE_SERVICE_ROLE_KEY },
    @{ Name = "R2_ENDPOINT_URL"; Value = $R2_ENDPOINT_URL },
    @{ Name = "R2_ACCESS_KEY_ID"; Value = $R2_ACCESS_KEY_ID },
    @{ Name = "R2_SECRET_ACCESS_KEY"; Value = $R2_SECRET_ACCESS_KEY },
    @{ Name = "R2_BUCKET_NAME"; Value = $R2_BUCKET_NAME },
    @{ Name = "R2_PUBLIC_URL"; Value = $R2_PUBLIC_URL }
)

$successCount = 0
$failCount = 0

foreach ($secret in $secrets) {
    Write-Host "Setting $($secret.Name)..." -ForegroundColor Yellow -NoNewline
    try {
        $secret.Value | pnpm exec wrangler secret put $secret.Name 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✅" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host " ❌ (Exit code: $LASTEXITCODE)" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host " ❌ ($($_.Exception.Message))" -ForegroundColor Red
        $failCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($failCount -eq 0) {
    Write-Host "✅ All secrets set successfully!" -ForegroundColor Green
    Write-Host "   Success: $successCount" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some secrets failed to set" -ForegroundColor Yellow
    Write-Host "   Success: $successCount" -ForegroundColor Green
    Write-Host "   Failed: $failCount" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($failCount -eq 0) {
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Verify secrets: pnpm exec wrangler secret list" -ForegroundColor Gray
    Write-Host "  2. Deploy worker: pnpm deploy" -ForegroundColor Gray
    Write-Host ""
}
