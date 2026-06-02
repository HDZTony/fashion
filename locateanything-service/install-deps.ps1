$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
& $py -m pip install opencv-python requests lmdb
# decord has no reliable Windows wheel; model may still load without it on image-only tasks.
& $py -m pip install decord 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "decord install skipped (optional on Windows)" -ForegroundColor Yellow
}
Write-Host "Deps installed."
