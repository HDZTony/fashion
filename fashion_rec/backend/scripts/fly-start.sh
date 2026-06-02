#!/bin/sh
# Start Tailscale (userspace, Fly-compatible) then FastAPI.
# Do not use set -e before Tailscale: API must stay up if tailnet join fails.

# Official Fly.io name: TAILSCALE_AUTHKEY (see tailscale.com/docs/install/cloud/flydotio)
TS_KEY="${TAILSCALE_AUTHKEY:-${TS_AUTHKEY:-${TS_AUTH_KEY:-}}}"
if [ -n "$TS_KEY" ]; then
  echo "[fly-start] Starting Tailscale..."
  mkdir -p /var/run/tailscale /var/lib/tailscale
  # userspace 模式需 SOCKS5，否则容器内普通 HTTP 不会走 tailnet
  tailscaled --tun=userspace-networking \
    --socks5-server=127.0.0.1:1055 \
    --state=/var/lib/tailscale/tailscaled.state &
  sleep 3
  export ALL_PROXY="socks5://127.0.0.1:1055/"
  export HTTP_PROXY="socks5://127.0.0.1:1055/"
  export HTTPS_PROXY="socks5://127.0.0.1:1055/"
  TS_HOST="${TS_HOSTNAME:-fashion-rec-backend-fly}"
  # shellcheck disable=SC2086
  if tailscale up --auth-key="$TS_KEY" --hostname="$TS_HOST" --accept-routes ${TS_EXTRA_ARGS:-}; then
    echo "[fly-start] Tailscale IPv4: $(tailscale ip -4 2>/dev/null || echo n/a)"
  else
    echo "[fly-start] WARN: tailscale up failed; LocateAnything may be unreachable"
  fi
else
  echo "[fly-start] TAILSCALE_AUTHKEY not set; skipping Tailscale"
fi
exec python -m uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1 \
  --log-level info \
  --timeout-keep-alive 300 \
  --timeout-graceful-shutdown 30 \
  --access-log
