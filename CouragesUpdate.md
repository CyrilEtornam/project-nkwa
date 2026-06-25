# Bedrock Knowledge Base Backend Briefing

## Summary

Implemented the Bedrock and Knowledge Base backend upgrade for the Nkwa emergency call pipeline. The backend now separates emergency triage from first-aid guidance:

- Claude Opus handles high-stakes triage.
- Bedrock Knowledge Base retrieves approved first-aid guide evidence.
- Claude Sonnet generates grounded English first-aid instructions from retrieved or local fallback guide content.
- Khaya translates the final first-aid instructions for local languages before TTS.

The public API shape remains unchanged. The caller app can keep using `POST /api/v1/calls/initiate` and then `GET /api/v1/calls/{call_id}`.

## Previous State

Before this work, Bedrock usage was concentrated in `backend/shared/bedrock_client.py`.

The old flow:

- Used one Bedrock model call for everything.
- The default model was `us.anthropic.claude-sonnet-4-6`.
- The system prompt embedded first-aid protocols directly inside the prompt.
- Bedrock returned triage fields and first-aid instructions in the same JSON object.
- Output validation was limited to `json.loads()`.
- If parsing failed, the backend retried once with a simpler prompt.
- There was no Bedrock Knowledge Base.
- There was no second model for first-aid/health guidance.
- There was no source metadata, citation-style audit trail, or KB fallback handling.
- The boto3 Bedrock client was created at import time, which made mock mode and tests more fragile.

That was enough for a demo, but it put too much responsibility on one prompt. In an emergency product, that is risky because triage, medical guidance, and translation each need clearer boundaries.

## Why We Changed It

The new design reduces risk and makes the backend easier to reason about.

- Triage is now focused on dispatch decisions only.
- First-aid guidance is grounded in approved guide content instead of whatever the model remembers.
- The Knowledge Base gives us a path to add better health and safety documents without rewriting prompts.
- Local fallback keeps the emergency pipeline working even if KB retrieval fails.
- Pydantic validation prevents malformed or out-of-contract model output from silently entering the pipeline.
- Lazy AWS clients keep local mock mode clean and avoid unnecessary credential lookups during tests.
- Khaya remains the source of truth for Ghanaian language translation and speech, which is better than asking Bedrock to freestyle Twi, Ga, or Ewe.

## What Changed

Rebuilt `backend/shared/bedrock_client.py` around:

- Opus triage with `BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-6-v1`.
- Lazy `bedrock-runtime` and `bedrock-agent-runtime` clients.
- Strict JSON parsing with a repair retry.
- Pydantic validation for triage and first-aid outputs.
- Bedrock Knowledge Base retrieval through `bedrock-agent-runtime.retrieve`.
- Local fallback to `backend/data/first_aid_guides.json`.
- Sonnet first-aid generation using `BEDROCK_FIRST_AID_MODEL_ID=us.anthropic.claude-sonnet-4-6`.
- Optional fast model env var: `BEDROCK_FIRST_AID_FAST_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0`.

Updated `backend/routers/calls.py` so:

- Prank calls stop after triage and are saved as prank records.
- Real calls start location resolution and first-aid generation concurrently.
- First-aid guidance is translated through Khaya when the caller language is not English.
- TTS uses the translated script for local languages.
- DynamoDB records now include audit fields:
  - `triage_model_id`
  - `first_aid_model_id`
  - `knowledge_source`
  - `knowledge_source_ids`
  - `kb_result_scores`
  - `source_confidence`

Added Pydantic contracts in `backend/shared/models.py`:

- `TriageDecision`
- `KnowledgeSnippet`
- `FirstAidGuidance`

Fixed Khaya translation handling in `backend/shared/khaya_client.py`:

- `en -> eng`
- `tw -> twi`
- `ee -> ewe`
- `gaa -> gaa`
- Supports language pairs like `eng-twi`, `eng-ewe`, and `eng-gaa`.

Added scripts:

- `backend/scripts/export_kb_guides.py`
  - Exports `backend/data/first_aid_guides.json` into Markdown plus metadata files for Bedrock Knowledge Base ingestion.
- `backend/scripts/smoke_bedrock.py`
  - Opt-in live smoke test for Bedrock triage, KB retrieval, and first-aid generation only.
  - Does not call Khaya, S3 audio upload, DynamoDB, Location, or SNS.

Updated documentation:

- `backend/README.md`
- `DEPLOYMENT.md`

Replaced stale tests and added Bedrock/Khaya unit coverage.

## Current Backend Flow

1. Receive audio, service type, caller language, and GPS through `POST /api/v1/calls/initiate`.
2. Upload incoming audio to S3.
3. Transcribe audio through Khaya or Amazon Transcribe.
4. Translate transcript to English when needed.
5. Send English transcript to Claude Opus for triage.
6. If prank, save a prank record and return early.
7. If not prank, retrieve relevant first-aid snippets from Bedrock Knowledge Base.
8. If KB retrieval is unavailable or weak, use the local approved first-aid guide fallback.
9. Send retrieved or fallback guide snippets to Claude Sonnet for grounded English first-aid guidance.
10. Translate the English first-aid guidance through Khaya for local languages.
11. Generate first-aid audio through Khaya TTS or Amazon Polly.
12. Resolve GPS through AWS Location.
13. Save the full call record to DynamoDB.
14. Return the existing response shape with `call_id`, `status`, and `first_aid_audio_url`.

