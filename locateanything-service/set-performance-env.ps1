# Default GPU inference tuning (override via machine env before launch).
if (-not $env:LOCATEANYTHING_MAX_NEW_TOKENS) {
    $env:LOCATEANYTHING_MAX_NEW_TOKENS = "512"
}
if (-not $env:LOCATEANYTHING_GENERATION_MODE) {
    $env:LOCATEANYTHING_GENERATION_MODE = "hybrid"
}
