# Nkwa — Full Project Context for Claude Code

Read this entire file before writing a single line of code.

---

## What Is Nkwa

Nkwa (Twi for "life") is a GenAI-powered emergency dispatch copilot built for Ghana's 112 emergency line. It was built as part of the AWS GenAI Hackathon run by AmaliTech through the AWS re:Start Program.

**The problem it solves:** 90% of all 112 calls in Ghana are pranks, overwhelming real dispatchers. When a real emergency does come through, the caller often speaks a local language, there are no street addresses to describe location, and the dispatcher must manually extract all information before dispatching help. Average response time is 16.9 minutes against an 8-minute target.

**What Nkwa does:** When someone calls, Nkwa listens to the call in any Ghanaian language, transcribes and translates it in real time, classifies severity and detects pranks automatically, resolves the caller's GPS location to a nearby landmark, coaches the caller through first aid in their own language via audio, and delivers a complete structured brief to the dispatcher in under 30 seconds.

---


## The Three Platforms

Nkwa has three separate frontends and one shared backend.

### 1. Flutter Mobile App (Caller)
Gregory's responsibility. A mobile app for callers placing emergency calls. Screens include onboarding, registration, OTP verification, login, home dashboard, emergency service selection, language selection, active call screen, SOS panic button, contacts/safety circle management, first-aid guides, and settings.

### 2. Web Caller Platform (React)
A browser-based version of the caller experience. Same functionality as the Flutter app but accessed via web browser. This is for callers who do not have the mobile app installed. It uses the microphone API to record audio in the browser.

### 3. Dispatcher Dashboard (React)
A real-time web dashboard for emergency dispatchers. Shows a live feed of incoming calls with severity colour coding, a map with caller location pin, the AI-generated dispatcher brief, a prank call queue, and a call timeline.

---

## Backend

**Language:** Python  
**Framework:** FastAPI  
**Hosting:** EC2 on AWS (us-west-2)  
**Database:** DynamoDB  
**File storage:** S3  
**Real-time:** WebSocket via API Gateway  

One FastAPI app deployed on EC2. No Lambda. No Step Functions. No Kinesis. Kept simple intentionally for hackathon scope.

---

## Services in Use

### Third-Party APIs (GhanaNLP / Khaya AI)

Base URL: `https://translation-api.ghananlp.org`  
Auth header: `Ocp-Apim-Subscription-Key: <key>`  
**Rate limit: 100 requests per month total across all three APIs. Cache aggressively.**

**Khaya ASR**
- Endpoint: `POST /asr/v3/transcribe?language=twi`
- Body: raw binary audio bytes
- Content-Type: `audio/wav`
- Supported language codes: `twi`, `ewe`, `dag`, `eng`, `fra`, `bwu`, `xsm`, `kus`, `maw`, `wlx`
- Returns: `{ "text": "transcribed text here" }`

**Khaya Translation**
- Endpoint: `POST /v2/translate`
- Body: `{ "in": "text to translate", "lang": "twi-eng" }`
- Language pairs use ISO 639-3 codes. Use `twi-eng` not `tw-en`.
- Returns the translated string

**Khaya TTS**
- Endpoint: `POST /tts/v2/synthesize`
- Body: `{ "text": "...", "language": "twi", "speaker_id": "female", "format": "mp3" }`
- Returns binary MP3 audio
- Accept header: `audio/mp3`

### AWS Services

| Service | Purpose |
|---|---|
| Amazon Bedrock (Claude) | Triage, prank detection, severity, first-aid script, dispatcher brief |
| AWS Location Service | GPS coordinates → landmark name + human-readable directions |
| Amazon SNS | CRITICAL severity alerts to demo phone + OTP delivery during registration |
| Amazon DynamoDB | Call records, Khaya API response cache, first-aid guides, user accounts |
| Amazon S3 | Incoming audio clips, generated TTS audio files |
| Amazon EC2 | Hosts the FastAPI backend |
| API Gateway (WebSocket) | Pushes real-time events to the dispatcher dashboard |

