# Wrapper: delegates to global deploy script (same machine, all Cursor projects).
$globalScript = Join-Path $env:USERPROFILE ".cursor\skills\locateanything-ssh-deploy\scripts\deploy-to-kdsvgm5.ps1"
if (-not (Test-Path $globalScript)) {
    throw "Global skill script not found: $globalScript"
}
$repoService = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$env:LOCATEANYTHING_SERVICE_DIR = $repoService
& $globalScript
exit $LASTEXITCODE
