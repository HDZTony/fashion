#!/bin/bash
# 本地开发环境启动脚本 (macOS/Linux)
# 同时启动所有开发服务，每个服务在独立终端窗口中运行

set -e
workspace_root="$(cd "$(dirname "$0")" && pwd)"

# ANSI 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 启动本地开发环境...${NC}"
echo -e "${GRAY}工作目录: $workspace_root${NC}"
echo ""

# 定义服务配置: "显示名称|相对路径|命令|颜色"
services=(
  "Python Backend|fashion_rec/backend|uv run run.py|$CYAN"
  "Vue Frontend|fashion_rec/frontend|pnpm dev|$YELLOW"
  "Blog Service|cloudflare-blog|pnpm dev|$BLUE"
  "Cloudflare Router|cloudflare-router|pnpm dev|$MAGENTA"
  "Subscription Service|fashion_rec/backend/subscription-service|pnpm dev|$GREEN"
)

# 检测是否为 macOS（用于在新 Terminal 窗口中打开）
is_macos() {
  [[ "$(uname)" == "Darwin" ]]
}

# 在 macOS 上新开 Terminal 窗口并执行命令
open_terminal_window() {
  local service_path="$1"
  local command="$2"
  if is_macos; then
    osascript -e "tell application \"Terminal\" to do script \"cd '$service_path' && $command\""
  else
    # Linux: 尝试 gnome-terminal, xterm 等
    if command -v gnome-terminal &>/dev/null; then
      gnome-terminal -- bash -c "cd '$service_path' && $command; exec bash"
    elif command -v xterm &>/dev/null; then
      xterm -e "cd '$service_path' && $command; exec bash"
    else
      echo -e "${RED}未找到可用的终端模拟器，在后台启动...${NC}"
      (cd "$service_path" && eval "$command") &
    fi
  fi
}

for entry in "${services[@]}"; do
  IFS='|' read -r name path_rel command color <<< "$entry"
  service_path="$workspace_root/$path_rel"

  if [[ ! -d "$service_path" ]]; then
    echo -e "${RED}⚠️  警告: 路径不存在 - $service_path${NC}"
    continue
  fi

  echo -e "${color}启动 $name...${NC}"
  open_terminal_window "$service_path" "$command"

  # 短暂延迟，避免窗口同时打开造成混乱
  sleep 0.5
done

echo ""
echo -e "${GREEN}✅ 所有服务已启动！${NC}"
echo -e "${GRAY}每个服务都在独立的窗口中运行。${NC}"
echo ""
echo -e "${GRAY}提示: 关闭窗口即可停止对应的服务。${NC}"
