# Set Fly.io secrets for LocateAnything + optional Tailscale auth key.
# Run from fashion_rec/backend after: fly auth login
#
# Optional in .env:
#   TS_AUTHKEY=tskey-auth-...   (Reusable key from https://login.tailscale.com/admin/settings/keys)
#
param(
    [string]$AppName = "fashion-rec-backend",
    [switch]$V2,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
if ($V2) { $AppName = "fashion-rec-backend-v2" }

$LOCATE_BASE = "http://100.73.75.78:8000"

$flyCmd = Get-Command fly -ErrorAction SilentlyContinue
$fly = if ($flyCmd) { $flyCmd.Source } else { $null }
if (-not $fly) {
    $flyctl = Join-Path $env:USERPROFILE ".fly\bin\flyctl.exe"
    if (Test-Path $flyctl) { $fly = $flyctl }
}
if (-not $fly) {
    Write-Host "fly CLI not found. Install:" -ForegroundColor Yellow
    Write-Host "  iwr https://fly.io/install.ps1 -useb | iex" -ForegroundColor Gray
    exit 1
}

function Get-EnvValue {
    param([string]$Key, [string]$File = ".env")
    if (-not (Test-Path $File)) { return $null }
    $escaped = [regex]::Escape($Key)
    $line = Get-Content $File | Where-Object { $_ -match "^\s*$escaped\s*=" } | Select-Object -First 1
    if ($line) {
        return ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
    }
    return $null
}

$secrets = @(
    "LOCATEANYTHING_ENABLED=true",
    "LOCATEANYTHING_BASE_URL=$LOCATE_BASE",
    "LOCATEANYTHING_TIMEOUT_SECONDS=60",
    "LOCATEANYTHING_MAX_CONCURRENCY=3",
    "TS_HOSTNAME=$AppName"
)

$tsKey = Get-EnvValue "TAILSCALE_AUTHKEY"
if (-not $tsKey) { $tsKey = Get-EnvValue "tailscale_auth_key" }
if (-not $tsKey) { $tsKey = Get-EnvValue "TS_AUTHKEY" }
if (-not $tsKey) { $tsKey = Get-EnvValue "TS_AUTH_KEY" }
if ($tsKey) {
    $secrets += "TAILSCALE_AUTHKEY=$tsKey"
    Write-Host "TAILSCALE_AUTHKEY found in .env — Tailscale will join tailnet on deploy." -ForegroundColor Green
} else {
    Write-Host "TAILSCALE_AUTHKEY not in .env — only LocateAnything URL secrets will be set." -ForegroundColor Yellow
    Write-Host "Generate a Reusable key at: https://login.tailscale.com/admin/settings/keys" -ForegroundColor Yellow
    Write-Host "Then add TAILSCALE_AUTHKEY=tskey-auth-... (or tailscale_auth_key) to .env and re-run." -ForegroundColor Yellow
}

$args = @("secrets", "set") + $secrets + @("--app", $AppName)
Write-Host "App: $AppName" -ForegroundColor Cyan
Write-Host "fly $($args -join ' ')" -ForegroundColor Gray

if ($DryRun) { exit 0 }

& $fly @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Secrets set. Redeploy backend so Dockerfile fly-start.sh picks up Tailscale:" -ForegroundColor Cyan
Write-Host "  cd fashion_rec/backend" -ForegroundColor Gray
if ($V2) {
    Write-Host "  fly deploy --config fly.v2.toml" -ForegroundColor Gray
} else {
    Write-Host "  fly deploy" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Verify from Fly VM:" -ForegroundColor Cyan
Write-Host "  fly ssh console --app $AppName -C `"curl -s http://100.73.75.78:8000/health`"" -ForegroundColor Gray
