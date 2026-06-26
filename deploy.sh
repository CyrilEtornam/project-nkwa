#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh
# Run from anywhere on the EC2 instance. Pulls latest code and restarts uvicorn.

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
ENV_FILE="$REPO_DIR/.env"
LOG_FILE="$REPO_DIR/backend/uvicorn.log"

echo "==> Pulling latest code..."
git -C "$REPO_DIR" pull --ff-only

echo "==> Loading environment..."
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "==> Stopping existing uvicorn..."
pkill -f "uvicorn main:app" || true
sleep 1

# Hard-kill if still alive
if pgrep -f "uvicorn main:app" > /dev/null; then
  pkill -9 -f "uvicorn main:app" || true
  sleep 1
fi

echo "==> Starting uvicorn..."
cd "$BACKEND_DIR"
source .venv/bin/activate
nohup env $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs) \
  uvicorn main:app --host 0.0.0.0 --port 8000 >> "$LOG_FILE" 2>&1 &

sleep 2
if pgrep -f "uvicorn main:app" > /dev/null; then
  echo "==> Server running (PID $(pgrep -f 'uvicorn main:app')). Logs: $LOG_FILE"
else
  echo "ERROR: uvicorn did not start. Check $LOG_FILE" >&2
  tail -20 "$LOG_FILE"
  exit 1
fi
