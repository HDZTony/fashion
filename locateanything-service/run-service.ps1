# Start LocateAnything-3B service (background). Avoid naming file start.ps1 on Windows.
param(
    [string]$ProjectDir = $PSScriptRoot,
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectDir
. (Join-Path $ProjectDir "set-performance-env.ps1")

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

Start-Sleep -Seconds 5
$deadline = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 10
        if ($r.status -eq "ok") {
            Write-Host "Health: $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
            exit 0
        }
    } catch { }
    Start-Sleep -Seconds 10
}
Write-Host "Service still loading. Check $stderr" -ForegroundColor Yellow
