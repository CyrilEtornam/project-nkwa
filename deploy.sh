#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh
# Run from anywhere on the EC2 instance. Pulls latest code and restarts uvicorn.

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$REPO_DIR/backend"
ENV_FILE="$REPO_DIR/.env"
LOG_FILE="$BACKEND_DIR/uvicorn.log"

echo "==> Pulling latest code..."
git -C "$REPO_DIR" pull --ff-only

echo "==> Loading environment..."
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "==> Stopping existing uvicorn..."
sudo kill -9 "$(sudo lsof -ti:8000)" 2>/dev/null || true
sleep 2

echo "==> Starting uvicorn..."
cd "$BACKEND_DIR"
source .env/bin/activate

nohup uvicorn main:app --host 0.0.0.0 --port 8000 >> "$LOG_FILE" 2>&1 &

sleep 3
if pgrep -f "uvicorn main:app" > /dev/null; then
  echo "==> Server running (PID $(pgrep -f 'uvicorn main:app')). Logs: $LOG_FILE"
  echo "==> KHAYA_API_KEY in process: $(sudo cat /proc/$(pgrep -f 'uvicorn main:app' | head -1)/environ | tr '\0' '\n' | grep KHAYA_API_KEY | cut -c1-35)"
else
  echo "ERROR: uvicorn did not start. Check $LOG_FILE" >&2
  tail -20 "$LOG_FILE"
  exit 1
fi
