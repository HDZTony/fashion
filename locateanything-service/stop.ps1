param([int]$Port = 8000)

$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $conn) {
    Write-Host "Nothing listening on port $Port."
    exit 0
}
foreach ($procId in ($conn.OwningProcess | Select-Object -Unique)) {
    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($p -and $p.Path -like "*LocateAnything*\.venv*") {
        Stop-Process -Id $procId -Force
        Write-Host "Stopped PID $procId"
    } elseif ($p -and ($p.ProcessName -eq "python")) {
        Stop-Process -Id $procId -Force
        Write-Host "Stopped python PID $procId on port $Port"
    }
}
