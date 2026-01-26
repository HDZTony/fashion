# 本地开发环境启动脚本
# 同时启动所有开发服务

$ErrorActionPreference = "Stop"
$workspaceRoot = $PSScriptRoot

Write-Host "🚀 启动本地开发环境..." -ForegroundColor Green
Write-Host "工作目录: $workspaceRoot" -ForegroundColor Gray
Write-Host ""

# 定义服务配置
$services = @(
    @{
        Name = "Python Backend"
        Path = "fashion_rec\backend"
        Command = "uv run run.py"
        Color = "Cyan"
    },
    @{
        Name = "Vue Frontend"
        Path = "fashion_rec\frontend"
        Command = "pnpm dev"
        Color = "Yellow"
    },
    @{
        Name = "Blog Service"
        Path = "cloudflare-blog"
        Command = "pnpm dev"
        Color = "Blue"
    },
    @{
        Name = "Cloudflare Router"
        Path = "cloudflare-router"
        Command = "pnpm dev"
        Color = "Magenta"
    },
    @{
        Name = "Subscription Service"
        Path = "fashion_rec\backend\subscription-service"
        Command = "pnpm dev"
        Color = "Green"
    }
)

# 启动每个服务
foreach ($service in $services) {
    $servicePath = Join-Path $workspaceRoot $service.Path
    
    if (-not (Test-Path $servicePath)) {
        Write-Host "⚠️  警告: 路径不存在 - $servicePath" -ForegroundColor Red
        continue
    }
    
    Write-Host "启动 $($service.Name)..." -ForegroundColor $service.Color
    
    # 创建启动命令
    $command = "cd `"$servicePath`"; $($service.Command)"
    
    # 在新窗口中启动服务
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", $command
    
    # 短暂延迟，避免窗口同时打开造成混乱
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "✅ 所有服务已启动！" -ForegroundColor Green
Write-Host "每个服务都在独立的窗口中运行。" -ForegroundColor Gray
Write-Host ""
Write-Host "提示: 关闭窗口即可停止对应的服务。" -ForegroundColor Gray
