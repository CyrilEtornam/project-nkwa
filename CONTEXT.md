# Nkwa — Full Project Context

> Read this entire file before writing a single line of code. Every architectural decision made in this project is documented here. Do not invent alternatives or suggest different approaches unless explicitly asked.

---

## 1. What Is Nkwa

Nkwa (Twi for "life") is a GenAI-powered emergency dispatch copilot built for Ghana's 112 emergency line. Built as part of the AWS GenAI Hackathon run by AmaliTech through the AWS re:Start Program.

### The Problem

- 90% of all 112 calls in Ghana are pranks, overwhelming real dispatchers (Source: President Akufo-Addo, Jan 2020)
- GNFS received 131,862 prank calls in Q1 2025 alone
- Average ambulance response time is 16.9 minutes against an 8-minute target that has never been achieved
- Callers receive zero guidance while waiting
- Language barriers slow every interaction — Ghana has over 80 languages
- There is no street addressing system in Accra. Callers cannot describe where they are.
- Accra has 1 ambulance per 250,000 people

### What Nkwa Does

When someone calls, Nkwa:
1. Listens to the call in any Ghanaian language (Twi, Ewe, Dagbani, English)
2. Transcribes and translates the call to English in real time
3. Classifies severity: CRITICAL, URGENT, or NON_EMERGENCY
4. Detects and de-prioritises prank calls automatically
5. Resolves the caller's GPS location to a nearby landmark description
6. Coaches the caller through first aid in their own language via audio
7. Delivers a complete structured brief to the dispatcher before they pick up
8. Fires an SMS alert to the nearest unit if severity is CRITICAL

Total time from call to complete dispatcher brief: under 30 seconds.

---

## 2. Hackathon Constraints

- **Submission deadline:** June 25 at 10pm
- **Presentation day:** June 27
- **Build window:** June 23 noon to June 25 10pm (72 hours)
- **Pre-build prep:** June 18 to June 22 on personal AWS accounts
- **AWS Workshop account lifetime:** 72 hours — terminates Friday afternoon
- **AWS Region:** us-west-2 (all services must be in this region)
- **Bedrock:** Only enable models you actually use. Do not enable all available models.
- **Khaya API limit:** 100 requests per month total across all three Khaya APIs

---

## 3. The Three Platforms

Nkwa has three separate frontends and one shared backend.

### Platform 1 — Flutter Mobile App (Caller)
**Owner:** Gregory  
A mobile app for callers placing emergency calls. Features include onboarding (4 screens), registration with OTP verification, login, home dashboard with profile card, emergency service selection (Ambulance / Fire Service / Police / SOS Alert), language selection before calling, active call screen with first-aid audio playback, SOS one-tap panic button, emergency contacts / safety circle management, offline first-aid guides browser, and settings.

Audio is recorded on device using the Flutter `record` package. Clips are 15 to 30 seconds maximum. Audio is encoded as base64 and sent to the backend in the `POST /api/v1/calls/initiate` request body.

### Platform 2 — Web Caller Platform (React)
**Owner:** Frontend dev  
A browser-based version of the caller experience. Identical functionality to the Flutter app but runs in a web browser. Uses the browser `MediaRecorder` API to record audio. Sends audio as base64 to the same backend endpoints as the Flutter app. Designed for callers who do not have the mobile app installed. No separate backend routes — shares 100% of the same API as the Flutter app.

### Platform 3 — Dispatcher Dashboard (React)
**Owner:** Frontend dev  
A real-time web dashboard for emergency dispatchers. Features include live call feed with severity colour coding (red/amber/green/grey), map component with caller GPS pin and landmark label, AI-generated dispatcher brief panel, prank call queue (separate from main feed), call timeline showing each pipeline step and timestamp, and summary metrics header (total calls today, pranks filtered, average pipeline time, active critical count).

---

## 4. Backend

**Language:** Python 3.11+  
**Framework:** FastAPI  
**Server:** Uvicorn  
**Hosting:** Single EC2 instance on AWS (us-west-2)  
**Database:** DynamoDB  
**File storage:** S3  
**Real-time:** Native FastAPI WebSocket  
**Auth:** JWT (PyJWT + bcrypt)  

One FastAPI app. Everything in one process. No Lambda. No Step Functions. No Kinesis. This is a deliberate simplification for the 72-hour hackathon scope. The goal is a working demo, not production infrastructure.

---

