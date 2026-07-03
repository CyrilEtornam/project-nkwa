#!/usr/bin/env bash
# Shared configuration sourced by every infra script.
# Edit values here (or override via environment) before running deploy-all.sh.
set -euo pipefail

# ---- Region & account -------------------------------------------------------
# AWS_REGION matches backend defaults and the Bedrock "us." inference profiles.
export AWS_REGION="${AWS_REGION:-us-west-2}"
export AWS_DEFAULT_REGION="$AWS_REGION"

# Resolved automatically from the active CLI credentials.
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
export ACCOUNT_ID

# ---- Resource names ---------------------------------------------------------
export PROJECT="nkwa"
export LAMBDA_NAME="${LAMBDA_NAME:-nkwa-backend}"
export ROLE_NAME="${ROLE_NAME:-nkwa-lambda-role}"
export POLICY_NAME="${POLICY_NAME:-nkwa-lambda-policy}"
export HTTP_API_NAME="${HTTP_API_NAME:-nkwa-http-api}"

export USERS_TABLE="${DYNAMO_USERS_TABLE:-nkwa-users}"
export CALLS_TABLE="${DYNAMO_CALLS_TABLE:-nkwa-calls}"
export FIRSTAID_TABLE="${DYNAMO_FIRSTAID_TABLE:-nkwa-first-aid}"
export S3_BUCKET_NAME="${S3_BUCKET_NAME:-nkwa-audio}"

# ---- Lambda runtime ---------------------------------------------------------
export PY_RUNTIME="${PY_RUNTIME:-python3.12}"
export PY_PLATFORM="${PY_PLATFORM:-manylinux2014_x86_64}"
export PY_ABI="${PY_ABI:-312}"
export LAMBDA_ARCH="${LAMBDA_ARCH:-x86_64}"
export LAMBDA_TIMEOUT="${LAMBDA_TIMEOUT:-120}"   # seconds; heavy /initiate chain
export LAMBDA_MEMORY="${LAMBDA_MEMORY:-1024}"    # MB

# ---- Application secrets / config (Lambda env vars) -------------------------
# NOTE: Lambda injects AWS_REGION automatically — it must NOT be set as a custom
# env var, so it is intentionally excluded from the variables map in 04-lambda.sh.
export USE_MOCK="false"
export JWT_SECRET="${JWT_SECRET:?Set JWT_SECRET (e.g. export JWT_SECRET=...) before deploying}"
export KHAYA_API_KEY="${KHAYA_API_KEY:?Set KHAYA_API_KEY before deploying}"

# Bedrock model ids (defaults mirror backend/shared/bedrock_client.py).
export BEDROCK_MODEL_ID="${BEDROCK_MODEL_ID:-us.anthropic.claude-opus-4-6-v1}"
export BEDROCK_FIRST_AID_MODEL_ID="${BEDROCK_FIRST_AID_MODEL_ID:-us.anthropic.claude-sonnet-4-6}"
# Knowledge Base is OFF by default (matches code). Set to true + provide a KB id
# only after you have built a Bedrock Knowledge Base (not provisioned here).
export BEDROCK_KB_ENABLED="${BEDROCK_KB_ENABLED:-false}"
export BEDROCK_KB_ID="${BEDROCK_KB_ID:-}"

# ---- Derived ----------------------------------------------------------------
export ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# Directory of this script, so paths work from anywhere.
INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export INFRA_DIR
export BACKEND_DIR="$(cd "$INFRA_DIR/../backend" && pwd)"

echo "Config loaded: region=$AWS_REGION account=$ACCOUNT_ID lambda=$LAMBDA_NAME"
