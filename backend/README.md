# Nkwa Backend

FastAPI server for the Nkwa 112 emergency dispatch system. Receives an audio clip and GPS coordinates from the caller, runs a 20-step processing pipeline, and returns a structured triage result with first-aid audio.

---

## Directory structure

```
backend/
├── main.py               # App entry point — registers routers, WebSocket, CORS
├── requirements.txt
├── routers/
│   ├── auth.py           # BYPASSED — returns stub token on every call
│   ├── calls.py          # Core pipeline: POST /calls/initiate + CRUD endpoints
│   ├── contacts.py       # BYPASSED — returns 503
│   ├── first_aid.py      # Returns first-aid guides from DynamoDB
│   ├── sos.py            # BYPASSED — returns 503
│   └── users.py          # BYPASSED — returns stub profile
├── shared/
│   ├── models.py         # All Pydantic request/response models
│   ├── auth_utils.py     # BYPASSED — get_current_user() returns mock dispatcher
│   ├── bedrock_client.py # Bedrock Claude triage (mock-aware)
│   ├── dynamo_client.py  # DynamoDB get/put/update/scan helpers
│   ├── khaya_client.py   # Khaya ASR, translation, TTS (mock-aware)
│   ├── location_client.py# AWS Location GPS → landmark (mock-aware)
│   ├── s3_client.py      # S3 upload helpers (mock-aware)
│   ├── sns_client.py     # BYPASSED — all send functions are no-ops
│   └── ws_manager.py     # WebSocket manager — push_event() BYPASSED (no broadcast)
├── scripts/
│   └── seed_first_aid.py # One-time seeder for the nkwa-first-aid DynamoDB table
└── tests/
    └── test_main.py      # Stale — written against old stubs, needs rewrite
```

---

## Mock mode vs production mode

The server has two modes controlled by the `USE_MOCK` environment variable.

**`USE_MOCK=true` (default)** — all external service calls (Khaya, Bedrock, AWS Location, S3, DynamoDB) are intercepted and return realistic hardcoded responses. No credentials or internet connection needed. Useful for frontend development and CI.

**`USE_MOCK=false`** — all calls go to real AWS services. Requires a Khaya API key, AWS credentials, and all five DynamoDB tables to exist.

---

## Local setup (mock mode)

```bash
cd backend

python3.11 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

# The server reads .env from the project root (one level up)
cat > ../.env << 'EOF'
USE_MOCK=true
JWT_SECRET=local-dev-secret
AWS_REGION=us-west-2
EOF

USE_MOCK=true JWT_SECRET=local-dev-secret uvicorn main:app --reload --port 8000
```

Health check: `curl http://localhost:8000/health`
Interactive docs: `http://localhost:8000/docs`

---

## The call pipeline (`POST /api/v1/calls/initiate`)

This is the active core of the system. The request body:

```json
{
  "service_type": "AMBULANCE",
  "language": "tw",
  "gps_lat": 5.6037,
  "gps_lon": -0.1870,
  "audio_base64": "<base64-encoded audio>"
}
```

Accepted language codes: `en`, `tw`, `gaa`, `ee`
Accepted service types: `AMBULANCE`, `FIRE`, `POLICE`

Steps that run synchronously before the response is returned:

1. Push `CALL_RECEIVED` WS event *(bypassed — no-op)*
2. Decode audio, detect format (WAV/MP3/FLAC/OGG from magic bytes), upload to S3
3. Transcribe audio via Khaya ASR (local languages) or Amazon Transcribe (English)
4. Translate transcript to English via Khaya
5. Push `TRANSCRIPTION_READY` WS event *(bypassed)*
6. Run Bedrock Claude triage — returns severity, classification, prank flag, first-aid script, dispatcher brief
7. Push `TRIAGE_COMPLETE` WS event *(bypassed)*
8. If prank detected: save to DynamoDB, push `PRANK_DETECTED`, return early
9. Start AWS Location resolution concurrently
10. Generate first-aid TTS audio via Khaya (local) or Amazon Polly (English)
11. Upload TTS MP3 to S3 with public-read ACL
12. Await location result → landmark name + directions narrative
13. Push `LOCATION_RESOLVED` WS event *(bypassed)*
14. Save full call record to DynamoDB (`nkwa-calls` table)
15. Push `BRIEF_READY` WS event *(bypassed)*
16. If severity is CRITICAL: send SNS alert *(bypassed — no-op)*
17. Return `{ call_id, status, first_aid_audio_url }`

Current Bedrock layout: Claude Opus handles triage only. For non-prank calls, the backend retrieves approved first-aid guide chunks from Bedrock Knowledge Base, uses Claude Sonnet to produce grounded English caller guidance, then asks Khaya to translate that guidance for Twi, Ga, Ewe, and other local languages before TTS.

On any failure, the pipeline saves a partial record with a `failure_stage` field and returns HTTP 500.

---

## API routes

