#!/bin/sh
# Dockerfile normalizes this entrypoint to LF before execution.
set -eu

RELAY_PID=""
API_PID=""

shutdown() {
  if [ -n "$RELAY_PID" ]; then
    kill "$RELAY_PID" 2>/dev/null || true
  fi
  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}

trap shutdown INT TERM

/iroh-relay --dev --config-path /config/iroh-relay.toml &
RELAY_PID=$!

python -m uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 1 \
  --log-level info \
  --timeout-keep-alive 300 \
  --timeout-graceful-shutdown 30 \
  --access-log &
API_PID=$!

while kill -0 "$RELAY_PID" 2>/dev/null && kill -0 "$API_PID" 2>/dev/null; do
  sleep 1
done

echo "fly-start: iroh-relay or FastAPI exited; shutting down" >&2
shutdown
wait || true
exit 1