## 5. Speech Processing — Language Routing Rule

**This is the most important architectural decision in the codebase. Read it carefully.**

Khaya AI has a 100-request monthly limit across all three APIs (ASR, Translation, TTS). To preserve those credits for local language calls, English calls use AWS-native services exclusively.

**Language codes are verified from the live Khaya `/languages` endpoint. These are the only correct codes. Do not use ISO 639-3 codes — the Khaya API does not accept them.**

| Language | Khaya Code | ASR (Speech → Text) | Translation pair | TTS (Text → Speech) |
|---|---|---|---|---|
| Twi | `tw` | Khaya ASR | `tw-en` | Khaya TTS |
| Ewe | `ee` | Khaya ASR | `ee-en` | Khaya TTS |
| Dagbani | `dag` | Khaya ASR | `dag-en` | Khaya TTS |
| Ga | `gaa` | Khaya ASR | `gaa-en` | Khaya TTS |
| Fante | `fat` | Khaya ASR | `fat-en` | Khaya TTS |
| Kusaal | `kus` | Khaya ASR | `kus-en` | Khaya TTS |
| English | `en` | Amazon Transcribe | Not needed — already English | Amazon Polly |

**The routing logic lives entirely inside `shared/speech_client.py`.** No router, no pipeline function, no other module ever checks the language and decides which service to call. That decision is made once, in one place.

The English check in code is `if language == "en"` — not `"eng"`, not `"english"`. Using the wrong string means English calls hit Khaya and burn credits silently.

An English call consumes zero Khaya requests. All 100 monthly Khaya credits are reserved for local language calls only.

---

## 6. External APIs

### 6a. Khaya AI (GhanaNLP) — Local Languages Only

**Base URL:** `https://translation-api.ghananlp.org`  
**Auth header:** `Ocp-Apim-Subscription-Key: {KHAYA_API_KEY}`  
**Monthly limit:** 100 requests total across ASR + Translation + TTS  
**Cache rule:** Check DynamoDB `nkwa-cache` before every Khaya call. Return cached value if found. Write to cache after every live call.

#### Khaya ASR
```
POST /asr/v3/transcribe?language={language_code}
Content-Type: audio/wav
Body: raw binary audio bytes (NOT multipart/form-data, NOT base64 — raw bytes)

CORRECT language codes (verified from live API):
  tw   → Twi
  ee   → Ewe
  dag  → Dagbani
  gaa  → Ga
  fat  → Fante
  kus  → Kusaal

NEVER send English (en) to Khaya ASR. English goes to Amazon Transcribe.
NEVER use ISO 639-3 codes (twi, ewe) — these return UNSUPPORTED_LANGUAGE errors.

Response: { "text": "transcribed text here" }
```

#### Khaya Translation
```
POST /v2/translate
Content-Type: application/json
Body: { "in": "text to translate", "lang": "tw-en" }

Language pair format: {source}-{target} using Khaya's own codes (NOT ISO 639-3).
CORRECT pairs:
  "tw-en"   → Twi to English
  "ee-en"   → Ewe to English
  "dag-en"  → Dagbani to English
  "gaa-en"  → Ga to English
  "fat-en"  → Fante to English
  "kus-en"  → Kusaal to English

WRONG (these return 400 or UNSUPPORTED_LANGUAGE errors):
  "twi-eng", "ewe-eng", "dag-eng" — ISO 639-3 codes do not work
  "tw-english" — full language names do not work

Response: translated string (not wrapped in a JSON object — plain string)
```

#### Khaya TTS
```
POST /tts/v2/synthesize
Content-Type: application/json
Accept: audio/mp3
Body: {
  "text": "text to speak",
  "language": "tw",
  "speaker_id": "female",
  "stream": false,
  "format": "mp3"
}

Language field uses same Khaya codes as ASR: tw, ee, dag, gaa, fat, kus
NEVER pass "en" to Khaya TTS — English goes to Amazon Polly.
Available speaker_ids: "male_low", "male_high", "female"
Response: binary MP3 audio bytes
```

### 6b. Amazon Transcribe — English Only

Use boto3 `transcribe` client. Start a transcription job with:
- `LanguageCode: en-US`
- `MediaFormat: wav`
- Audio uploaded to S3 first, then pass the S3 URI

For the hackathon demo, use `start_transcription_job` and poll for completion. In production this would be streaming, but polling is sufficient for demo.

### 6c. Amazon Polly — English Only