### Dropped Services (do not use these)
- AWS Step Functions — overkill
- AWS Lambda — EC2 is simpler
- Amazon Kinesis — simulator calls API directly
- Amazon Transcribe — Khaya handles all languages
- Amazon Polly — Khaya TTS replaces it
- Bedrock Knowledge Base / RAG — WHO guidelines go in the prompt as text

---

## Repository Structure

```
nkwa/
├── backend/
│   ├── main.py                  # FastAPI app — all routes here
│   ├── shared/
│   │   ├── khaya_client.py      # Khaya ASR + Translate + TTS wrapper with cache
│   │   ├── bedrock_client.py    # Bedrock inference wrapper
│   │   ├── location_client.py   # AWS Location Service wrapper
│   │   ├── dynamo_client.py     # DynamoDB read/write helpers
│   │   └── models.py            # Pydantic request/response models
│   ├── data/
│   │   └── first_aid_guides.json # Static first-aid guide content
│   └── requirements.txt
├── web-caller/                  # React web caller platform
├── dispatcher/                  # React dispatcher dashboard
├── simulator/
│   ├── scenarios/emergency/     # 15 emergency audio clips + metadata
│   ├── scenarios/prank/         # 10 prank audio clips + metadata
│   ├── gps_coordinates.json     # 6 Accra GPS coordinates
│   └── simulate.py
├── tests/
│   └── fixtures/
│       ├── asr_response_twi.json
│       ├── translate_response.json
│       └── tts_speakers.json
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

---

## The Khaya Client Cache Rule

**This is mandatory.** Every Khaya API call must go through `shared/khaya_client.py`. That file checks DynamoDB for a cached response before hitting the live API. Only call the live API on a cache miss. Write the result back to DynamoDB after every live call. The cache key is a hash of the input.

This is the only way to stay within the 100-request monthly limit.

---

## The Full Pipeline (What Happens on a Call)

```
Caller sends audio + GPS
        ↓
POST /api/v1/calls/initiate
        ↓
