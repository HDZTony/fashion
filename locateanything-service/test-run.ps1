$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
$log = Join-Path $PSScriptRoot "logs\debug-run.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
Write-Host "Testing model load..."
& $py -c "from worker import LocateAnythingWorker; w=LocateAnythingWorker('model_weights'); print('model loaded', w.device)" 2>&1 | Tee-Object -FilePath $log
Write-Host "Log: $log"