Use boto3 `polly` client. Call `synthesize_speech` with:
- `Text`: the English first-aid script
- `VoiceId`: from `POLLY_VOICE_ID` env var (default: `Joanna`)
- `OutputFormat`: `mp3`
- `Engine`: `neural`

Returns an `AudioStream` — read it to bytes and save to S3.

---

## 7. AWS Services Detail

### Amazon Bedrock (Claude)
- **Model:** `anthropic.claude-3-5-sonnet-20241022-v2:0` (from `BEDROCK_MODEL_ID` env var)
- **Client:** boto3 `bedrock-runtime`
- **Method:** `invoke_model`
- **Purpose:** Single inference call that returns severity classification, prank detection, incident type, first-aid script, first-aid script translated, and dispatcher brief all at once
- **Input:** Translated English transcription + GPS coordinates + WHO first-aid guidelines embedded in system prompt
- **Output:** Structured JSON — must be parsed immediately. If parse fails, retry once with simpler prompt.
- **WHO guidelines:** Embedded directly in the system prompt as text. No RAG, no Knowledge Base.

### AWS Location Service
- **Client:** boto3 `location`
- **Method:** `search_place_index_for_position`
- **Purpose:** Convert GPS lat/lon to a human-readable landmark description
- **Place index:** Must be created in us-west-2 before use
- **Fallback:** If no results, return `"Location could not be resolved"` — do not fail the pipeline

### Amazon SNS
- **Two uses:**
  1. OTP delivery during user registration — `publish` to phone number directly
  2. CRITICAL severity alert — `publish` to `SNS_ALERT_TOPIC_ARN`
- **OTP format:** 6-digit numeric code, expires in 10 minutes
- **CRITICAL alert message format:** `"CRITICAL — {incident_type} near {landmark_name}. Dispatch {recommended_response_unit} immediately."`

### Amazon DynamoDB
- **Client:** boto3 `dynamodb` resource (not client — use resource for cleaner syntax)
- **Five tables:** see Section 10 for full schema
- **All operations go through `shared/dynamo_client.py`** — never use boto3 directly in routers

### Amazon S3
- **Bucket:** `nkwa-audio` (from `S3_BUCKET_NAME` env var)
- **Two types of files stored:**
  1. Incoming audio: `calls/{call_id}/audio.wav`
  2. Generated TTS audio: `calls/{call_id}/first_aid_{language}.mp3`
- **TTS files are publicly readable** so the frontend can play them via URL
- **Incoming audio is private**

### Amazon EC2
- **OS:** Ubuntu 24.04
- **Instance type:** t2.medium minimum (t3.medium preferred)
- **Port 8000:** FastAPI (REST + WebSocket)
- **Security group:** Allow inbound 8000 from 0.0.0.0/0 for the demo
- **Process manager:** Run with `nohup uvicorn main:app --host 0.0.0.0 --port 8000 &` for persistence

---

## 8. Repository Structure

```
nkwa/
├── backend/
│   ├── main.py                      # FastAPI app, WebSocket manager, route registration
│   ├── shared/
│   │   ├── __init__.py
│   │   ├── speech_client.py         # Language router: Khaya vs Transcribe/Polly + cache
│   │   ├── bedrock_client.py        # Bedrock triage inference
│   │   ├── location_client.py       # AWS Location Service wrapper
│   │   ├── dynamo_client.py         # DynamoDB CRUD helpers
│   │   ├── s3_client.py             # S3 upload/download helpers
│   │   ├── sns_client.py            # SNS OTP and alert helpers
│   │   └── models.py                # All Pydantic models
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                  # Register, OTP, login
│   │   ├── users.py                 # Profile read/update
│   │   ├── contacts.py              # Safety circle CRUD
│   │   ├── calls.py                 # Pipeline + history
│   │   ├── sos.py                   # Panic button
│   │   └── first_aid.py             # Guide list and detail
│   ├── scripts/
│   │   └── seed_first_aid.py        # One-time DynamoDB seeder
│   ├── data/
│   │   └── first_aid_guides.json    # Static guide content
│   └── requirements.txt
│
├── web-caller/                      # React web caller platform
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── package.json
│
├── dispatcher/                      # React dispatcher dashboard
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── package.json
│
├── simulator/
│   ├── scenarios/
│   │   ├── emergency/               # 15 audio clips + metadata JSON
│   │   └── prank/                   # 10 audio clips + metadata JSON
│   ├── gps_coordinates.json
│   └── simulate.py                  # Calls POST /api/v1/calls/initiate directly
│
├── tests/
│   └── fixtures/
│       ├── asr_response_twi.json    # Saved Khaya ASR response
│       ├── translate_response.json  # Saved Khaya Translation response
│       └── tts_speakers.json        # Saved Khaya speakers list
│
├── docs/
│   ├── nkwa-api-routes.md
│   ├── nkwa-websocket-api-spec.md
│   └── nkwa-pipeline-scenarios.md
│
├── .env.example
├── .gitignore                       # Must include .env
└── README.md
```