1. Save audio to S3
2. Khaya ASR → transcription (cache first)
3. Khaya Translate → English text (cache first)
4. Bedrock Claude → triage JSON (severity, is_prank, first_aid, brief)
5. AWS Location → landmark + directions
6. Khaya TTS → first-aid MP3 saved to S3 (cache first)
7. Save full record to DynamoDB
8. Push BRIEF_READY WebSocket event to dispatcher dashboard
9. If CRITICAL: fire SNS alert
10. Return call_id + first_aid_audio_url to caller app
```

---

## The 5 Pipeline Scenarios

**Scenario 1 — CRITICAL:** Bedrock returns severity CRITICAL. Full pipeline runs. SNS fires. Call appears at top of dispatcher feed in red. First-aid audio plays to caller.

**Scenario 2 — URGENT:** Bedrock returns severity URGENT. Full pipeline runs. No SNS. Call appears mid-feed in amber.

**Scenario 3 — NON-EMERGENCY:** Bedrock returns severity NON_EMERGENCY. Full pipeline runs. No SNS. Call appears bottom of feed in green.

**Scenario 4 — PRANK:** Bedrock returns `is_prank: true`. Pipeline stops after triage. No TTS, no Location, no SNS. Call routed to prank queue on dashboard, not main feed.

**Scenario 5 — FAILURE:** Any step throws an exception. Backend retries once. If still failing, writes FAILED record to DynamoDB and pushes ERROR WebSocket event. Never crashes silently.

---

## Bedrock Triage Prompt (Required Output Format)

Bedrock must return valid JSON only, no preamble. The prompt must instruct Claude to return exactly this shape:

```json
{
  "severity": "CRITICAL | URGENT | NON_EMERGENCY",
  "call_classification": "REAL_EMERGENCY | PRANK | UNCERTAIN",
  "incident_type": "Cardiac arrest | Road accident | Fire | Drowning | Fracture | Minor laceration | null",
  "is_prank": false,
  "prank_confidence": 0.06,
  "confidence": 0.94,
  "first_aid_script": "English first-aid instructions here",
  "first_aid_script_translated": "Same instructions in caller's language",
  "dispatcher_brief": "Structured brief for the dispatcher",
  "recommended_response_unit": "AMBULANCE | FIRE | POLICE | NONE"
}
```

Include WHO Basic Emergency Care guidelines directly in the system prompt as text. No RAG needed.

---

## WebSocket Events

All events share this envelope:

```json
{
  "type": "EVENT_TYPE",
  "call_id": "uuid-v4",
  "timestamp": "ISO8601",
  "payload": {}
}
```

Event types in pipeline order: `CONNECTION_ACK`, `CALL_RECEIVED`, `TRANSCRIPTION_READY`, `TRIAGE_COMPLETE`, `LOCATION_RESOLVED`, `BRIEF_READY`, `SNS_ALERT_SENT`, `ERROR`

Push a WebSocket event after each pipeline step completes so the dashboard updates incrementally, not just at the end.

---

## REST API Routes

### Auth
```
POST /api/v1/auth/register          # name, email, phone, region, address, password → sends OTP
POST /api/v1/auth/verify-otp        # phone, otp → returns JWT token
POST /api/v1/auth/resend-otp        # phone → resends OTP
POST /api/v1/auth/login             # email, password → returns JWT token
POST /api/v1/auth/dispatcher/login  # email, password → returns JWT token
```

### User
```
GET   /api/v1/users/me              # returns current user profile
PATCH /api/v1/users/me              # updates profile fields
```

### Contacts (Safety Circle)
```
GET    /api/v1/contacts             # list all emergency contacts
POST   /api/v1/contacts             # add contact: name, relationship, phone, email
PATCH  /api/v1/contacts/:id         # update contact
DELETE /api/v1/contacts/:id         # remove contact
```

### Emergency Call Pipeline
```
POST /api/v1/calls/initiate         # THE core route — runs full pipeline
GET  /api/v1/calls/:id/status       # poll for first_aid_audio_url
POST /api/v1/calls/:id/end          # mark call ended
GET  /api/v1/calls                  # dispatcher: paginated call history
GET  /api/v1/calls/:id              # dispatcher: full call record
GET  /api/v1/calls/stats            # dispatcher: today's summary metrics
```

### SOS
```
POST /api/v1/sos                    # panic button: SNS to contacts + WebSocket to dashboard
```

### First Aid
```
GET /api/v1/first-aid               # list all guides (static, from DynamoDB)
GET /api/v1/first-aid/:guide_id     # full guide with steps
```

### System
```
GET /health                         # returns {"status": "ok"}
```

---

## DynamoDB Tables

### `nkwa-calls`
Partition key: `call_id` (string)

Fields: `call_id`, `user_id`, `timestamp`, `status`, `severity`, `call_classification`, `incident_type`, `is_prank`, `language`, `transcription_original`, `transcription_translated`, `gps_lat`, `gps_lon`, `landmark_name`, `directions_narrative`, `dispatcher_brief`, `first_aid_script`, `first_aid_audio_url`, `recommended_response_unit`, `pipeline_duration_seconds`, `failure_stage`

### `nkwa-users`
Partition key: `user_id` (string)

Fields: `user_id`, `full_name`, `email`, `phone`, `region`, `home_address`, `nkwa_id`, `password_hash`, `otp`, `otp_expiry`, `created_at`

### `nkwa-contacts`
Partition key: `user_id` (string), Sort key: `contact_id` (string)

Fields: `contact_id`, `user_id`, `full_name`, `relationship`, `phone`, `email`, `notify`

### `nkwa-cache`
Partition key: `cache_key` (string)

Fields: `cache_key`, `value`, `created_at`

### `nkwa-first-aid`
Partition key: `guide_id` (string)

Fields: `guide_id`, `title`, `category`, `overview`, `steps_count`, `steps` (list)

---

## Environment Variables

```
# Khaya API
KHAYA_API_KEY=

