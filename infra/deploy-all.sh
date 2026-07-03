#!/usr/bin/env bash
# One-shot deploy: IAM -> DynamoDB -> S3 -> Lambda -> HTTP API/Function URL -> seed.
# Re-runnable: every step is idempotent. Run from anywhere.
#
#   export JWT_SECRET=...        # required
#   export KHAYA_API_KEY=...     # required
#   ./infra/deploy-all.sh
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$DIR/01-iam.sh"
echo "==> Pausing 10s for IAM propagation before Lambda create..."
sleep 10
bash "$DIR/02-dynamo.sh"
bash "$DIR/03-s3.sh"
bash "$DIR/04-lambda.sh"
bash "$DIR/05-apigw.sh"
bash "$DIR/06-seed.sh"

echo
echo "============================================================"
echo " Deploy complete. Endpoints:"
cat "$DIR/.build/endpoints.txt"
echo "============================================================"
echo " Next: set VITE_API_BASE_URL in Amplify to the FUNCTION_URL"
echo " and redeploy the frontend. See infra/README.md."
