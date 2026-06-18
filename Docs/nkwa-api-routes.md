# Nkwa — API Routes Reference

**Version:** 1.0  
**Base URL:** `http://<ec2-ip>:8000/api/v1`  
**Auth:** JWT Bearer token on all protected routes  
`Authorization: Bearer <token>`

---

## Table of Contents

1. [Caller App Routes (Flutter)](#1-caller-app-routes-flutter)
2. [Dispatcher Dashboard Routes (React)](#2-dispatcher-dashboard-routes-react)
3. [Backend Routes (FastAPI)](#3-backend-routes-fastapi)
4. [WebSocket](#4-websocket)
5. [Route-to-Screen Map](#5-route-to-screen-map)

---

## 1. Caller App Routes (Flutter)

Derived directly from the UI screens.

---

### Auth

#### `POST /auth/register`
**Screen:** Create Account (pages 4–5)  
**Called when:** User taps "Create account"

Request body:
```json
{
  "full_name": "Ama Boateng",
  "email": "ama.boateng@email.com",
  "phone": "+233241112222",
  "region": "Greater Accra",
  "home_address": "Near Accra Mall, Spintex",
  "password": "securepassword"
}
```

Response `201`:
```json
{
  "user_id": "uuid",
  "message": "OTP sent to phone"
}
```

---

#### `POST /auth/verify-otp`
**Screen:** OTP verification (page 8)  
**Called when:** User taps "Verify"

Request body:
```json
{
  "phone": "+233241112222",
  "otp": "361234"
}
```

Response `200`:
```json
{
  "token": "jwt_token_here",
  "user": { "user_id": "uuid", "full_name": "Ama Boateng" }
}
```

---

#### `POST /auth/resend-otp`
**Screen:** OTP screen — "Resend in 0:27" link  
**Called when:** User taps Resend

Request body:
```json
{ "phone": "+233241112222" }
```

Response `200`:
```json
{ "message": "OTP resent" }
```

---

#### `POST /auth/login`
**Screen:** Sign In (page 7)  
**Called when:** User taps "Sign in"

Request body:
```json
{
  "email": "ama.boateng@email.com",
  "password": "securepassword"
}
```

Response `200`:
```json
{
  "token": "jwt_token_here",
  "user": { "user_id": "uuid", "full_name": "Ama Boateng", "region": "Greater Accra" }
}
```

---

### User Profile

#### `GET /users/me` 🔒
**Screen:** Home profile card, Settings (pages 12, 19)  
**Called when:** App loads home screen

Response `200`:
```json
{
  "user_id": "uuid",
  "full_name": "Ama Boateng",
  "email": "ama.boateng@email.com",
  "phone": "+233241112222",
  "region": "Greater Accra",
  "home_address": "Near Accra Mall, Spintex",
  "nkwa_id": "GA-123-4567"
}
```

---

#### `PATCH /users/me` 🔒
**Screen:** Settings → Edit profile (page 19)  
**Called when:** User saves profile edits

Request body (any subset of fields):
```json
{
  "full_name": "Ama Boateng",
  "phone": "+233241112222",
  "region": "Greater Accra",
  "home_address": "Near Accra Mall, Spintex"
}
```

Response `200`:
```json
{ "message": "Profile updated" }
```

---

### Emergency Contacts (Safety Circle)

#### `GET /contacts` 🔒
**Screen:** Contacts tab (page 15)  
**Called when:** User opens Contacts tab

Response `200`:
```json
{
  "total": 6,
  "contacts": [
    {
      "contact_id": "uuid",
      "full_name": "Kofi Boateng",
      "relationship": "Father",
      "phone": "+233241112222",
      "email": "kofi.boateng@gmail.com",
      "notify": true
    }
  ]
}
```

---

#### `POST /contacts` 🔒
**Screen:** Add contact modal (pages 9–10)  
**Called when:** User taps "Add to my circle"

Request body:
```json
{
  "full_name": "Cyril Coder",
  "relationship": "Friend",
  "phone": "+233123456789",
  "email": "name@example.com"
}
```

Response `201`:
```json
{
  "contact_id": "uuid",
  "full_name": "Cyril Coder",
  "message": "Contact added to your circle"
}
```

---

#### `PATCH /contacts/:contact_id` 🔒
**Screen:** Contacts tab — edit icon (page 15)  
**Called when:** User saves contact edits

Request body (any subset):
```json
{
  "full_name": "Kofi Boateng",
  "notify": false
}
```

Response `200`:
```json
{ "message": "Contact updated" }
```

---

#### `DELETE /contacts/:contact_id` 🔒
**Screen:** Contacts tab — delete icon (page 15)  
**Called when:** User taps the red bin icon

Response `200`:
```json
{ "message": "Contact removed from circle" }
```

---

### Emergency Call

#### `POST /calls/initiate` 🔒
**Screen:** Service selection → language selection → "Tap to call" (pages 12, 17, 18)  
**Called when:** User taps the call button after selecting service and language

This is the most important caller-side endpoint. It triggers the entire Nkwa pipeline.

Request body:
```json
{
  "service_type": "AMBULANCE",
  "language": "twi",
  "gps_lat": 5.6362,
  "gps_lon": -0.1769,
  "audio_base64": "<base64 encoded audio>"
}
```

`service_type` values: `AMBULANCE`, `FIRE`, `POLICE`, `SOS`  
`language` values: `twi`, `ewe`, `dag`, `eng`

Response `202` (accepted, pipeline started):
```json
{
  "call_id": "uuid",
  "status": "PROCESSING",
  "message": "Your call is being processed"
}
```

Note for Gregory: the audio is recorded on device and sent as base64. The Flutter `record` package handles the recording. Keep clips short — 15 to 30 seconds maximum.

---

#### `POST /calls/:call_id/end` 🔒
**Screen:** Active call — "End call" button (pages 17, 21)  
**Called when:** User taps "End call"

Response `200`:
```json
{
  "call_id": "uuid",
  "status": "ENDED"
}
```

---

#### `GET /calls/:call_id/status` 🔒
**Screen:** Active call screen — polling for first-aid audio  
**Called when:** App polls every 3 seconds after initiating a call

Response `200`:
```json
{
  "call_id": "uuid",
  "status": "PROCESSING | FIRST_AID_READY | COMPLETE | FAILED",
  "first_aid_audio_url": "https://s3.../first_aid_twi_cardiac.mp3",
  "first_aid_text": "Gyae suro. Fa obi da no fam..."
}
```

When `first_aid_audio_url` is present, Flutter plays it automatically. This is how the caller receives first-aid guidance.

---

### SOS Alert

#### `POST /sos` 🔒
**Screen:** Home → SOS Alert tile (page 12)  
**Called when:** User taps "SOS Alert — Instant panic & alert dispatch"

This is the one-tap panic button. It does not initiate a voice call. It fires an SNS alert to all contacts with `notify: true` and sends the caller's GPS to the dispatcher dashboard immediately.

Request body:
```json
{
  "gps_lat": 5.6362,
  "gps_lon": -0.1769,
  "message": "SOS triggered"
}
```

Response `200`:
```json
{
  "sos_id": "uuid",
  "contacts_alerted": 3,
  "dispatcher_notified": true
}
```

---

### First Aid

#### `GET /first-aid` 🔒
**Screen:** First Aid tab — Offline guides (page 13)  
**Called when:** User opens First Aid tab

Response `200`:
```json
{
  "guides": [
    {
      "guide_id": "uuid",
      "title": "Choking (adult)",
      "category": "Airway emergency",
      "steps_count": 5,
      "offline_available": true
    }
  ]
}
```

---

#### `GET /first-aid/:guide_id` 🔒
**Screen:** First Aid guide detail (page 16 — Choking guide)  
**Called when:** User taps a guide

Response `200`:
```json
{
  "guide_id": "uuid",
  "title": "Choking (adult)",
  "category": "Airway emergency",
  "overview": "Choking occurs when a foreign object blocks the airway...",
  "steps": [
    {
      "step_number": 1,
      "title": "Ask if they can cough",
      "description": "If the person can speak, cough forcefully, or breathe, encourage them to keep coughing..."
    }
  ]
}
```

---

## 2. Dispatcher Dashboard Routes (React)

---

### Auth

#### `POST /auth/dispatcher/login`
**Called when:** Dispatcher logs into the dashboard

Request body:
```json
{
  "email": "dispatcher@nkwa.io",
  "password": "password"
}
```

Response `200`:
```json
{ "token": "jwt_token_here" }
```

---

### Calls Feed

#### `GET /calls` 🔒
**Called when:** Dashboard loads — populates the historical call list

Query params: `limit`, `offset`, `severity`, `classification`, `from`, `to`

Response `200`:
```json
{
  "total": 47,
  "results": [
    {
      "call_id": "uuid",
      "timestamp": "2025-06-17T14:32:01.000Z",
      "severity": "CRITICAL",
      "call_classification": "REAL_EMERGENCY",
      "incident_type_display": "Cardiac Arrest",
      "caller_language_display": "Asante Twi",
      "landmark_name": "Accra Mall",
      "pipeline_duration_seconds": 9.8
    }
  ]
}
```

---

#### `GET /calls/:call_id` 🔒
**Called when:** Dispatcher clicks a call card to expand it

Response `200`: Full call record (see WebSocket API spec for full shape)

---

#### `GET /calls/stats` 🔒
**Called when:** Dashboard loads — populates header metrics

Response `200`:
```json
{
  "total_calls_today": 47,
  "real_emergencies_today": 5,
  "pranks_filtered_today": 42,
  "avg_pipeline_duration_seconds": 11.3,
  "critical_active": 1
}
```

---

#### `GET /health`
**Called when:** Dashboard loads — checks backend is alive before connecting WebSocket

Response `200`:
```json
{ "status": "ok", "timestamp": "2025-06-17T14:32:00.000Z" }
```

---

## 3. Backend Routes (FastAPI)

What you are actually building in `main.py`. These are what all the above calls hit.

---

### Auth routes

```python
POST   /api/v1/auth/register          # Create user, send OTP via SNS
POST   /api/v1/auth/verify-otp        # Verify OTP, return JWT
POST   /api/v1/auth/resend-otp        # Resend OTP
POST   /api/v1/auth/login             # Email + password login, return JWT
POST   /api/v1/auth/dispatcher/login  # Dispatcher login
```

For the hackathon demo, skip full OAuth (Google/Apple shown in UI). Email + password + OTP is enough.

---

### User routes

```python
GET    /api/v1/users/me               # Get current user profile (from JWT)
PATCH  /api/v1/users/me               # Update profile
```

---

### Contacts routes

```python
GET    /api/v1/contacts               # List caller's emergency circle
POST   /api/v1/contacts               # Add contact to circle
PATCH  /api/v1/contacts/:id           # Edit contact
DELETE /api/v1/contacts/:id           # Remove contact
```

---

### Call pipeline route

```python
POST   /api/v1/calls/initiate         # THE main route — runs the full pipeline
GET    /api/v1/calls/:id/status       # Poll for first-aid audio URL
POST   /api/v1/calls/:id/end          # Mark call ended
GET    /api/v1/calls                  # Dispatcher: list all calls
GET    /api/v1/calls/:id              # Dispatcher: get full call record
GET    /api/v1/calls/stats            # Dispatcher: dashboard stats
```

The `POST /calls/initiate` route is where all the work happens:

```python
@app.post("/api/v1/calls/initiate")
async def initiate_call(payload: CallInitiateRequest, user=Depends(get_current_user)):
    call_id = str(uuid.uuid4())

    # 1. Decode and save audio to S3
    audio_bytes = base64.b64decode(payload.audio_base64)
    audio_key = await save_audio_to_s3(call_id, audio_bytes)

    # 2. Transcribe (Khaya ASR — cache first)
    transcription = await khaya_client.transcribe(audio_bytes, lang=payload.language)

    # 3. Translate to English (Khaya Translate — cache first)
    english_text = await khaya_client.translate(transcription, lang_pair=f"{payload.language}-eng")

    # 4. Triage via Bedrock
    triage = await run_bedrock_triage(english_text, payload.gps_lat, payload.gps_lon)

    # 5. Resolve location via AWS Location Service
    location = await resolve_location(payload.gps_lat, payload.gps_lon)

    # 6. Generate first-aid audio (Khaya TTS — cache first)
    audio_url = await khaya_client.synthesize(
        triage["first_aid_script_translated"],
        language=payload.language
    )

    # 7. Store full record in DynamoDB
    await save_call_record(call_id, user, triage, location, audio_url)

    # 8. Push BRIEF_READY to dispatcher dashboard via WebSocket
    await push_websocket_event("BRIEF_READY", call_id, triage, location)

    # 9. SNS alert if CRITICAL
    if triage["severity"] == "CRITICAL":
        await send_sns_alert(triage, location, user)

    return { "call_id": call_id, "status": "PROCESSING" }
```

---

### SOS route

```python
POST   /api/v1/sos                    # One-tap panic: SNS to contacts + WebSocket to dashboard
```

---

### First Aid routes

```python
GET    /api/v1/first-aid              # List all first-aid guides
GET    /api/v1/first-aid/:guide_id    # Get full guide with steps
```

These are static data. Pre-load them into DynamoDB from a JSON file. No external API calls.

---

### Health

```python
GET    /health                        # Returns {"status": "ok"}
```

---

## 4. WebSocket

```
wss://<ec2-ip>:8001
```

Run on a separate port from the REST API to keep concerns separated. FastAPI supports WebSockets natively.

Events the backend pushes to the dispatcher dashboard:

| Event | When |
|---|---|
| `CONNECTION_ACK` | On connect |
| `CALL_RECEIVED` | Call pipeline starts |
| `TRANSCRIPTION_READY` | ASR complete |
| `TRIAGE_COMPLETE` | Bedrock returns classification |
| `LOCATION_RESOLVED` | AWS Location returns landmark |
| `BRIEF_READY` | Full pipeline complete |
| `SNS_ALERT_SENT` | CRITICAL severity SNS fired |
| `ERROR` | Any pipeline step fails |

Full message schemas are in `nkwa-websocket-api-spec.md`.

---

## 5. Route-to-Screen Map

| Screen (page) | Method | Route |
|---|---|---|
| Splash (20) | — | No API call |
| Onboarding 1–4 (1, 2, 3, 6) | — | No API call |
| Create account (4–5) | POST | `/auth/register` |
| OTP verify (8) | POST | `/auth/verify-otp` |
| Sign in (7) | POST | `/auth/login` |
| Home (12) | GET | `/users/me` |
| Safety circle prompt (11) | — | Triggers Add contact flow |
| Add contact (9–10) | POST | `/contacts` |
| Contact added confirmation (14) | — | UI only, no new call |
| Contacts list (15) | GET | `/contacts` |
| Edit/delete contact (15) | PATCH / DELETE | `/contacts/:id` |
| Service selection (12) | — | UI only |
| Language selection (17) | — | UI only |
| Tap to call (18) | POST | `/calls/initiate` |
| Call active / placing (17, 21) | GET (poll) | `/calls/:id/status` |
| End call (17, 21) | POST | `/calls/:id/end` |
| SOS Alert (12) | POST | `/sos` |
| First Aid list (13) | GET | `/first-aid` |
| First Aid guide detail (16) | GET | `/first-aid/:guide_id` |
| Settings (19) | GET / PATCH | `/users/me` |

---

## Notes for Gregory (Flutter)

The two most important flows to build first are `/auth/register` + `/auth/verify-otp` (so you can log in) and `POST /calls/initiate` (the entire demo). Everything else is secondary.

The call flow from the UI is: Home → tap Ambulance → tap language → tap the call button → `POST /calls/initiate` fires → poll `GET /calls/:id/status` every 3 seconds until `first_aid_audio_url` appears → play audio → show "End call".

## Notes for Frontend Dev (React Dashboard)

On page load: call `GET /health` first, then connect WebSocket, then call `GET /calls` and `GET /calls/stats` to populate the feed and header metrics. From that point the WebSocket is the only source of truth for live incoming calls.
