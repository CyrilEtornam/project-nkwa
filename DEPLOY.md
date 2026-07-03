# DEPLOY.md — Nkwa on AWS (Lambda + API Gateway, Amplify frontend)

End-to-end guide to deploy the whole project to **your own AWS account** using the
**AWS CLI**. The backend runs on **AWS Lambda** (FastAPI via Mangum); the frontend
stays on **Amplify**. All AWS data services run live (`USE_MOCK=false`).

> Supersedes the EC2 + PM2 instructions in `DEPLOYMENT.md`.

---

## 1. What gets deployed

```
Browser ──HTTPS──> Lambda Function URL ──> Lambda (FastAPI / Mangum)
   │                                          ├── DynamoDB  nkwa-users / nkwa-calls / nkwa-first-aid
Amplify (static frontend)                     ├── S3        nkwa-audio  (call audio + public TTS)
                                              ├── Bedrock   Opus triage + Sonnet first-aid
                                              ├── Transcribe / Polly   (speech in/out)
                                              ├── Location  geo-places reverse geocode
                                              └── Khaya API (external — translation/ASR)
```

| Component | Where | How |
|-----------|-------|-----|
| FastAPI backend | Lambda + Function URL | `infra/` CLI scripts |
| DynamoDB, S3, IAM, Bedrock perms | Your AWS account | `infra/` CLI scripts |
| React/Vite frontend | Amplify | Existing `amplify.yml`, env var change |

**WebSocket:** the `/ws` route isn't served on Lambda, but it's unused today
(`push_event` is a no-op, no client connects), so nothing breaks.

---

## 2. Prerequisites

- **AWS CLI v2**, authenticated to your account:
  ```bash
  aws configure          # or: aws configure sso
  aws sts get-caller-identity   # confirm the right account
  ```
- **python3**, **pip**, **zip** installed locally.
- The repo checked out, on the `aws-lambda-deploy` branch.

---

## 3. One-time manual step: enable Bedrock models

The backend calls Anthropic Claude models on Bedrock. Access requires a
click-through agreement the CLI can't perform:

1. AWS Console → **Bedrock** → **Model access** (region **us-west-2**).
2. Enable the **Anthropic Claude** models.
3. Confirm the exact model ids in [`infra/00-config.sh`](infra/00-config.sh)
   (`BEDROCK_MODEL_ID`, `BEDROCK_FIRST_AID_MODEL_ID`) match models you enabled.
   Override them with env vars if your account exposes different ids:
   ```bash
   export BEDROCK_MODEL_ID="us.anthropic.claude-..."
   export BEDROCK_FIRST_AID_MODEL_ID="us.anthropic.claude-..."
   ```

---

## 4. Deploy the backend + AWS resources

From the repo root:

```bash
export JWT_SECRET="$(openssl rand -hex 32)"     # or reuse your existing secret
export KHAYA_API_KEY="your-khaya-api-key"

./infra/deploy-all.sh
```

This runs, idempotently and in order:

1. **`01-iam.sh`** — Lambda role + least-privilege policy
   (DynamoDB ×3, S3, `bedrock:InvokeModel`, Transcribe, Polly, geo-places, logs).
2. **`02-dynamo.sh`** — three tables, single string PK each, on-demand billing
   (`nkwa-users`/`user_id`, `nkwa-calls`/`call_id`, `nkwa-first-aid`/`guide_id`).
3. **`03-s3.sh`** — `nkwa-audio` with ACLs enabled + public-read allowed + CORS
   (required because `upload_public()` writes `ACL=public-read` TTS audio).
4. **`04-lambda.sh`** — builds the package with Linux/manylinux wheels (so the
   native deps `pydantic-core` and `bcrypt` match the Lambda runtime), zips, and
   creates/updates the function with `USE_MOCK=false` and all env vars.
5. **`05-apigw.sh`** — creates a **Lambda Function URL** and an **HTTP API**.
6. **`06-seed.sh`** — seeds `nkwa-first-aid` from
   `backend/data/first_aid_guides.json`.

At the end it prints both endpoints and writes them to
`infra/.build/endpoints.txt`:

```
FUNCTION_URL=https://xxxx.lambda-url.us-west-2.on.aws
API_GATEWAY_URL=https://yyyy.execute-api.us-west-2.amazonaws.com
```

### Verify

```bash
FN=$(grep FUNCTION_URL infra/.build/endpoints.txt | cut -d= -f2-)
curl "$FN/health"        # -> {"status":"ok", ...}
```

