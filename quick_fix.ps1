# 快速修复 PowerShell 输出 - 一键执行版本

# 强制显示输出
$ErrorActionPreference = "Continue"
$InformationPreference = "Continue"
$VerbosePreference = "Continue"
$DebugPreference = "Continue"
$WarningPreference = "Continue"

# 设置编码
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

# 强制输出到控制台
function Force-Output {
    param([string]$Message, [string]$Color = "White")
    [Console]::WriteLine($Message)
    Write-Host $Message -ForegroundColor $Color
}

# 测试输出
Force-Output "=== PowerShell 输出修复 ===" "Cyan"
Force-Output "1. 设置输出编码..." "Yellow"
Force-Output "✓ UTF-8 编码已设置" "Green"

Force-Output "2. 更新执行策略..." "Yellow"
try {
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force -ErrorAction Stop
    Force-Output "✓ 执行策略已更新为 RemoteSigned" "Green"
} catch {
    Force-Output "✗ 更新执行策略失败: $_" "Red"
}

Force-Output "3. 创建/更新 PowerShell 配置文件..." "Yellow"
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent

if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

$fixCode = @"
# Cursor 终端输出修复 - 自动添加
`$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

# 强制输出函数
function Show-Output {
    param([string]`$Message, [string]`$Color = 'White')
    [Console]::WriteLine(`$Message)
    Write-Host `$Message -ForegroundColor `$Color
}
"@

if (-not (Test-Path $profilePath)) {
    $fixCode | Out-File -FilePath $profilePath -Encoding UTF8
    Force-Output "✓ 配置文件已创建并添加修复代码" "Green"
} else {
    $content = Get-Content $profilePath -Raw -ErrorAction SilentlyContinue
    if ($content -notmatch "Cursor 终端输出修复") {
        Add-Content -Path $profilePath -Value "`n$fixCode" -Encoding UTF8
        Force-Output "✓ 修复代码已添加到现有配置文件" "Green"
    } else {
        Force-Output "✓ 修复代码已存在" "Green"
    }
}

Force-Output "4. 测试输出..." "Yellow"
Force-Output "✓ Write-Host 测试" "Green"
Force-Output "✓ Write-Output 测试" "Green"
[Console]::WriteLine("✓ Console.WriteLine 测试")

Force-Output "`n=== 修复完成 ===" "Cyan"
Force-Output "请重新启动 PowerShell 或运行: . `$PROFILE" "Yellow"
Force-Output "然后测试: Write-Host '测试' -ForegroundColor Green" "Yellow"