---

## 9. The Full Pipeline

This is what happens inside `POST /api/v1/calls/initiate`. Every step in order.

```
Caller app sends:
  - audio_base64 (base64 encoded WAV audio, 15-30 seconds)
  - language ("tw" | "ee" | "dag" | "gaa" | "fat" | "kus" | "en")
  - service_type ("AMBULANCE" | "FIRE" | "POLICE" | "SOS")
  - gps_lat (float)
  - gps_lon (float)

Step 1:  Generate call_id (UUID v4). Record start_time.
Step 2:  Push CALL_RECEIVED WebSocket event to dashboard immediately.
Step 3:  Decode base64 audio to bytes. Save to S3 at calls/{call_id}/audio.wav.
Step 4:  Transcribe audio → text (speech_client.transcribe — Khaya or Transcribe based on language).
Step 5:  Push TRANSCRIPTION_READY WebSocket event with original transcription.
Step 6:  Translate to English (speech_client.translate — Khaya or passthrough for English).
Step 7:  Update TRANSCRIPTION_READY WebSocket event with translated text.
Step 8:  Run Bedrock triage (bedrock_client.run_triage) → structured JSON result.
Step 9:  Push TRIAGE_COMPLETE WebSocket event.
Step 10: If is_prank is true → save prank record to DynamoDB → push prank WebSocket event → return early.
Step 11: Start location resolution concurrently (asyncio.create_task).
Step 12: Generate first-aid audio (speech_client.synthesize — Khaya TTS or Polly based on language).
Step 13: Save TTS audio to S3. Get public URL.
Step 14: Await location resolution result.
Step 15: Push LOCATION_RESOLVED WebSocket event.
Step 16: Calculate pipeline_duration_seconds = time.time() - start_time.
Step 17: Save full call record to DynamoDB nkwa-calls table.
Step 18: Push BRIEF_READY WebSocket event with complete brief payload.
Step 19: If severity is CRITICAL → fire SNS alert → push SNS_ALERT_SENT WebSocket event.
Step 20: Return response to caller app: { call_id, status, first_aid_audio_url }.
```

If any step throws an exception: catch it, write a FAILED record to DynamoDB with failure_stage set to the step name, push an ERROR WebSocket event, return HTTP 500. Never crash silently.

---

## 10. DynamoDB Table Schemas

### `nkwa-calls`
Partition key: `call_id` (String)

| Field | Type | Description |
|---|---|---|
| call_id | String | UUID v4 |
| user_id | String | FK to nkwa-users |
| timestamp | String | ISO 8601 UTC |
| status | String | PROCESSING, COMPLETE, PRANK, FAILED, ENDED |
| severity | String | CRITICAL, URGENT, NON_EMERGENCY, null |
| call_classification | String | REAL_EMERGENCY, PRANK, UNCERTAIN |
| incident_type | String | e.g. "Cardiac arrest", null if prank |
| is_prank | Boolean | true or false |
| prank_confidence | Number | 0.0 to 1.0 |
| confidence | Number | 0.0 to 1.0 |
| language | String | tw, ee, dag, gaa, fat, kus, en |
| service_type | String | AMBULANCE, FIRE, POLICE, SOS |
| transcription_original | String | Raw transcription in caller's language |
| transcription_translated | String | English translation |
| gps_lat | Number | Caller latitude |
| gps_lon | Number | Caller longitude |
| landmark_name | String | Nearest landmark from AWS Location |
| district | String | District from AWS Location |
| region | String | Region from AWS Location |
| directions_narrative | String | Human-readable location string |
| first_aid_script | String | English first-aid instructions |
| first_aid_script_translated | String | First-aid in caller's language |
| first_aid_audio_url | String | S3 public URL to MP3 |
| dispatcher_brief | String | Structured dispatcher brief text |
| recommended_response_unit | String | AMBULANCE, FIRE, POLICE, NONE |
| pipeline_duration_seconds | Number | Total processing time |
| failure_stage | String | Which step failed, null if success |

