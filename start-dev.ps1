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
        Command = "node scripts/dev.mjs"
        Color = "Yellow"
        Port = 5173
    },
    @{
        Name = "UniApp v2 (H5)"
        Path = "fashion_rec\uniapp-v2"
        Command = "pnpm dev"
        Color = "DarkYellow"
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

    # Python：首次缺少 .venv 时先同步依赖（Wrangler / Node：缺少 node_modules 时先 pnpm install）
    if ($service.Command -match '^\s*uv\s') {
        $venvPath = Join-Path $servicePath ".venv"
        if (-not (Test-Path $venvPath)) {
            Write-Host "  首次同步 Python 依赖 ($($service.Name))..." -ForegroundColor DarkGray
            Push-Location $servicePath
            try {
                uv sync
                if ($LASTEXITCODE -ne 0) { throw "uv sync failed with exit code $LASTEXITCODE" }
            } finally {
                Pop-Location
            }
        }
    }
    elseif ($service.Command -match '^\s*pnpm\s') {
        $nmPath = Join-Path $servicePath "node_modules"
        if (-not (Test-Path $nmPath)) {
            Write-Host "  首次安装 Node 依赖 ($($service.Name))..." -ForegroundColor DarkGray
            Push-Location $servicePath
            try {
                pnpm install
                if ($LASTEXITCODE -ne 0) { throw "pnpm install failed with exit code $LASTEXITCODE" }
            } finally {
                Pop-Location
            }
        }
    }
    
    # 带 Port 的服务：启动前释放端口，关闭窗口时再次释放，避免 Vite 退到 5174
    if ($service.Port) {
        $port = $service.Port
        $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($conn) {
            Write-Host "  释放占用端口 $port 的旧进程..." -ForegroundColor DarkGray
            $conn | ForEach-Object {
                Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Milliseconds 500
        }
        $command = @"
Set-Location '$servicePath'
`$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id `$_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
$($service.Command)
"@
    }
    else {
        $command = "cd `"$servicePath`"; $($service.Command)"
    }
    
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
