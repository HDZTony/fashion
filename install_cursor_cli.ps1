# Cursor CLI 安装脚本 - PowerShell 版本
# 适用于 Windows，无需 bash

$ErrorActionPreference = "Stop"

Write-Host "=== Cursor CLI 安装程序 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查是否已安装
Write-Host "1. 检查现有安装..." -ForegroundColor Yellow
$cursorAgentPath = Get-Command cursor-agent -ErrorAction SilentlyContinue
if ($cursorAgentPath) {
    Write-Host "[OK] Cursor CLI 已安装: $($cursorAgentPath.Source)" -ForegroundColor Green
    Write-Host "版本信息:" -ForegroundColor Yellow
    cursor-agent --version
    Write-Host ""
    $response = Read-Host "是否要重新安装? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "安装已取消" -ForegroundColor Yellow
        exit 0
    }
}

# 2. 确定安装目录
Write-Host "2. 确定安装目录..." -ForegroundColor Yellow
$installDir = Join-Path $env:USERPROFILE ".local\bin"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    Write-Host "[OK] 创建安装目录: $installDir" -ForegroundColor Green
} else {
    Write-Host "[OK] 安装目录已存在: $installDir" -ForegroundColor Green
}

# 3. 获取最新版本信息
Write-Host "3. 获取最新版本信息..." -ForegroundColor Yellow
try {
    # 尝试从 GitHub Releases 获取最新版本
    $releasesUrl = "https://api.github.com/repos/getcursor/cursor/releases/latest"
    $releaseInfo = Invoke-RestMethod -Uri $releasesUrl -UseBasicParsing -ErrorAction SilentlyContinue
    
    if ($releaseInfo) {
        Write-Host "[OK] 找到最新版本: $($releaseInfo.tag_name)" -ForegroundColor Green
        $version = $releaseInfo.tag_name
    } else {
        Write-Host "[WARN] 无法获取版本信息，使用默认版本" -ForegroundColor Yellow
        $version = "latest"
    }
} catch {
    Write-Host "[WARN] 无法获取版本信息，使用默认版本" -ForegroundColor Yellow
    $version = "latest"
}

# 4. 下载 Cursor CLI
Write-Host "4. 下载 Cursor CLI..." -ForegroundColor Yellow

# 尝试多种下载方式
$downloadUrls = @(
    "https://cursor.com/download/windows",
    "https://github.com/getcursor/cursor/releases/latest/download/cursor-agent-windows-amd64.exe",
    "https://releases.cursor.com/cursor-agent-windows-amd64.exe"
)

$downloaded = $false
$binaryPath = Join-Path $installDir "cursor-agent.exe"

foreach ($url in $downloadUrls) {
    try {
        Write-Host "  尝试从: $url" -ForegroundColor Gray
        Invoke-WebRequest -Uri $url -OutFile $binaryPath -UseBasicParsing -ErrorAction Stop
        if (Test-Path $binaryPath -and (Get-Item $binaryPath).Length -gt 0) {
        Write-Host "[OK] 下载成功" -ForegroundColor Green
            $downloaded = $true
            break
        }
    } catch {
        Write-Host "  ✗ 下载失败: $_" -ForegroundColor Red
        continue
    }
}

if (-not $downloaded) {
    Write-Host ""
    Write-Host "[ERR] 无法从官方源下载 Cursor CLI" -ForegroundColor Red
    Write-Host ""
    Write-Host "请尝试以下方法:" -ForegroundColor Yellow
    Write-Host "1. 手动下载: 访问 https://cursor.com/download" -ForegroundColor White
    Write-Host "2. 使用 Git Bash 或 WSL 运行原始安装脚本" -ForegroundColor White
    Write-Host "3. 检查网络连接和防火墙设置" -ForegroundColor White
    exit 1
}

# 5. 设置执行权限
Write-Host "5. 设置执行权限..." -ForegroundColor Yellow
try {
    # 移除可能的阻止标记
    Unblock-File -Path $binaryPath -ErrorAction SilentlyContinue
    Write-Host "[OK] 执行权限已设置" -ForegroundColor Green
} catch {
    Write-Host "[WARN] 设置执行权限时出现警告: $_" -ForegroundColor Yellow
}

# 6. 添加到 PATH
Write-Host "6. 添加到 PATH 环境变量..." -ForegroundColor Yellow
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$installDir*") {
    try {
        $newPath = $currentPath + ";$installDir"
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Host "[OK] 已添加到用户 PATH" -ForegroundColor Green
        Write-Host "  注意: 需要重新启动 PowerShell 或重新加载环境变量" -ForegroundColor Yellow
        
        # 临时添加到当前会话
        $env:Path += ";$installDir"
        Write-Host "[OK] 已添加到当前会话 PATH" -ForegroundColor Green
    } catch {
        Write-Host "[ERR] 添加到 PATH 失败: $_" -ForegroundColor Red
        Write-Host "  请手动添加: $installDir" -ForegroundColor Yellow
    }
} else {
    Write-Host "[OK] PATH 中已包含安装目录" -ForegroundColor Green
}

# 7. 验证安装
Write-Host "7. 验证安装..." -ForegroundColor Yellow
try {
    # 刷新命令缓存
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    # 尝试运行
    $testResult = & "$binaryPath" --version 2>&1
    if ($LASTEXITCODE -eq 0 -or $testResult) {
        Write-Host "[OK] 安装成功!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Cursor CLI 版本信息:" -ForegroundColor Cyan
        & "$binaryPath" --version
        Write-Host ""
        Write-Host "安装位置: $binaryPath" -ForegroundColor Cyan
    } else {
        Write-Host "[WARN] 安装完成，但验证时出现问题" -ForegroundColor Yellow
        Write-Host "  请手动运行: cursor-agent --version" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARN] 验证时出现错误: $_" -ForegroundColor Yellow
    Write-Host "  但文件已下载到: $binaryPath" -ForegroundColor Yellow
    Write-Host "  请手动测试: $binaryPath --version" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 安装完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "如果 cursor-agent 命令不可用，请:" -ForegroundColor Yellow
Write-Host "1. 重新启动 PowerShell" -ForegroundColor White
Write-Host "2. 或运行: `$env:Path += ';$installDir'" -ForegroundColor White
Write-Host "3. 或手动添加到系统 PATH: $installDir" -ForegroundColor White
