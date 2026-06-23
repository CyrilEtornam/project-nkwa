# Nkwa Backend

FastAPI backend for the Nkwa 112 emergency dispatch system.

---

## Prerequisites

- Python 3.11+
- Virtual environment already bootstrapped at `backend/.env/`

---

## Local Setup (Mock Mode — no AWS credentials needed)

**1. Activate the virtual environment**

```bash
cd backend
source .env/bin/activate
```

**2. Set the minimum environment variables**

Create a `.env` file at the project root (not inside `backend/`):

```env
USE_MOCK=true
JWT_SECRET=any-random-string-here
AWS_REGION=us-west-2
```

With `USE_MOCK=true` the server runs fully offline. All Khaya, Bedrock, Location, SNS, S3, and DynamoDB calls are intercepted and return realistic mock data — no credentials needed.

**3. Install dependencies**

```bash
pip install -r requirements.txt
```

**4. Start the server**

```bash
USE_MOCK=true JWT_SECRET=your-secret uvicorn main:app --reload --port 8000
```

The API is live at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

---

## Quick Smoke Test

```bash
# Health
curl http://localhost:8000/health

# Register — the 6-digit OTP is printed to the terminal (mock mode)
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Kofi Mensah","email":"kofi@test.com","phone":"+233241112222",
       "region":"Greater Accra","home_address":"Near Accra Mall","password":"secret123"}'

# Verify OTP (use the code printed above)
curl -X POST http://localhost:8000/api/v1/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"+233241112222","otp":"<OTP>"}'

# Initiate a call (base64-encode a WAV file for audio_base64)
curl -X POST http://localhost:8000/api/v1/calls/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"service_type":"AMBULANCE","language":"tw","gps_lat":5.6362,"gps_lon":-0.1769,"audio_base64":"<BASE64_WAV>"}'
```

---

## WebSocket

Connect to `ws://localhost:8000/ws` to receive live pipeline events from the dispatcher dashboard.

Events fire in this order during a call:

```
CONNECTION_ACK → CALL_RECEIVED → TRANSCRIPTION_READY → TRIAGE_COMPLETE
→ LOCATION_RESOLVED → BRIEF_READY → SNS_ALERT_SENT (CRITICAL only)
```

Test from browser console:

```js
const ws = new WebSocket("ws://localhost:8000/ws");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.send(JSON.stringify({ type: "PING" }));  // should get PONG back
```

---

## Environment Variables

| Variable | Default | Required in prod |
|---|---|---|
| `USE_MOCK` | `true` | Set to `false` |
| `JWT_SECRET` | — | Yes |
| `AWS_REGION` | `us-west-2` | Yes |
| `AWS_ACCESS_KEY_ID` | — | Yes |
| `AWS_SECRET_ACCESS_KEY` | — | Yes |
| `KHAYA_API_KEY` | — | Yes (local language calls) |
| `S3_BUCKET_NAME` | `nkwa-audio` | Yes |
| `DYNAMO_USERS_TABLE` | `nkwa-users` | Yes |
| `DYNAMO_CALLS_TABLE` | `nkwa-calls` | Yes |
| `DYNAMO_CONTACTS_TABLE` | `nkwa-contacts` | Yes |
| `DYNAMO_FIRSTAID_TABLE` | `nkwa-first-aid` | Yes |
| `DYNAMO_CACHE_TABLE` | `nkwa-cache` | Yes |
| `BEDROCK_MODEL_ID` | `anthropic.claude-3-5-sonnet-20241022-v2:0` | Yes |
| `SNS_ALERT_TOPIC_ARN` | — | Yes |
| `POLLY_VOICE_ID` | `Joanna` | Optional |

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Server health |
| POST | `/api/v1/auth/register` | No | Register + send OTP via SMS |
| POST | `/api/v1/auth/verify-otp` | No | Verify OTP, receive JWT |
| POST | `/api/v1/auth/resend-otp` | No | Resend OTP |
| POST | `/api/v1/auth/login` | No | Login, receive JWT |
| POST | `/api/v1/auth/dispatcher/login` | No | Dispatcher-only login |
| GET | `/api/v1/users/me` | JWT | Get own profile |
| PATCH | `/api/v1/users/me` | JWT | Update profile fields |
| GET | `/api/v1/contacts` | JWT | List safety circle |
| POST | `/api/v1/contacts` | JWT | Add emergency contact |
| PATCH | `/api/v1/contacts/{id}` | JWT | Update contact |
| DELETE | `/api/v1/contacts/{id}` | JWT | Remove contact |
| POST | `/api/v1/calls/initiate` | JWT | Run full 20-step pipeline |
| GET | `/api/v1/calls/{id}/status` | JWT | Poll call status |
| POST | `/api/v1/calls/{id}/end` | JWT | Mark call as ENDED |
| GET | `/api/v1/calls` | JWT | List/filter all calls |
| GET | `/api/v1/calls/stats` | JWT | Today's metrics summary |
| GET | `/api/v1/calls/{id}` | JWT | Full call record |
| POST | `/api/v1/sos` | JWT | Trigger SOS to contacts |
| GET | `/api/v1/first-aid` | JWT | List first-aid guides |
| GET | `/api/v1/first-aid/{id}` | JWT | Single guide with steps |