| Method | Path | Auth | Status | Description |
|---|---|---|---|---|
| GET | `/health` | None | Active | Server liveness check |
| POST | `/api/v1/auth/register` | None | Bypassed | Returns stub; no DynamoDB write |
| POST | `/api/v1/auth/verify-otp` | None | Bypassed | Returns bypass token |
| POST | `/api/v1/auth/login` | None | Bypassed | Returns bypass token |
| GET | `/api/v1/users/me` | JWT* | Bypassed | Returns stub profile |
| PATCH | `/api/v1/users/me` | JWT* | Bypassed | No-op |
| GET | `/api/v1/contacts` | JWT* | Bypassed | Returns 503 |
| POST | `/api/v1/contacts` | JWT* | Bypassed | Returns 503 |
| POST | `/api/v1/calls/initiate` | JWT* | **Active** | Runs full pipeline |
| GET | `/api/v1/calls/{id}/status` | JWT* | Active | Polls call status from DynamoDB |
| POST | `/api/v1/calls/{id}/end` | JWT* | Active | Marks call as ENDED |
| GET | `/api/v1/calls` | JWT* | Active | Lists/filters all calls |
| GET | `/api/v1/calls/stats` | JWT* | Active | Today's call metrics |
| GET | `/api/v1/calls/{id}` | JWT* | Active | Full call record |
| POST | `/api/v1/sos` | JWT* | Bypassed | Returns 503 |
| GET | `/api/v1/first-aid` | JWT* | Active | Lists first-aid guides |
| GET | `/api/v1/first-aid/{id}` | JWT* | Active | Single guide |
| WS | `/ws` | None | Partially active | Accepts connections; no events broadcast |

*JWT* — `get_current_user()` is currently bypassed and returns a hardcoded mock dispatcher without checking any token. Requests work with no `Authorization` header.

---

## WebSocket

The server accepts WebSocket connections at `/ws` and sends a `CONNECTION_ACK` on connect. `push_event()` in `ws_manager.py` is currently bypassed — it prints to stdout but does not broadcast to connected clients. The frontend does not implement a WebSocket client while this bypass is active.

When the dispatcher dashboard is re-enabled, restore `push_event()` in `shared/ws_manager.py`. Events fire in this order: `CALL_RECEIVED → TRANSCRIPTION_READY → TRIAGE_COMPLETE → LOCATION_RESOLVED → BRIEF_READY → SNS_ALERT_SENT` (CRITICAL only).

---

## Environment variables

| Variable | Default | Required in prod |
|---|---|---|
| `USE_MOCK` | `true` | Set to `false` |
| `JWT_SECRET` | — | Yes (currently unenforced) |
| `AWS_REGION` | `us-west-2` | Yes |
| `KHAYA_API_KEY` | — | Yes |
| `S3_BUCKET_NAME` | `nkwa-audio` | Yes |
| `DYNAMO_CALLS_TABLE` | `nkwa-calls` | Yes |
| `DYNAMO_FIRSTAID_TABLE` | `nkwa-first-aid` | Yes |
| `DYNAMO_CACHE_TABLE` | `nkwa-cache` | Yes |
| `DYNAMO_USERS_TABLE` | `nkwa-users` | Yes (table must exist) |
| `DYNAMO_CONTACTS_TABLE` | `nkwa-contacts` | Yes (table must exist) |
| `BEDROCK_MODEL_ID` | `us.anthropic.claude-opus-4-6-v1` | Yes |
| `BEDROCK_FIRST_AID_MODEL_ID` | `us.anthropic.claude-sonnet-4-6` | Yes |
| `BEDROCK_FIRST_AID_FAST_MODEL_ID` | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | Optional |
| `BEDROCK_KB_ID` | - | Yes when KB enabled |
| `BEDROCK_KB_ENABLED` | `false` | Set to `true` after KB sync |
| `BEDROCK_KB_NUMBER_OF_RESULTS` | `3` | Optional |
| `POLLY_VOICE_ID` | `Joanna` | Optional |
| `POLLY_OUTPUT_FORMAT` | `mp3` | Optional |
| `SNS_ALERT_TOPIC_ARN` | — | When SMS is re-enabled |

On EC2, `AWS_REGION` is the only AWS variable needed — the attached IAM role supplies credentials automatically.

---

## Seeding first-aid guides

Run once after creating the `nkwa-first-aid` DynamoDB table:

```bash
cd backend
source .venv/bin/activate
export $(cat ../.env | grep -v '^#' | xargs)
python scripts/seed_first_aid.py
```

---

## Tests

`tests/test_main.py` is stale — it was written against the original "Not implemented" endpoint stubs and will fail against the current codebase. It needs to be rewritten to test the active endpoints with `USE_MOCK=true` before being added to CI.

---

## Known issues

- `GET /api/v1/calls` does a full DynamoDB table scan. Fine for the demo; would need a GSI on `timestamp` for production scale.
- The Khaya client uses an in-process `_CACHE` dict. Cache is lost on server restart. Pre-caching for the demo should be done just before the demo session (see `DEPLOYMENT.md` Part 12).
