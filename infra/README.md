# Nkwa — AWS deployment (Lambda + API Gateway, real integrations)

Provisions the backend on **AWS Lambda** and all the AWS resources it needs,
via the **AWS CLI**. The frontend stays on **Amplify** (only its API URL changes).

## Architecture

```
Browser ──HTTPS──> Lambda Function URL ──> Lambda (FastAPI via Mangum)
   │                                          ├── DynamoDB: nkwa-users / nkwa-calls / nkwa-first-aid
Amplify (static)                              ├── S3: nkwa-audio (call audio + public TTS)
                                              ├── Bedrock: Opus triage + Sonnet first-aid
                                              ├── Transcribe / Polly (speech)
                                              ├── Amazon Location (geo-places reverse geocode)
                                              └── Khaya API (external — translation/ASR)
```

> **WebSocket note:** the backend's `/ws` route is not served on Lambda, but it's
> currently unused (`push_event` is a no-op and no client connects), so nothing breaks.

## Prerequisites

- AWS CLI v2, authenticated to **your** account (`aws configure` / SSO).
- `python3`, `pip`, and `zip` on your machine.
- Run from the repo root or `infra/`.

## ⚠️ Two things you must know

1. **Bedrock model access (manual, one-time).** Enable access to the Anthropic
   Claude models in the **Bedrock console → Model access** for region
   `us-west-2`. This requires an click-through agreement that the CLI can't do.
   The model ids are in `00-config.sh` (`BEDROCK_MODEL_ID`,
   `BEDROCK_FIRST_AID_MODEL_ID`) — they must match models you've enabled.

2. **API Gateway 30s timeout.** `POST /api/v1/calls/initiate` does all its work
   synchronously (transcribe → Bedrock triage → Bedrock first-aid → TTS) and
   regularly exceeds 30s. API Gateway HTTP API caps integrations at **30s**, so
   that endpoint will 504 there. The deploy therefore also creates a **Lambda
   Function URL** (honors the full Lambda timeout) — **point the frontend at the
   Function URL.** The API Gateway is created too, for the lighter GET endpoints.

## Deploy

```bash
export JWT_SECRET="$(openssl rand -hex 32)"   # or reuse your existing secret
export KHAYA_API_KEY="your-khaya-key"

./infra/deploy-all.sh
```

That runs, idempotently and in order:

| Script | Creates |
|--------|---------|
| `01-iam.sh`    | Lambda role + least-privilege policy (Dynamo, S3, Bedrock, Transcribe, Polly, geo-places, logs) |
| `02-dynamo.sh` | 3 DynamoDB tables (single PK each, on-demand billing) |
| `03-s3.sh`     | `nkwa-audio` bucket with ACLs enabled + public-read allowed + CORS |
| `04-lambda.sh` | Builds the package (Linux wheels for pydantic/bcrypt) and creates the function with `USE_MOCK=false` |
| `05-apigw.sh`  | Lambda Function URL **and** HTTP API; prints both URLs |
| `06-seed.sh`   | Seeds `nkwa-first-aid` from `backend/data/first_aid_guides.json` |

Endpoints are printed at the end and saved to `infra/.build/endpoints.txt`.

Verify:

```bash
curl "$(grep FUNCTION_URL infra/.build/endpoints.txt | cut -d= -f2-)/health"
# {"status":"ok",...}
```

## Point Amplify at the backend

1. Copy the `FUNCTION_URL` from the deploy output.
2. Amplify console → your app → **Hosting → Environment variables** →
   set `VITE_API_BASE_URL` = that URL (no trailing slash).
3. **Redeploy** the frontend (Amplify → Redeploy this version) so Vite bakes the
   new value into the build. `frontend/.env` is only used for local builds.

## Re-deploying after code changes

Just rerun the Lambda step:

```bash
source infra/00-config.sh && bash infra/04-lambda.sh
```

## Configuration

All names, region, runtime, timeout, memory, and Bedrock model ids live in
`00-config.sh` and can be overridden via environment variables before deploying.

## Cost notes

- DynamoDB on-demand + Lambda + S3 are near-free at low volume.
- **Bedrock (Opus/Sonnet) is the real cost driver** — billed per token per call.
- Transcribe and Polly bill per second/character of audio.

## Teardown (manual)

```bash
source infra/00-config.sh
aws lambda delete-function --function-name "$LAMBDA_NAME"
aws apigatewayv2 delete-api --api-id "$(aws apigatewayv2 get-apis --query "Items[?Name=='$HTTP_API_NAME'].ApiId | [0]" --output text)"
aws dynamodb delete-table --table-name "$USERS_TABLE"
aws dynamodb delete-table --table-name "$CALLS_TABLE"
aws dynamodb delete-table --table-name "$FIRSTAID_TABLE"
aws s3 rb "s3://$S3_BUCKET_NAME" --force
aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME"
aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name "$ROLE_NAME"
```