> ⚠️ **Use the Function URL for the app, not API Gateway.**
> `POST /api/v1/calls/initiate` runs transcribe → Bedrock triage → Bedrock
> first-aid → TTS **synchronously** and routinely exceeds **30s**. API Gateway
> HTTP API has a hard 30s integration timeout (→ 504); the Function URL honors
> the full Lambda timeout (set to 120s). API Gateway is fine for the GET routes.

---

## 5. Point the frontend (Amplify) at the backend

1. Copy the `FUNCTION_URL` from the deploy output.
2. Amplify console → your app → **Hosting → Environment variables** →
   set **`VITE_API_BASE_URL`** = that URL (no trailing slash).
3. **Redeploy** the frontend (Amplify → *Redeploy this version*). Vite bakes the
   value in at build time — `frontend/.env` only affects local builds.

Smoke-test from the deployed site: trigger an emergency call and confirm a
`call_id` comes back and audio plays.

---

## 6. Redeploy after changes

**Backend code change:**
```bash
source infra/00-config.sh && bash infra/04-lambda.sh
```

**Frontend change:** push to the branch Amplify tracks (it rebuilds), or
*Redeploy this version* in the console.

---

## 7. Configuration reference

All in [`infra/00-config.sh`](infra/00-config.sh), overridable via env vars:

| Variable | Default | Notes |
|----------|---------|-------|
| `AWS_REGION` | `us-west-2` | Matches Bedrock `us.` inference profiles |
| `LAMBDA_NAME` | `nkwa-backend` | |
| `LAMBDA_TIMEOUT` | `120` | Seconds; covers the heavy `/initiate` chain |
| `LAMBDA_MEMORY` | `1024` | MB |
| `PY_RUNTIME` / `PY_ABI` | `python3.12` / `312` | Lambda runtime + wheel ABI |
| `JWT_SECRET` | **required** | Export before deploying |
| `KHAYA_API_KEY` | **required** | Export before deploying |
| `BEDROCK_MODEL_ID` | Opus profile | Must be enabled in Bedrock |
| `BEDROCK_FIRST_AID_MODEL_ID` | Sonnet profile | Must be enabled in Bedrock |
| `BEDROCK_KB_ENABLED` | `false` | Knowledge Base off (not provisioned here) |

**Not provisioned (by design):** SNS (all `sns_client` functions are no-ops in
code) and a Bedrock Knowledge Base (`BEDROCK_KB_ENABLED=false`). Enable a KB
separately and set `BEDROCK_KB_ID` if you want RAG-backed first-aid retrieval.

`AWS_REGION` is **not** set as a Lambda env var — Lambda injects it automatically
and rejects it as a custom key; the code reads the runtime-provided value.

---

## 8. Cost notes

- DynamoDB on-demand, Lambda, and S3 are near-free at low volume.
- **Bedrock (Opus + Sonnet) is the main cost driver** — billed per token, per call.
- Transcribe and Polly bill per second/character of audio.

---

## 9. Teardown

```bash
source infra/00-config.sh
aws lambda delete-function --function-name "$LAMBDA_NAME"
aws apigatewayv2 delete-api --api-id "$(aws apigatewayv2 get-apis \
  --query "Items[?Name=='$HTTP_API_NAME'].ApiId | [0]" --output text)"
aws dynamodb delete-table --table-name "$USERS_TABLE"
aws dynamodb delete-table --table-name "$CALLS_TABLE"
aws dynamodb delete-table --table-name "$FIRSTAID_TABLE"
aws s3 rb "s3://$S3_BUCKET_NAME" --force
aws iam delete-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME"
aws iam detach-role-policy --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
aws iam delete-role --role-name "$ROLE_NAME"
```

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `AccessDeniedException` on Bedrock | Model access not enabled, or wrong model id — see §3 |
| `/initiate` returns 504 | You're hitting API Gateway — use the Function URL (§4) |
| 500 on import / `No module named pydantic_core...` | Package built with wrong wheels — rerun `04-lambda.sh` (needs the manylinux flags it already sets) |
| TTS audio 403 in browser | S3 public access — rerun `03-s3.sh` |
| CORS error in browser | Confirm `VITE_API_BASE_URL` matches the Function URL exactly (no trailing slash) and redeploy Amplify |
| Frontend still calls localhost | Amplify didn't rebuild after the env var change — *Redeploy this version* |
```
