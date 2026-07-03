#!/usr/bin/env bash
# Exposes the Lambda over HTTPS two ways:
#   1. A Lambda Function URL  -> RECOMMENDED entrypoint. Honors the Lambda
#      timeout (up to 15 min), so the long /initiate chain works.
#   2. An API Gateway HTTP API -> requested stack, but it has a HARD 30s
#      integration timeout, so /initiate will often 504. Kept for completeness.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/00-config.sh"

LAMBDA_ARN="$(aws lambda get-function --function-name "$LAMBDA_NAME" \
  --query 'Configuration.FunctionArn' --output text)"

# ---- 1. Lambda Function URL -------------------------------------------------
echo "==> Configuring Lambda Function URL (AuthType NONE)."
CORS='{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"],"MaxAge":3000}'
if aws lambda get-function-url-config --function-name "$LAMBDA_NAME" >/dev/null 2>&1; then
  aws lambda update-function-url-config --function-name "$LAMBDA_NAME" \
    --auth-type NONE --cors "$CORS" >/dev/null
else
  aws lambda create-function-url-config --function-name "$LAMBDA_NAME" \
    --auth-type NONE --cors "$CORS" >/dev/null
fi
# Public invoke permission for the Function URL (idempotent).
aws lambda add-permission --function-name "$LAMBDA_NAME" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE >/dev/null 2>&1 || true

FUNCTION_URL="$(aws lambda get-function-url-config --function-name "$LAMBDA_NAME" \
  --query 'FunctionUrl' --output text)"
FUNCTION_URL="${FUNCTION_URL%/}"   # strip trailing slash

# ---- 2. API Gateway HTTP API ------------------------------------------------
echo "==> Creating/locating HTTP API $HTTP_API_NAME."
API_ID="$(aws apigatewayv2 get-apis \
  --query "Items[?Name=='$HTTP_API_NAME'].ApiId | [0]" --output text)"

if [[ "$API_ID" == "None" || -z "$API_ID" ]]; then
  API_ID="$(aws apigatewayv2 create-api \
    --name "$HTTP_API_NAME" \
    --protocol-type HTTP \
    --target "$LAMBDA_ARN" \
    --query 'ApiId' --output text)"
  echo "    created API $API_ID (auto \$default route + stage)."
else
  echo "    API already exists: $API_ID"
fi

# Permission for API Gateway to invoke the function (idempotent).
aws lambda add-permission --function-name "$LAMBDA_NAME" \
  --statement-id apigw-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${AWS_REGION}:${ACCOUNT_ID}:${API_ID}/*/*" \
  >/dev/null 2>&1 || true

API_URL="$(aws apigatewayv2 get-api --api-id "$API_ID" \
  --query 'ApiEndpoint' --output text)"

# ---- Output -----------------------------------------------------------------
OUT="$INFRA_DIR/.build/endpoints.txt"
mkdir -p "$INFRA_DIR/.build"
{
  echo "FUNCTION_URL=$FUNCTION_URL"
  echo "API_GATEWAY_URL=$API_URL"
} > "$OUT"

cat <<EOF

==> Endpoints ready (also saved to $OUT):

  RECOMMENDED (no 30s cap, use this for the frontend):
    $FUNCTION_URL

  API Gateway HTTP API (30s timeout — /initiate may 504):
    $API_URL

  Set Amplify env var:  VITE_API_BASE_URL = $FUNCTION_URL
  Health check:         curl $FUNCTION_URL/health
EOF
