# Start LocateAnything-3B service (background on Windows)
param(
    [string]$ProjectDir = $PSScriptRoot,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectDir

$py = Join-Path $ProjectDir ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    throw "Run install.ps1 first (.venv missing)."
}

$logDir = Join-Path $ProjectDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Port $Port already in use (PID $($existing.OwningProcess)). Stop it first or use another port."
    exit 1
}

$stdout = Join-Path $logDir "stdout.log"
$stderr = Join-Path $logDir "stderr.log"
$env:LOCATEANYTHING_PORT = "$Port"

Write-Host "Starting LocateAnything on 0.0.0.0:$Port ..."
Start-Process -FilePath $py `
    -ArgumentList "run_model.py" `
    -WorkingDirectory $ProjectDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr

Start-Sleep -Seconds 3
try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 120
    Write-Host "Health: $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "Service starting (model load may take 1-2 min). Check $stderr" -ForegroundColor Yellow
}

Write-Host "Logs: $stdout , $stderr"