## Environment Variables

Recommended backend Bedrock variables:

```env
AWS_REGION=us-west-2
BEDROCK_MODEL_ID=us.anthropic.claude-opus-4-6-v1
BEDROCK_FIRST_AID_MODEL_ID=us.anthropic.claude-sonnet-4-6
BEDROCK_FIRST_AID_FAST_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0
BEDROCK_KB_ENABLED=false
BEDROCK_KB_ID=
BEDROCK_KB_NUMBER_OF_RESULTS=3
```

Set `BEDROCK_KB_ENABLED=true` only after the Knowledge Base exists, has a synced data source, and the backend role has permission to retrieve from it.

## Knowledge Base Setup Notes

The backend code expects a Bedrock Knowledge Base to already exist. It does not provision the KB.

Recommended setup:

1. Run the export script to generate Markdown guide documents.
2. Upload the generated files to the S3 bucket used as the KB data source.
3. Create or configure the Bedrock Managed Knowledge Base in AWS Console.
4. Sync the data source.
5. Copy the Knowledge Base ID into `BEDROCK_KB_ID`.
6. Set `BEDROCK_KB_ENABLED=true`.

The backend will still work without the live KB because it falls back to `backend/data/first_aid_guides.json`.

## Terminal Guide

Run these commands from the project root unless stated otherwise.

### 1. Backend Mock Test Suite

PowerShell:

```powershell
cd backend
$env:USE_MOCK = "true"
$env:AWS_EC2_METADATA_DISABLED = "true"
python -m unittest discover -s tests
```

Expected result:

```text
Ran 9 tests
OK
```

### 2. Backend Compile Check

PowerShell:

```powershell
cd backend
python -m compileall -q .
```

No output means the compile check passed.

### 3. Git Diff Whitespace Check

PowerShell:

```powershell
git diff --check
```

Normal CRLF warnings on Windows are acceptable. Real trailing-whitespace or conflict-marker errors should be fixed.

### 4. Export First-Aid Guides for Bedrock Knowledge Base

PowerShell:

```powershell
cd backend
python scripts/export_kb_guides.py
```

Generated output:

```text
backend/kb_export/first_aid_guides/
```

Upload those generated `.md` and `.metadata.json` files to the S3 data source configured for the Bedrock Knowledge Base.

Example AWS CLI command:

```powershell
aws s3 sync .\kb_export\first_aid_guides s3://YOUR-KB-DATASOURCE-BUCKET/first_aid_guides/
```

Replace `YOUR-KB-DATASOURCE-BUCKET` with the actual S3 bucket connected to the Bedrock Knowledge Base.

### 5. Run Backend Locally in Mock Mode

PowerShell:

```powershell
cd backend
$env:USE_MOCK = "true"
$env:JWT_SECRET = "local-dev-secret"
$env:AWS_REGION = "us-west-2"
$env:AWS_EC2_METADATA_DISABLED = "true"
uvicorn main:app --reload --port 8000
```

Health check:

```powershell
curl http://localhost:8000/health
```

### 6. Live Bedrock Smoke Test

Only run this when AWS credentials, model access, region, and optional KB env vars are ready.

PowerShell:

```powershell
cd backend
$env:USE_MOCK = "false"
$env:AWS_REGION = "us-west-2"
$env:BEDROCK_MODEL_ID = "us.anthropic.claude-opus-4-6-v1"
$env:BEDROCK_FIRST_AID_MODEL_ID = "us.anthropic.claude-sonnet-4-6"
$env:BEDROCK_KB_ENABLED = "false"
python scripts/smoke_bedrock.py
```

With a live Knowledge Base:

```powershell
cd backend
$env:USE_MOCK = "false"
$env:AWS_REGION = "us-west-2"
$env:BEDROCK_MODEL_ID = "us.anthropic.claude-opus-4-6-v1"
$env:BEDROCK_FIRST_AID_MODEL_ID = "us.anthropic.claude-sonnet-4-6"
$env:BEDROCK_KB_ENABLED = "true"
$env:BEDROCK_KB_ID = "YOUR_KNOWLEDGE_BASE_ID"
$env:BEDROCK_KB_NUMBER_OF_RESULTS = "3"
python scripts/smoke_bedrock.py
```

This smoke test checks only:

- Opus triage
- Knowledge retrieval or local fallback
- Sonnet first-aid guidance

It does not write to DynamoDB and does not call Khaya, S3 audio upload, AWS Location, or SNS.

## Verification Already Run

These checks were run successfully:

```powershell
cd backend
$env:USE_MOCK = "true"
$env:AWS_EC2_METADATA_DISABLED = "true"
python -m unittest discover -s tests
```

Result:

```text
Ran 9 tests
OK
```

Compile check:

```powershell
cd backend
python -m compileall -q .
```

Result: passed.

Whitespace check:

```powershell
git diff --check
```

Result: passed except normal Windows CRLF warnings.

## Important Notes

- The Knowledge Base must be created and synced in AWS before setting `BEDROCK_KB_ENABLED=true`.
- If KB retrieval fails, the backend falls back to local first-aid guide data.
- The live smoke script is intentionally separate from the full call pipeline so Bedrock can be verified without burning Khaya calls or writing records.
- The public frontend contract was preserved.
- Auth, contacts, SOS, SNS sending, and WebSocket broadcasting remain bypassed as before.
