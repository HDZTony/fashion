# PowerShell script to verify secrets and redeploy V2 app
# This script verifies secrets are set and then redeploys the application

$ErrorActionPreference = "Stop"

$APP_NAME = "fashion-rec-backend-v2"

Write-Host "Verifying and redeploying $APP_NAME..." -ForegroundColor Cyan
Write-Host ""

# Check if fly command is available
$flyCmd = Get-Command fly -ErrorAction SilentlyContinue

# If not found, try common installation locations
if (-not $flyCmd) {
    $commonPaths = @(
        "$env:USERPROFILE\.fly\bin\fly.exe",
        "$env:LOCALAPPDATA\fly\bin\fly.exe",
        "C:\flyctl\fly.exe"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            Write-Host "Found fly at: $path" -ForegroundColor Yellow
            Write-Host "Adding to PATH for this session..." -ForegroundColor Yellow
            $env:Path += ";$(Split-Path $path -Parent)"
            $flyCmd = Get-Command fly -ErrorAction SilentlyContinue
            if ($flyCmd) {
                break
            }
        }
    }
}

if (-not $flyCmd) {
    Write-Host "❌ Error: 'fly' command not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Fly.io CLI:" -ForegroundColor Yellow
    Write-Host "  iwr https://fly.io/install.ps1 -useb | iex" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or see INSTALL_FLY_CLI.md for detailed instructions." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found fly command at: $($flyCmd.Source)" -ForegroundColor Green
Write-Host ""

# Step 1: List secrets to verify they are set
Write-Host "Step 1: Verifying secrets are set..." -ForegroundColor Cyan
Write-Host ""
$listArgs = @("secrets", "list", "--app", $APP_NAME)
$secretsOutput = & fly $listArgs 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error: Failed to list secrets" -ForegroundColor Red
    Write-Host $secretsOutput
    exit $LASTEXITCODE
}

Write-Host $secretsOutput
Write-Host ""

# Check if DASHSCOPE_API_KEY_SG is in the list
if ($secretsOutput -match "DASHSCOPE_API_KEY_SG") {
    Write-Host "✅ DASHSCOPE_API_KEY_SG is set" -ForegroundColor Green
} else {
    Write-Host "❌ Warning: DASHSCOPE_API_KEY_SG not found in secrets list" -ForegroundColor Yellow
    Write-Host "You may need to set secrets again." -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Check application status
Write-Host "Step 2: Checking application status..." -ForegroundColor Cyan
Write-Host ""
$statusArgs = @("status", "--app", $APP_NAME)
& fly $statusArgs
Write-Host ""

# Step 3: Redeploy application
Write-Host "Step 3: Redeploying application with new secrets..." -ForegroundColor Cyan
Write-Host ""
Write-Host "This will build a new image and deploy it with the current secrets." -ForegroundColor Yellow
Write-Host ""

$deployArgs = @("deploy", "--config", "fly.v2.toml", "--remote-only", "--app", $APP_NAME)
Write-Host "Executing: fly $($deployArgs -join ' ')" -ForegroundColor Gray
Write-Host ""

& fly $deployArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Error: Deployment failed. Exit code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check if all secrets are set: fly secrets list --app $APP_NAME" -ForegroundColor Gray
    Write-Host "2. Check application logs: fly logs --app $APP_NAME" -ForegroundColor Gray
    Write-Host "3. Check application status: fly status --app $APP_NAME" -ForegroundColor Gray
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "✅ Deployment successful!" -ForegroundColor Green
Write-Host ""
Write-Host "Application is being replaced with the new version..." -ForegroundColor Cyan
Write-Host "Waiting for application to fully start (this may take 30-60 seconds)..." -ForegroundColor Yellow
Write-Host ""

# Wait and check status multiple times
$maxAttempts = 12
$attempt = 0
$started = $false

while ($attempt -lt $maxAttempts -and -not $started) {
    Start-Sleep -Seconds 5
    $attempt++
    Write-Host "Checking status (attempt $attempt/$maxAttempts)..." -ForegroundColor Gray
    
    $statusOutput = & fly $statusArgs 2>&1
    if ($statusOutput -match "started|running") {
        $started = $true
        Write-Host ""
        Write-Host "✅ Application is running!" -ForegroundColor Green
    } elseif ($statusOutput -match "stopped|failed") {
        Write-Host ""
        Write-Host "⚠️  Application may have issues. Checking logs..." -ForegroundColor Yellow
        break
    }
}

Write-Host ""
Write-Host "Step 4: Final application status..." -ForegroundColor Cyan
Write-Host ""
& fly $statusArgs

Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  View logs:        fly logs --app $APP_NAME" -ForegroundColor Gray
Write-Host "  Check status:     fly status --app $APP_NAME" -ForegroundColor Gray
Write-Host "  Verify secrets:  fly ssh console --app $APP_NAME -C 'printenv | grep DASHSCOPE'" -ForegroundColor Gray
Write-Host "  Open app:         https://$APP_NAME.fly.dev/" -ForegroundColor Gray
Write-Host ""

