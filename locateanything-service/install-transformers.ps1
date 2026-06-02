$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
& $py -m pip install "transformers==4.57.1" "numpy>=1.25,<2" "peft" "opencv-python-headless==4.11.0.86"
Write-Host "transformers pinned."