### `nkwa-users`
Partition key: `user_id` (String)

| Field | Type | Description |
|---|---|---|
| user_id | String | UUID v4 |
| full_name | String | |
| email | String | Unique |
| phone | String | E.164 format e.g. +233241112222 |
| region | String | e.g. Greater Accra |
| home_address | String | Free text landmark description |
| nkwa_id | String | Auto-generated e.g. GA-123-4567 |
| password_hash | String | bcrypt hash |
| role | String | caller, dispatcher |
| otp | String | 6-digit code |
| otp_expiry | String | ISO 8601 expiry timestamp |
| verified | Boolean | Phone verified via OTP |
| created_at | String | ISO 8601 UTC |

### `nkwa-contacts`
Partition key: `user_id` (String), Sort key: `contact_id` (String)

| Field | Type | Description |
|---|---|---|
| user_id | String | FK to nkwa-users |
| contact_id | String | UUID v4 |
| full_name | String | |
| relationship | String | e.g. Father, Sister, Friend |
| phone | String | E.164 format |
| email | String | Optional |
| notify | Boolean | Whether to alert on SOS |

### `nkwa-cache`
Partition key: `cache_key` (String)

| Field | Type | Description |
|---|---|---|
| cache_key | String | Hash of input e.g. "asr:twi:{hash}" |
| value | String | Cached string response |
| created_at | String | ISO 8601 UTC |

### `nkwa-first-aid`
Partition key: `guide_id` (String)

| Field | Type | Description |
|---|---|---|
| guide_id | String | UUID v4 |
| title | String | e.g. "Choking (adult)" |
| category | String | e.g. "Airway emergency" |
| overview | String | Short description |
| steps_count | Number | Number of steps |
| steps | List | List of {step_number, title, description} |
| offline_available | Boolean | Always true for demo |

---

## 11. All REST API Routes

### Auth (no JWT required)
```
POST /api/v1/auth/register
  Body: { full_name, email, phone, region, home_address, password }
  Action: Hash password. Generate 6-digit OTP. Save user. Send OTP via SNS SMS.
  Response 201: { user_id, message: "OTP sent to phone" }

POST /api/v1/auth/verify-otp
  Body: { phone, otp }
  Action: Check OTP and expiry. Mark user as verified. Return JWT.
  Response 200: { token, user: { user_id, full_name } }

POST /api/v1/auth/resend-otp
  Body: { phone }
  Action: Regenerate OTP. Update DynamoDB. Resend SNS SMS.
  Response 200: { message: "OTP resent" }

POST /api/v1/auth/login
  Body: { email, password }
  Action: Verify bcrypt hash. Return JWT.
  Response 200: { token, user: { user_id, full_name, role } }

POST /api/v1/auth/dispatcher/login
  Body: { email, password }
  Action: Same as login but checks role == "dispatcher".
  Response 200: { token }
```

### User (JWT required)
```
GET /api/v1/users/me
  Action: Read from nkwa-users using user_id from JWT.
  Response 200: Full user profile object (exclude password_hash, otp, otp_expiry)

PATCH /api/v1/users/me
  Body: Any subset of { full_name, phone, region, home_address }
  Action: Update provided fields in nkwa-users.
  Response 200: { message: "Profile updated" }
```

### Contacts (JWT required)
```
GET /api/v1/contacts
  Action: Query nkwa-contacts by user_id.
  Response 200: { total, contacts: [...] }

POST /api/v1/contacts
  Body: { full_name, relationship, phone, email? }
  Action: Generate contact_id. Write to nkwa-contacts.
  Response 201: { contact_id, full_name, message: "Contact added" }

PATCH /api/v1/contacts/{contact_id}
  Body: Any subset of { full_name, relationship, phone, email, notify }
  Action: Update contact in nkwa-contacts.
  Response 200: { message: "Contact updated" }

DELETE /api/v1/contacts/{contact_id}
  Action: Delete from nkwa-contacts.
  Response 200: { message: "Contact removed" }
```

