# PowerShell script to set up Fly.io secrets for fashion-rec-backend-v2
# This script reads from .env file and sets secrets for the V2 app

$ErrorActionPreference = "Stop"

$APP_NAME = "fashion-rec-backend-v2"
$ENV_FILE = ".env"

Write-Host "Setting up secrets for $APP_NAME..." -ForegroundColor Cyan
Write-Host "Reading from $ENV_FILE..." -ForegroundColor Cyan

# Check if fly command is available
$flyCmd = Get-Command fly -ErrorAction SilentlyContinue
if (-not $flyCmd) {
    Write-Host ""
    Write-Host "❌ Error: 'fly' command not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Fly.io CLI first:" -ForegroundColor Yellow
    Write-Host "  Windows (PowerShell):" -ForegroundColor Cyan
    Write-Host "    iwr https://fly.io/install.ps1 -useb | iex" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Or download from: https://fly.io/docs/hands-on/install-flyctl/" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "After installation, restart your terminal and try again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternatively, you can set secrets manually using the command shown below." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ Found fly command at: $($flyCmd.Source)" -ForegroundColor Green
Write-Host ""

# Check if .env file exists
if (-not (Test-Path $ENV_FILE)) {
    Write-Host "Error: $ENV_FILE not found!" -ForegroundColor Red
    exit 1
}

# Function to get value from .env file
function Get-EnvValue {
    param([string]$Key)
    $line = Get-Content $ENV_FILE | Where-Object { $_ -match "^$Key=" }
    if ($line) {
        $value = $line -replace "^$Key=", ""
        # Remove quotes if present
        $value = $value -replace '^"|"$', ''
        return $value
    }
    return $null
}

# Read values from .env file
Write-Host "Reading environment variables from $ENV_FILE..." -ForegroundColor Yellow

$DASHSCOPE_API_KEY_SG = Get-EnvValue "DASHSCOPE_API_KEY_SG"
$DASHSCOPE_API_KEY = Get-EnvValue "DASHSCOPE_API_KEY"
$R2_ENDPOINT_URL = Get-EnvValue "R2_ENDPOINT_URL"
$R2_ACCESS_KEY_ID = Get-EnvValue "R2_ACCESS_KEY_ID"
$R2_SECRET_ACCESS_KEY = Get-EnvValue "R2_SECRET_ACCESS_KEY"
$R2_BUCKET_NAME = Get-EnvValue "R2_BUCKET_NAME"
$R2_PUBLIC_URL = Get-EnvValue "R2_PUBLIC_URL"
$SUPABASE_URL = Get-EnvValue "SUPABASE_URL"
$SUPABASE_KEY = Get-EnvValue "SUPABASE_KEY"
$SUPABASE_SERVICE_ROLE_KEY = Get-EnvValue "SUPABASE_SERVICE_ROLE_KEY"
$DATABASE_URL = Get-EnvValue "DATABASE_URL"
$WEATHER_API_KEY = Get-EnvValue "WEATHER_API_KEY"
$CREEM_API_KEY = Get-EnvValue "CREEM_API_KEY"

# LocateAnything (GPU bbox on tailnet) — see setup_locateanything_fly.ps1
$LOCATEANYTHING_ENABLED = if (Get-EnvValue "LOCATEANYTHING_ENABLED") { Get-EnvValue "LOCATEANYTHING_ENABLED" } else { "true" }
$LOCATEANYTHING_BASE_URL = if (Get-EnvValue "LOCATEANYTHING_BASE_URL") { Get-EnvValue "LOCATEANYTHING_BASE_URL" } else { "http://100.73.75.78:8000" }
$LOCATEANYTHING_TIMEOUT_SECONDS = if (Get-EnvValue "LOCATEANYTHING_TIMEOUT_SECONDS") { Get-EnvValue "LOCATEANYTHING_TIMEOUT_SECONDS" } else { "60" }
$LOCATEANYTHING_MAX_CONCURRENCY = if (Get-EnvValue "LOCATEANYTHING_MAX_CONCURRENCY") { Get-EnvValue "LOCATEANYTHING_MAX_CONCURRENCY" } else { "3" }
$TS_AUTHKEY = Get-EnvValue "TS_AUTHKEY"
if (-not $TS_AUTHKEY) { $TS_AUTHKEY = Get-EnvValue "TS_AUTH_KEY" }

# Build fly secrets command
Write-Host "Setting secrets for $APP_NAME..." -ForegroundColor Yellow

$secrets = @(
    "DASHSCOPE_API_KEY_SG=$DASHSCOPE_API_KEY_SG",
    "DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY",
    "R2_ENDPOINT_URL=$R2_ENDPOINT_URL",
    "R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME=$R2_BUCKET_NAME",
    "R2_PUBLIC_URL=$R2_PUBLIC_URL",
    "SUPABASE_URL=$SUPABASE_URL",
    "SUPABASE_KEY=$SUPABASE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL=$DATABASE_URL",
    "WEATHER_API_KEY=$WEATHER_API_KEY",
    "CREEM_API_KEY=$CREEM_API_KEY",
    "LOCATEANYTHING_ENABLED=$LOCATEANYTHING_ENABLED",
    "LOCATEANYTHING_BASE_URL=$LOCATEANYTHING_BASE_URL",
    "LOCATEANYTHING_TIMEOUT_SECONDS=$LOCATEANYTHING_TIMEOUT_SECONDS",
    "LOCATEANYTHING_MAX_CONCURRENCY=$LOCATEANYTHING_MAX_CONCURRENCY",
    "TS_HOSTNAME=$APP_NAME"
)
if ($TS_AUTHKEY) {
    $secrets += "TS_AUTHKEY=$TS_AUTHKEY"
}

# Build command arguments array
$args = @("secrets", "set")
foreach ($secret in $secrets) {
    $args += $secret
}
$args += "--app"
$args += $APP_NAME

Write-Host "Executing: fly $($args -join ' ')" -ForegroundColor Gray
Write-Host ""

# Execute fly command
& fly $args

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Error: Failed to set secrets. Exit code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host ""
    Write-Host "You can try setting secrets manually using:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "fly secrets set DASHSCOPE_API_KEY_SG=$DASHSCOPE_API_KEY_SG DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY R2_ENDPOINT_URL=$R2_ENDPOINT_URL R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY R2_BUCKET_NAME=$R2_BUCKET_NAME R2_PUBLIC_URL=$R2_PUBLIC_URL SUPABASE_URL=$SUPABASE_URL SUPABASE_KEY=$SUPABASE_KEY SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY DATABASE_URL=$DATABASE_URL WEATHER_API_KEY=$WEATHER_API_KEY CREEM_API_KEY=$CREEM_API_KEY --app $APP_NAME" -ForegroundColor Gray
    Write-Host ""
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "✅ Secrets set successfully for $APP_NAME!" -ForegroundColor Green
Write-Host ""
Write-Host "The application will automatically restart with the new secrets." -ForegroundColor Cyan
Write-Host ""
Write-Host "Checking application status..." -ForegroundColor Cyan
$statusArgs = @("status", "--app", $APP_NAME)
& fly $statusArgs

Write-Host ""
Write-Host "Verifying secrets (waiting for VM to start)..." -ForegroundColor Cyan
$verifyArgs = @("ssh", "console", "--app", $APP_NAME, "-C", "printenv | grep -E 'DASHSCOPE|SUPABASE|R2|DATABASE|WEATHER|CREEM' | sort")
$verifyResult = & fly $verifyArgs 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "⚠️  VM may still be starting. This is normal after setting secrets." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To verify secrets later, run:" -ForegroundColor Cyan
    Write-Host "  fly ssh console --app $APP_NAME -C 'printenv | grep -E \"DASHSCOPE|SUPABASE|R2|DATABASE|WEATHER|CREEM\" | sort'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "To check application logs:" -ForegroundColor Cyan
    Write-Host "  fly logs --app $APP_NAME" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "✅ Secrets verified successfully!" -ForegroundColor Green
    Write-Host ""
}

