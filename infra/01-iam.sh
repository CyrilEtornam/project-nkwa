#!/usr/bin/env bash
# Creates the Lambda execution role and attaches a least-privilege policy
# covering exactly the AWS services the backend touches when USE_MOCK=false.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/00-config.sh"

TRUST='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "==> Role $ROLE_NAME already exists; updating trust policy."
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" \
    --policy-document "$TRUST"
else
  echo "==> Creating role $ROLE_NAME."
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST" >/dev/null
fi

# CloudWatch Logs for Lambda.
aws iam attach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
        "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/${USERS_TABLE}",
        "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/${CALLS_TABLE}",
        "arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/${FIRSTAID_TABLE}"
      ]
    },
    {
      "Sid": "S3Audio",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:PutObjectAcl"],
      "Resource": "arn:aws:s3:::${S3_BUCKET_NAME}/*"
    },
    {
      "Sid": "BedrockInvoke",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:Retrieve"],
      "Resource": "*"
    },
    {
      "Sid": "Transcribe",
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Polly",
      "Effect": "Allow",
      "Action": ["polly:SynthesizeSpeech"],
      "Resource": "*"
    },
    {
      "Sid": "GeoPlaces",
      "Effect": "Allow",
      "Action": ["geo-places:ReverseGeocode", "geo-places:Geocode"],
      "Resource": "*"
    }
  ]
}
JSON
)

echo "==> Attaching inline policy $POLICY_NAME."
aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "$POLICY"

echo "==> IAM ready: $ROLE_ARN"
echo "    (IAM is eventually consistent — Lambda creation may need a few seconds.)"
