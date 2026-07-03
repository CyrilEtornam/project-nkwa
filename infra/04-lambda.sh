#!/usr/bin/env bash
# Builds a Lambda deployment package (with Linux/manylinux wheels for the native
# deps: pydantic-core, bcrypt) and creates/updates the function.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/00-config.sh"

BUILD_DIR="$INFRA_DIR/.build"
PKG_DIR="$BUILD_DIR/package"
ZIP_PATH="$BUILD_DIR/$LAMBDA_NAME.zip"

echo "==> Cleaning build dir."
rm -rf "$BUILD_DIR"
mkdir -p "$PKG_DIR"

echo "==> Installing dependencies for $PY_PLATFORM / cp$PY_ABI."
# --only-binary=:all: forces wheels so native deps match the Lambda runtime,
# not the local machine (the host here is Python 3.14 on a different libc).
pip install \
  --platform "$PY_PLATFORM" \
  --implementation cp \
  --python-version "$PY_ABI" \
  --only-binary=:all: \
  --upgrade \
  --target "$PKG_DIR" \
  -r "$BACKEND_DIR/requirements.txt"

echo "==> Copying backend source."
cp "$BACKEND_DIR/main.py" "$PKG_DIR/"
cp -r "$BACKEND_DIR/routers" "$PKG_DIR/"
cp -r "$BACKEND_DIR/shared" "$PKG_DIR/"
cp -r "$BACKEND_DIR/data" "$PKG_DIR/"
# Drop caches to keep the package small.
find "$PKG_DIR" -type d -name '__pycache__' -prune -exec rm -rf {} +

echo "==> Zipping package."
( cd "$PKG_DIR" && zip -qr "$ZIP_PATH" . )
echo "    $(du -h "$ZIP_PATH" | cut -f1) -> $ZIP_PATH"

# Lambda env vars. AWS_REGION is omitted on purpose — Lambda sets it itself and
# rejects it as a custom key. The code reads it via the runtime-provided value.
ENV_FILE="$BUILD_DIR/env.json"
cat > "$ENV_FILE" <<JSON
{
  "Variables": {
    "USE_MOCK": "$USE_MOCK",
    "JWT_SECRET": "$JWT_SECRET",
    "KHAYA_API_KEY": "$KHAYA_API_KEY",
    "S3_BUCKET_NAME": "$S3_BUCKET_NAME",
    "DYNAMO_USERS_TABLE": "$USERS_TABLE",
    "DYNAMO_CALLS_TABLE": "$CALLS_TABLE",
    "DYNAMO_FIRSTAID_TABLE": "$FIRSTAID_TABLE",
    "BEDROCK_MODEL_ID": "$BEDROCK_MODEL_ID",
    "BEDROCK_FIRST_AID_MODEL_ID": "$BEDROCK_FIRST_AID_MODEL_ID",
    "BEDROCK_KB_ENABLED": "$BEDROCK_KB_ENABLED",
    "BEDROCK_KB_ID": "$BEDROCK_KB_ID"
  }
}
JSON

if aws lambda get-function --function-name "$LAMBDA_NAME" >/dev/null 2>&1; then
  echo "==> Updating existing function code."
  aws lambda update-function-code --function-name "$LAMBDA_NAME" \
    --zip-file "fileb://$ZIP_PATH" >/dev/null
  aws lambda wait function-updated --function-name "$LAMBDA_NAME"
  echo "==> Updating function configuration."
  aws lambda update-function-configuration --function-name "$LAMBDA_NAME" \
    --handler main.handler \
    --runtime "$PY_RUNTIME" \
    --timeout "$LAMBDA_TIMEOUT" \
    --memory-size "$LAMBDA_MEMORY" \
    --role "$ROLE_ARN" \
    --environment "file://$ENV_FILE" >/dev/null
  aws lambda wait function-updated --function-name "$LAMBDA_NAME"
else
  echo "==> Creating function $LAMBDA_NAME."
  aws lambda create-function --function-name "$LAMBDA_NAME" \
    --runtime "$PY_RUNTIME" \
    --handler main.handler \
    --architectures "$LAMBDA_ARCH" \
    --timeout "$LAMBDA_TIMEOUT" \
    --memory-size "$LAMBDA_MEMORY" \
    --role "$ROLE_ARN" \
    --environment "file://$ENV_FILE" \
    --zip-file "fileb://$ZIP_PATH" >/dev/null
  aws lambda wait function-active --function-name "$LAMBDA_NAME"
fi

echo "==> Lambda ready: $LAMBDA_NAME"
