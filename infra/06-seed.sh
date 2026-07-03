#!/usr/bin/env bash
# Seeds the nkwa-first-aid table from backend/data/first_aid_guides.json by
# running the project's own seed script against real DynamoDB. Uses a throwaway
# venv so it doesn't depend on how the backend is set up locally.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/00-config.sh"

VENV="$INFRA_DIR/.build/seed-venv"
if [[ ! -d "$VENV" ]]; then
  echo "==> Creating seed venv."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip boto3
fi

echo "==> Seeding $FIRSTAID_TABLE via backend/scripts/seed_first_aid.py."
cd "$BACKEND_DIR"
USE_MOCK=false \
AWS_REGION="$AWS_REGION" \
DYNAMO_FIRSTAID_TABLE="$FIRSTAID_TABLE" \
"$VENV/bin/python" scripts/seed_first_aid.py

echo "==> Seed complete."
