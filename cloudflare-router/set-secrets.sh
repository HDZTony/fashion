#!/bin/bash
# Bash script to set environment variables for fashion-rec-router worker
# 从 backend/.env 文件中读取 SUPABASE 配置

WORKER_NAME="fashion-rec-router"
BACKEND_ENV_FILE="../fashion_rec/backend/.env"

echo "Setting environment variables for $WORKER_NAME..."
echo ""

# 从 .env 文件读取 Supabase 配置
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""

if [ -f "$BACKEND_ENV_FILE" ]; then
    echo "Reading Supabase configuration from $BACKEND_ENV_FILE..."
    while IFS= read -r line || [ -n "$line" ]; do
        if [[ $line =~ ^SUPABASE_URL=(.+)$ ]]; then
            SUPABASE_URL="${BASH_REMATCH[1]}"
        fi
        if [[ $line =~ ^SUPABASE_SERVICE_ROLE_KEY=(.+)$ ]]; then
            SUPABASE_SERVICE_ROLE_KEY="${BASH_REMATCH[1]}"
        fi
    done < "$BACKEND_ENV_FILE"
fi

# 配置值
STABLE_FRONTEND_HOST="fashion-rec-frontend.pages.dev"  # 前端 hostname（stable 和 v2 共用同一个 Pages 项目）
V2_FRONTEND_HOST="v2.fashion-rec-frontend.pages.dev"   # V2 分支预览 hostname
STABLE_BACKEND_URL="https://fashion-rec-backend.fly.dev"       # 稳定版后端 URL
# v2 Fly 应用已下线，V2_BACKEND_URL 暂与 stable 相同；恢复 v2 测试时改回独立 Fly 应用 URL
V2_BACKEND_URL="$STABLE_BACKEND_URL"

# 设置 SUPABASE_URL
if [ -n "$SUPABASE_URL" ]; then
    echo "Setting SUPABASE_URL..."
    echo "$SUPABASE_URL" | pnpm exec wrangler secret put SUPABASE_URL
else
    echo "⚠️  SUPABASE_URL 未找到，请手动设置"
fi

# 设置 SUPABASE_SERVICE_ROLE_KEY
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Setting SUPABASE_SERVICE_ROLE_KEY..."
    echo "$SUPABASE_SERVICE_ROLE_KEY" | pnpm exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
else
    echo "⚠️  SUPABASE_SERVICE_ROLE_KEY 未找到，请手动设置"
fi

# 设置 STABLE_SUBSCRIPTION_SERVICE_URL
echo "Setting STABLE_SUBSCRIPTION_SERVICE_URL..."
echo "https://subscription.hdz73.com" | pnpm exec wrangler secret put STABLE_SUBSCRIPTION_SERVICE_URL

# 设置 V2_SUBSCRIPTION_SERVICE_URL
echo "Setting V2_SUBSCRIPTION_SERVICE_URL..."
echo "https://fashion-rec-subscription-service-v2.954504788.workers.dev" | pnpm exec wrangler secret put V2_SUBSCRIPTION_SERVICE_URL

# 设置 STABLE_FRONTEND_HOST
echo "Setting STABLE_FRONTEND_HOST..."
echo "$STABLE_FRONTEND_HOST" | pnpm exec wrangler secret put STABLE_FRONTEND_HOST

# 设置 V2_FRONTEND_HOST
echo "Setting V2_FRONTEND_HOST..."
echo "$V2_FRONTEND_HOST" | pnpm exec wrangler secret put V2_FRONTEND_HOST

# 设置 STABLE_BACKEND_URL
echo "Setting STABLE_BACKEND_URL..."
echo "$STABLE_BACKEND_URL" | pnpm exec wrangler secret put STABLE_BACKEND_URL

# 设置 V2_BACKEND_URL
echo "Setting V2_BACKEND_URL..."
echo "$V2_BACKEND_URL" | pnpm exec wrangler secret put V2_BACKEND_URL

echo ""
echo "✅ 所有环境变量设置完成！"
echo ""
echo "⚠️  请检查以下配置是否正确（如不正确，请修改脚本中的值后重新运行）："
echo "   STABLE_FRONTEND_HOST: $STABLE_FRONTEND_HOST"
echo "   V2_FRONTEND_HOST: $V2_FRONTEND_HOST"
echo "   STABLE_BACKEND_URL: $STABLE_BACKEND_URL"
echo "   V2_BACKEND_URL: $V2_BACKEND_URL"