---

## Production Deployment (EC2)

```bash
cd backend
source .env/bin/activate
pip install -r requirements.txt

# Set real env vars — never put these in a committed file
export USE_MOCK=false
export JWT_SECRET=<strong-random-secret>
export KHAYA_API_KEY=<your-key>
# ... all other vars from the table above

nohup uvicorn main:app --host 0.0.0.0 --port 8000 &
```

EC2 security group: allow inbound TCP on port 8000 from `0.0.0.0/0` for the demo.

---

## What Still Needs to Be Done

### AWS Infrastructure (one-time setup)

- [ ] Create the five DynamoDB tables: `nkwa-users`, `nkwa-calls`, `nkwa-contacts`, `nkwa-cache`, `nkwa-first-aid` (partition/sort keys per `CONTEXT.md` Section 10)
- [ ] Create S3 bucket `nkwa-audio`; add a bucket policy to allow public-read on `calls/*/first_aid_*.mp3`
- [ ] Enable Bedrock model `anthropic.claude-3-5-sonnet-20241022-v2:0` in `us-west-2` (do not enable others)
- [ ] Create SNS topic; save ARN as `SNS_ALERT_TOPIC_ARN`; subscribe the demo phone number
- [ ] Attach an IAM role to the EC2 instance with permissions for: DynamoDB, S3, Bedrock, Location, SNS, Transcribe, Polly

### Data Seeding

- [ ] Run `python scripts/seed_first_aid.py` against the real DynamoDB to populate `nkwa-first-aid`
- [ ] Add a dispatcher account directly to `nkwa-users` (set `role: "dispatcher"`) for the dashboard login

### Pre-Demo Cache Run

- [ ] Before June 27, run all 15 emergency + 10 prank simulator scenarios through the live pipeline with `USE_MOCK=false` and a real Khaya API key so responses are cached in DynamoDB
- [ ] Set `USE_MOCK=false` only for this run, then flip back — this preserves the 100 Khaya monthly credits for the actual demo

### Integration Testing (with `USE_MOCK=false` and real AWS)

- [ ] OTP SMS arrives on a real phone via SNS
- [ ] Twi audio clip (`tw`) is transcribed by Khaya ASR and translated correctly
- [ ] Bedrock triage returns valid JSON for all 5 scenario types (CRITICAL, URGENT, NON_EMERGENCY, PRANK, FAILURE)
- [ ] CRITICAL alert SMS fires to the SNS topic
- [ ] TTS audio is generated and publicly accessible via the S3 URL

### Known Gaps to Address

- `tests/test_main.py` is stale — written for the old "Not implemented" stubs; needs to be rewritten against the real endpoints before CI
- The `nkwa-cache` DynamoDB table exists in the schema but `khaya_client.py` uses an in-process `_CACHE` dict. If the server restarts mid-demo, the cache is lost. Wire it to DynamoDB if the pre-cache strategy depends on persistence across restarts.
- `GET /api/v1/calls` does a full table scan — fine for the demo, but would need a DynamoDB GSI on `timestamp` for production scale
