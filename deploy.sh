#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy.sh
# Run from anywhere on the EC2 instance. Pulls latest code and restarts via PM2.

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$REPO_DIR/.env"

echo "==> Pulling latest code..."
git -C "$REPO_DIR" pull --ff-only

echo "==> Loading environment..."
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

echo "==> Restarting via PM2..."
pm2 restart nkwa --update-env
pm2 save

echo "==> Done. KHAYA key in process: $(pm2 env 0 | grep KHAYA_API_KEY)"
