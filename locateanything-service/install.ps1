# LocateAnything-3B — first-time setup (Windows, NVIDIA GPU)
param(
    [string]$ProjectDir = $PSScriptRoot,
    [string]$ModelId = "nvidia/LocateAnything-3B",
    [switch]$SkipModelDownload
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectDir

Write-Host "==> LocateAnything install in $ProjectDir" -ForegroundColor Cyan

# Avoid Windows Store python stub (WindowsApps\python.exe).
$basePython = & py -3.12 -c "import sys; print(sys.executable)" 2>$null
if (-not $basePython) {
    $basePython = (Get-Command python -ErrorAction Stop).Source
}
Write-Host "Using base Python: $basePython"

if (-not (Test-Path ".venv")) {
    Write-Host "Creating venv..."
    & $basePython -m venv .venv
    Start-Sleep -Seconds 2
}

$py = Join-Path $ProjectDir ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    throw "venv python not found at $py"
}

Write-Host "Installing PyTorch (CUDA) + dependencies..."
& $py -m ensurepip --upgrade
& $py -m pip install --upgrade pip
& $py -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124
& $py -m pip install -r requirements.txt
& $py -m pip install "transformers==4.57.1" "numpy>=1.25,<2" "peft" "opencv-python-headless==4.11.0.86"
& $py -m pip install "huggingface_hub[cli]"

$weights = Join-Path $ProjectDir "model_weights"
if (-not $SkipModelDownload) {
    if (-not (Test-Path (Join-Path $weights "config.json"))) {
        Write-Host "Downloading model to $weights (may take a while)..."
        if (-not $env:HF_ENDPOINT) {
            $env:HF_ENDPOINT = "https://hf-mirror.com"
            Write-Host "Using HF mirror: $env:HF_ENDPOINT"
        }
        $hfCli = Join-Path $ProjectDir ".venv\Scripts\hf.exe"
        if (Test-Path $hfCli) {
            & $hfCli download $ModelId --local-dir $weights
        } else {
            $legacyCli = Join-Path $ProjectDir ".venv\Scripts\huggingface-cli.exe"
            if (-not (Test-Path $legacyCli)) {
                throw "hf / huggingface-cli not found in venv"
            }
            & $legacyCli download $ModelId --local-dir $weights
        }
    } else {
        Write-Host "Model weights already present, skipping download."
    }
}

Write-Host "Done. Start with: .\run-service.ps1" -ForegroundColor Green