### Emergency Call Pipeline (JWT required)
```
POST /api/v1/calls/initiate
  Body: { service_type, language, gps_lat, gps_lon, audio_base64 }
  Action: Run full pipeline (see Section 9).
  Response 202: { call_id, status: "PROCESSING", first_aid_audio_url }

GET /api/v1/calls/{call_id}/status
  Action: Read status and first_aid_audio_url from nkwa-calls.
  Response 200: { call_id, status, first_aid_audio_url, first_aid_text }

POST /api/v1/calls/{call_id}/end
  Action: Update status to ENDED in nkwa-calls.
  Response 200: { call_id, status: "ENDED" }

GET /api/v1/calls
  Query params: limit (default 20), offset (default 0), severity, classification, from, to
  Action: Scan nkwa-calls with optional filters. Dispatcher only.
  Response 200: { total, limit, offset, results: [...] }

GET /api/v1/calls/{call_id}
  Action: Get full call record from nkwa-calls.
  Response 200: Full call record

GET /api/v1/calls/stats
  Action: Query today's calls from nkwa-calls. Compute summary metrics.
  Response 200: { total_calls_today, real_emergencies_today, pranks_filtered_today,
                  avg_pipeline_duration_seconds, critical_active }
```

### SOS (JWT required)
```
POST /api/v1/sos
  Body: { gps_lat, gps_lon, message? }
  Action: Get caller's contacts where notify=true. Send SNS SMS to each.
          Push WebSocket event to dispatcher dashboard. Save SOS record.
  Response 200: { sos_id, contacts_alerted, dispatcher_notified: true }
```

### First Aid (JWT required)
```
GET /api/v1/first-aid
  Action: Scan nkwa-first-aid table. Return list.
  Response 200: { guides: [...] }

GET /api/v1/first-aid/{guide_id}
  Action: Get single guide from nkwa-first-aid.
  Response 200: Full guide with steps array
```

### System (no auth)
```
GET /health
  Response 200: { status: "ok", timestamp: ISO8601 }
```

---

## 12. WebSocket

**Endpoint:** `ws://{ec2-ip}:8000/ws`  
**Connection:** Token passed as query param `?token={jwt_token}`

All messages share this envelope:

```json
{
  "type": "STRING",
  "call_id": "uuid or null",
  "timestamp": "ISO8601",
  "payload": {}
}
```

### Event Types in Order

| Event | When fired | Key payload fields |
|---|---|---|
| CONNECTION_ACK | On WebSocket connect | connection_id |
| CALL_RECEIVED | Pipeline starts | status, gps |
| TRANSCRIPTION_READY | ASR + translate complete | detected_language, transcription_original, transcription_translated |
| TRIAGE_COMPLETE | Bedrock returns | severity, call_classification, is_prank, incident_type, confidence |
| LOCATION_RESOLVED | AWS Location returns | landmark_name, directions_narrative, map_pin |
| BRIEF_READY | Full pipeline complete | All fields merged: triage + location + first_aid_audio_url + pipeline_duration_seconds |
| SNS_ALERT_SENT | CRITICAL SNS fired | alert_type, message_preview |
| ERROR | Any step fails | code, message, recoverable |

Push one event after each step. Do not wait until the end to push everything at once. The dashboard renders incrementally.

---

## 13. Bedrock Triage System Prompt

Use this exact system prompt for the Bedrock triage call. Do not summarise or shorten it.

