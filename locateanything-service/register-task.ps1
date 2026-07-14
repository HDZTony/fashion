# Register LocateAnything-3B to start at boot (runs as current user).
$ErrorActionPreference = "Stop"
$ProjectDir = $PSScriptRoot
$TaskName = "LocateAnything-3B-Service"

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ProjectDir\launch.ps1`"" `
    -WorkingDirectory $ProjectDir

$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "LocateAnything-3B bbox API on port 8000"
Write-Host "Registered scheduled task: $TaskName"