# AWS
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=nkwa-audio

# DynamoDB table names
DYNAMO_CALLS_TABLE=nkwa-calls
DYNAMO_USERS_TABLE=nkwa-users
DYNAMO_CONTACTS_TABLE=nkwa-contacts
DYNAMO_CACHE_TABLE=nkwa-cache
DYNAMO_FIRSTAID_TABLE=nkwa-first-aid

# Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# JWT
JWT_SECRET=
JWT_EXPIRY_HOURS=24

# SNS
SNS_ALERT_TOPIC_ARN=
SNS_DEMO_PHONE=+233XXXXXXXXX

# WebSocket
WEBSOCKET_API_ENDPOINT=wss://...

# Server
PORT=8000
```

---

## Simulated Accra GPS Coordinates

```python
accra_locations = [
    {"name": "Madina Market",  "lat": 5.6726, "lon": -0.1650},
    {"name": "Tema Motorway",  "lat": 5.6200, "lon": -0.0500},
    {"name": "Kaneshie",       "lat": 5.5558, "lon": -0.2314},
    {"name": "Spintex Road",   "lat": 5.6350, "lon": -0.1200},
    {"name": "Korle Bu",       "lat": 5.5364, "lon": -0.2200},
    {"name": "Accra Mall",     "lat": 5.6362, "lon": -0.1769},
]
```

---

## Simulated Scenarios

**15 Emergency scenarios:** cardiac arrest, road accident, drowning, fire, assault, choking, severe bleeding, fracture, stroke, poisoning, burns, childbirth emergency, snake bite, allergic reaction, electrocution.

**10 Prank scripts:** laughing during call, random nonsense, children playing, silent call, repeated fake distress sounds, wrong number, deliberate fake emergency, background noise only, singing, screaming with friends.

**Languages used:** Twi, Ewe, English.

---

## Team Structure

| Role | Person | Responsibility |
|---|---|---|
| IoT Simulation + AI/ML + Backend | Etornam (Shampoo) | Python simulator, Bedrock prompts, FastAPI backend, khaya_client.py |
| Mobile (Flutter caller app) | Gregory | Flutter app, all caller-side screens |
| Frontend (React) | Frontend dev | Dispatcher dashboard + web caller platform |
| Infrastructure + Security | Merged role | EC2, VPC, IAM, GuardDuty |
| AWS Generalists | 2 people | Service provisioning, CloudWatch, SNS wiring |
| Non-technical | 1 person | Strategy, research, demo coordination |

---

## Important Constraints

- 100 Khaya API requests per month total. Cache everything. Pre-generate all demo audio before demo day.
- Only enable Bedrock models you actually use. Do not enable all available models.
- AWS account lifetime is 72 hours from June 23 noon. It terminates Friday afternoon.
- Every team member works on a feature branch. Nobody pushes directly to main.
- The Bedrock prompt quality is the single most critical piece of code. Bad prompt = bad triage = broken product.
- For the demo: pre-cache all 15 emergency and 10 prank scenario responses in DynamoDB before presentations begin.

---

## What the Demo Must Show

1. Dispatcher dashboard loads — empty, waiting
2. Prank call fires — dashboard routes it to prank queue automatically, main feed stays clean
3. Real emergency fires in Twi — dispatcher sees transcription appear, then severity badge, then location on map, then full brief
4. First-aid audio plays to caller in Twi
5. SNS alert fires to demo phone
6. Total time call to brief: under 30 seconds
7. `pipeline_duration_seconds` shown on the call card

---

## Honest Limitations to Acknowledge to Judges

- Khaya ASR accuracy varies by language and audio quality. Demo uses pre-recorded clean audio.
- Nkwa is a decision support tool, not a diagnostic system. It never diagnoses.
- Real 112 integration is the post-hackathon roadmap. This is a prototype.
- Google/Apple OAuth shown in UI is not implemented. Email + password + OTP is sufficient for demo.