```
You are an emergency call triage AI for Ghana's 112 emergency dispatch system.

You will receive a transcribed and translated emergency call in English. Analyse it and classify it.

You must respond with ONLY valid JSON. No preamble. No explanation. No markdown code blocks. Just the raw JSON object. If your response cannot be parsed as JSON, it is wrong.

WHO BASIC EMERGENCY CARE FIRST-AID PROTOCOLS:

Cardiac arrest: Tell the caller to lay the person flat on a firm surface. Tilt the head back to open the airway. Check if breathing. If not breathing: begin CPR — 30 chest compressions hard and fast, then 2 rescue breaths. Repeat until help arrives.

Choking adult: Ask if they can cough or speak. If yes, encourage coughing. If no: stand behind them, give 5 firm back blows between shoulder blades. Then 5 abdominal thrusts (Heimlich). Repeat until object dislodges or person loses consciousness.

Severe bleeding: Press firmly on the wound with a clean cloth. Do not lift the cloth. If limb, elevate above heart level. Maintain pressure until help arrives.

Burns: Remove from heat source. Cool under clean running water for 20 minutes. Do not use ice, butter, toothpaste, or any substance. Cover loosely with clean cloth.

Fracture: Do not try to straighten. Immobilise in position found. Support above and below the injury. Do not give food or water.

Drowning: Remove from water safely. Check breathing. If not breathing: tilt head back, give 5 rescue breaths, then begin CPR 30:2. Continue until help arrives.

Fire: Get everyone out immediately. Stay low under smoke. Do not use lifts. Close doors behind you. Once outside, call 112. Do not go back in.

Stroke: Use FAST — Face drooping on one side, Arm weakness when raised, Speech slurred or confused, Time to call 112 immediately. Lay person down, do not give food or water.

Seizure: Do not restrain. Clear the area of dangerous objects. Time the seizure. Do not put anything in mouth. When seizure ends, place in recovery position on their side.

Poisoning: Do not induce vomiting unless instructed by medical professional. Identify substance if safely possible. Keep calm. Call 112.

Snake bite: Keep person still, immobilise bitten limb below heart level. Remove jewellery near bite. Do not cut, suck, or apply tourniquet. Get to hospital immediately.

Allergic reaction: If person has epinephrine auto-injector, use it immediately on outer thigh. Lay person flat with legs raised unless difficulty breathing. Call 112.

Road accident: Do not move injured person unless in immediate danger. Turn off vehicle engine. Check consciousness. Control bleeding with pressure. Keep person warm and still.

Respond with exactly this JSON structure and no other text:
{
  "severity": "CRITICAL or URGENT or NON_EMERGENCY",
  "call_classification": "REAL_EMERGENCY or PRANK or UNCERTAIN",
  "incident_type": "short description of incident or null if prank",
  "is_prank": true or false,
  "prank_confidence": 0.0 to 1.0,
  "confidence": 0.0 to 1.0,
  "first_aid_script": "step by step first-aid instructions in English, null if prank",
  "first_aid_script_translated": "same instructions in the caller language specified below, null if prank or English",
  "dispatcher_brief": "one concise paragraph for the dispatcher — severity, incident, location hint, action",
  "recommended_response_unit": "AMBULANCE or FIRE or POLICE or NONE"
}

SEVERITY RULES:
CRITICAL — immediate risk of death: cardiac arrest, severe trauma, drowning, fire with people trapped, choking with loss of consciousness, major road accident with injuries, snake bite.
URGENT — serious but stable: fractures, moderate bleeding, burns under 10% body, breathing difficulty, stroke symptoms, seizure.
NON_EMERGENCY — minor or unclear: small cuts, mild pain, non-urgent queries, accidental calls, unclear audio.
PRANK — clear indicators: caller laughing, speaking nonsense, children playing, deliberate fake distress, singing, making sounds with friends in background, repeated testing.

When in doubt between CRITICAL and URGENT, choose CRITICAL. A wrong URGENT is better than a missed CRITICAL.
```

**User message format:**
```
Emergency call transcription (English): {english_text}
Original language: {language}
Caller GPS: {gps_lat}, {gps_lon}
Service requested: {service_type}

Classify this call.
```

---

## 14. Environment Variables

```bash
# Khaya API (GhanaNLP)
KHAYA_API_KEY=

# AWS Core
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET_NAME=nkwa-audio

# DynamoDB Table Names
DYNAMO_CALLS_TABLE=nkwa-calls
DYNAMO_USERS_TABLE=nkwa-users
DYNAMO_CONTACTS_TABLE=nkwa-contacts
DYNAMO_CACHE_TABLE=nkwa-cache
DYNAMO_FIRSTAID_TABLE=nkwa-first-aid

# Amazon Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Amazon Transcribe (English ASR)
TRANSCRIBE_LANGUAGE_CODE=en-US

# Amazon Polly (English TTS)
POLLY_VOICE_ID=Joanna
POLLY_OUTPUT_FORMAT=mp3
POLLY_ENGINE=neural

# Amazon SNS
SNS_ALERT_TOPIC_ARN=
SNS_DEMO_PHONE=+233XXXXXXXXX

# JWT Auth
JWT_SECRET=
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# AWS Location Service
LOCATION_INDEX_NAME=nkwa-place-index

# Server
PORT=8000
HOST=0.0.0.0

# Development
USE_MOCK=false
```

---

## 15. Simulator GPS Coordinates

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

## 16. Simulated Scenarios

