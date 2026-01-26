# PowerShell script to set FAL_KEY for both Fly.io apps
# Run this script from the fashion_rec/backend directory

$ErrorActionPreference = "Stop"

$ENV_FILE = ".env"
$APPS = @("fashion-rec-backend", "fashion-rec-backend-v2")

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Setting FAL_KEY for Fly.io Applications  " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if fly command is available
$flyCmd = Get-Command fly -ErrorAction SilentlyContinue
if (-not $flyCmd) {
    Write-Host "❌ Error: 'fly' command not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Fly.io CLI first:" -ForegroundColor Yellow
    Write-Host "  iwr https://fly.io/install.ps1 -useb | iex" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✅ Found fly command at: $($flyCmd.Source)" -ForegroundColor Green
Write-Host ""

# Check if .env file exists
if (-not (Test-Path $ENV_FILE)) {
    Write-Host "❌ Error: $ENV_FILE not found!" -ForegroundColor Red
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

# Read FAL_KEY from .env
$FAL_KEY = Get-EnvValue "FAL_KEY"

if (-not $FAL_KEY) {
    Write-Host "❌ Error: FAL_KEY not found in $ENV_FILE!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please add FAL_KEY to your .env file:" -ForegroundColor Yellow
    Write-Host "  FAL_KEY=your_fal_api_key_here" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✅ Found FAL_KEY in $ENV_FILE" -ForegroundColor Green
Write-Host "   Value: $($FAL_KEY.Substring(0, 10))..." -ForegroundColor Gray
Write-Host ""

# Set secret for each app
foreach ($APP_NAME in $APPS) {
    Write-Host "----------------------------------------" -ForegroundColor DarkGray
    Write-Host "Setting FAL_KEY for: $APP_NAME" -ForegroundColor Yellow
    Write-Host ""
    
    $args = @("secrets", "set", "FAL_KEY=$FAL_KEY", "--app", $APP_NAME)
    
    Write-Host "Executing: fly secrets set FAL_KEY=*** --app $APP_NAME" -ForegroundColor Gray
    
    & fly $args
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "❌ Failed to set FAL_KEY for $APP_NAME" -ForegroundColor Red
        Write-Host ""
        Write-Host "You can try manually:" -ForegroundColor Yellow
        Write-Host "  fly secrets set FAL_KEY=$FAL_KEY --app $APP_NAME" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "✅ FAL_KEY set successfully for $APP_NAME" -ForegroundColor Green
        Write-Host ""
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All done!                            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Both applications will automatically restart with the new secret." -ForegroundColor Green
Write-Host ""
Write-Host "To verify secrets, run:" -ForegroundColor Cyan
Write-Host "  fly secrets list --app fashion-rec-backend" -ForegroundColor Gray
Write-Host "  fly secrets list --app fashion-rec-backend-v2" -ForegroundColor Gray
Write-Host ""
