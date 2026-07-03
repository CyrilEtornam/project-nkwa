#!/usr/bin/env bash
# Creates the audio bucket. The backend's upload_public() puts objects with
# ACL=public-read (TTS audio that the frontend plays), so ACLs must be ENABLED
# and public ACLs must be allowed — neither is the default for new buckets.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/00-config.sh"

if aws s3api head-bucket --bucket "$S3_BUCKET_NAME" 2>/dev/null; then
  echo "==> Bucket $S3_BUCKET_NAME already exists; reconciling settings."
else
  echo "==> Creating bucket $S3_BUCKET_NAME in $AWS_REGION."
  # us-east-1 must NOT pass a LocationConstraint; every other region must.
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$S3_BUCKET_NAME" >/dev/null
  else
    aws s3api create-bucket --bucket "$S3_BUCKET_NAME" \
      --create-bucket-configuration LocationConstraint="$AWS_REGION" >/dev/null
  fi
fi

# Enable ACLs (default for new buckets is BucketOwnerEnforced, which DISABLES
# ACLs and would make put_object(ACL=public-read) fail).
echo "==> Enabling ACLs (ObjectWriter ownership)."
aws s3api put-bucket-ownership-controls --bucket "$S3_BUCKET_NAME" \
  --ownership-controls 'Rules=[{ObjectOwnership=ObjectWriter}]'

# Allow public ACLs / public objects (keep IAM policy as the real guard).
echo "==> Allowing public-read objects."
aws s3api put-public-access-block --bucket "$S3_BUCKET_NAME" \
  --public-access-block-configuration \
  BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false

# CORS so the browser can fetch/play the audio from the Amplify-hosted frontend.
echo "==> Applying CORS."
aws s3api put-bucket-cors --bucket "$S3_BUCKET_NAME" --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}'

echo "==> S3 ready: s3://$S3_BUCKET_NAME"
