param(
    [string]$ProjectDir = $PSScriptRoot,
    [string]$ModelId = "nvidia/LocateAnything-3B"
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectDir

$weights = Join-Path $ProjectDir "model_weights"
if (Test-Path (Join-Path $weights "config.json")) {
    Write-Host "Model already at $weights"
    exit 0
}

$hf = Join-Path $ProjectDir ".venv\Scripts\hf.exe"
if (-not (Test-Path $hf)) {
    $hf = Join-Path $ProjectDir ".venv\Scripts\huggingface-cli.exe"
}
if (-not (Test-Path $hf)) {
    throw "hf CLI not found; run install.ps1 first"
}

$endpoints = @(
    $null,  # huggingface.co (use when VPN available)
    "https://hf-mirror.com"
)
$ok = $false
foreach ($endpoint in $endpoints) {
    if ($endpoint) {
        $env:HF_ENDPOINT = $endpoint
        Write-Host "Trying HF_ENDPOINT=$endpoint"
    } else {
        Remove-Item Env:HF_ENDPOINT -ErrorAction SilentlyContinue
        Write-Host "Trying huggingface.co (default)"
    }
    Remove-Item -Recurse -Force $weights -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $weights | Out-Null
    & $hf download $ModelId --local-dir $weights
    if ($LASTEXITCODE -eq 0 -and (Test-Path (Join-Path $weights "config.json"))) {
        $ok = $true
        break
    }
    Write-Host "Attempt failed (exit=$LASTEXITCODE), retrying..." -ForegroundColor Yellow
}

if (-not $ok) {
    throw "Model download failed for $ModelId"
}
Write-Host "Download complete: $weights"
