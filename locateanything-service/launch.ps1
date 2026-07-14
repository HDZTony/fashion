$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot "set-performance-env.ps1")
$log = Join-Path $PSScriptRoot "logs\launch.log"
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
& $py run_model.py 2>&1 | Tee-Object -FilePath $log