### 15 Emergency Scenarios
cardiac arrest, road accident with injuries, drowning, structure fire with people inside, assault with injuries, adult choking, severe bleeding, bone fracture, stroke, accidental poisoning, severe burns, emergency childbirth, snake bite, severe allergic reaction, electrocution.

### 10 Prank Scripts
caller laughing throughout, random nonsense words, children playing, completely silent call, repeated fake distress sounds, deliberate wrong number, exaggerated fake emergency acting, background noise only with no speech, someone singing, group of friends screaming as a joke.

### Languages
Twi (`tw`) and Ewe (`ee`) for local language scenarios. English (`en`) for English scenarios. Mix all three for a realistic demo.

---

## 17. The 5 Pipeline Scenarios

**CRITICAL:** Bedrock returns severity CRITICAL, is_prank false. Full pipeline runs. SNS fires. Call appears at top of dispatcher feed in red. First-aid audio plays to caller. Pipeline time shown on card.

**URGENT:** Bedrock returns severity URGENT, is_prank false. Full pipeline runs. No SNS. Call appears mid-feed in amber.

**NON_EMERGENCY:** Bedrock returns severity NON_EMERGENCY, is_prank false. Full pipeline runs. No SNS. Call appears bottom of feed in green. recommended_response_unit is NONE.

**PRANK:** Bedrock returns is_prank true. Pipeline stops after triage step. No TTS, no Location, no SNS. Call goes to prank queue on dashboard — not main feed. Three Khaya credits saved per prank call caught.

**FAILURE:** Any step throws an exception. Retry once. If still failing: write FAILED record to DynamoDB with failure_stage field set, push ERROR WebSocket event, return HTTP 500. Never fail silently.

---

## 18. Team Structure

| Person | Role | Owns |
|---|---|---|
| Courage + Etornam | AI/ML + Backend | FastAPI backend, speech_client.py, bedrock_client.py, simulator |
| Gregory | Mobile Dev | Flutter caller app |
| Frontend Dev | Frontend | React dispatcher dashboard + React web caller platform |
| Infrastructure | Infra + Security | EC2, VPC, IAM, GuardDuty, CloudTrail |
| Roland Mawuli | Cloud | Service provisioning, CloudWatch, SNS wiring, DynamoDB setup |
| Non-technical | Strategy | Research, demo coordination, presentation prep |

---

## 19. Demo Flow (8 Minutes)

1. Open dispatcher dashboard — empty, live WebSocket connected
2. Trigger a prank call from simulator — watch it route to prank queue automatically
3. Trigger a CRITICAL Twi emergency (cardiac arrest near Accra Mall)
4. Dashboard updates incrementally — transcription, severity badge, map pin, full brief
5. First-aid audio plays to caller in Twi
6. SNS fires to demo phone — show the SMS received
7. Point out pipeline_duration_seconds on the call card
8. Total: under 30 seconds from call to complete brief

---

## 20. Critical Constraints

- **Khaya limit:** 100 requests total per month. English calls never touch Khaya. Cache all local language responses. Pre-generate demo audio before presentation day.
- **AWS account:** Terminates 72 hours after June 23 noon. Everything must be built and demo-ready by June 25 10pm.
- **Bedrock models:** Only enable claude-3-5-sonnet. Do not enable other models.
- **Branch protection:** Nobody pushes directly to main. Feature branches only. One PR per feature.
- **Secrets:** Never commit .env. All credentials in environment variables.
- **Bedrock prompt:** The single most important piece of code. The entire triage outcome depends on it. Write it carefully, test it against all 5 scenarios before the build window opens.
- **Pre-cache for demo:** Run all 15 emergency and 10 prank scenarios through the pipeline before June 27 presentations. Store results in DynamoDB. Demo pulls from cache. No live Khaya calls during the demo.
- **USE_MOCK=true** during local development. Only set false for integration testing.
- **CORS:** Set to allow all origins for the hackathon. Do not restrict.

---

## 21. Limitations to Acknowledge to Judges

- Khaya ASR accuracy varies by speaker and audio quality. Demo uses pre-recorded clean audio clips.
- Nkwa is a decision support tool, not a diagnostic system. It surfaces vetted first-aid protocols. It never diagnoses.
- Real 112 integration is the post-hackathon roadmap. This is a prototype.
- Google and Apple OAuth shown in the mobile UI is not implemented. Email + password + OTP is used instead.
- Streaming transcription is not implemented. Short audio clips are sent as complete files.
- Judges respect honesty about limitations more than overclaiming.
