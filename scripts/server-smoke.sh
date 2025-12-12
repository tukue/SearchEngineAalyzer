#!/bin/bash
set -euo pipefail

PORT=5000
LOG_FILE="/tmp/server-smoke.log"

npm run build >/dev/null 2>&1

npm run start >/tmp/server-smoke.log 2>&1 &
SERVER_PID=$!
trap "kill ${SERVER_PID} 2>/dev/null || true" EXIT

for i in {1..30}; do
  if nc -z localhost "$PORT" 2>/dev/null; then
    break
  fi
  sleep 1
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server exited unexpectedly during startup. Logs:" >&2
    tail -n 50 "$LOG_FILE" >&2 || true
    exit 1
  fi
  if [ "$i" -eq 30 ]; then
    echo "Server failed to start on port $PORT" >&2
    tail -n 50 "$LOG_FILE" >&2 || true
    exit 1
  fi
done

echo "Verifying health endpoint..."
curl -fsS "http://localhost:${PORT}/api/health" >/dev/null

echo "Verifying homepage renders HTML..."
HOME_HTML=$(curl -fsS "http://localhost:${PORT}/")
echo "$HOME_HTML" | grep -qi "<!doctype html>"
echo "$HOME_HTML" | grep -qi "id=\"root\""
echo "$HOME_HTML" | grep -qv "import express" || (echo "Root response appears to contain server source" >&2 && exit 1)

echo "Smoke test succeeded."
