#!/usr/bin/env bash
# Creates the three DynamoDB tables the backend uses. Each has a single
# string partition key (no sort keys / GSIs — confirmed from the router code).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/00-config.sh"

create_table() {
  local table="$1" pk="$2"
  if aws dynamodb describe-table --table-name "$table" >/dev/null 2>&1; then
    echo "==> Table $table already exists; skipping."
    return
  fi
  echo "==> Creating table $table (PK: $pk)."
  aws dynamodb create-table \
    --table-name "$table" \
    --attribute-definitions AttributeName="$pk",AttributeType=S \
    --key-schema AttributeName="$pk",KeyType=HASH \
    --billing-mode PAY_PER_REQUEST >/dev/null
}

create_table "$USERS_TABLE"    user_id
create_table "$CALLS_TABLE"    call_id
create_table "$FIRSTAID_TABLE" guide_id

echo "==> Waiting for tables to become ACTIVE..."
for t in "$USERS_TABLE" "$CALLS_TABLE" "$FIRSTAID_TABLE"; do
  aws dynamodb wait table-exists --table-name "$t"
  echo "    $t ACTIVE"
done
echo "==> DynamoDB ready."
