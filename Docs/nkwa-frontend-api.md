# Nkwa — Frontend API Reference

**Base URL:** `http://54.218.53.26:8000`  
**Auth:** None — no token needed on any request.  
**CORS:** Open to all origins.

---

## APIs to implement

### 1. `POST /api/v1/calls/initiate`
Submits the emergency call. Runs the full pipeline (transcription → AI triage → location → first-aid audio) and returns when done.

**Request body:**
```json
{
  "service_type": "AMBULANCE",
  "language": "en",
  "gps_lat": 5.6037,
  "gps_lon": -0.1870,
  "audio_base64": "<base64 string>"
}
```

| Field | Accepted values |
|---|---|
| `service_type` | `AMBULANCE` · `FIRE` · `POLICE` |
| `language` | `en` · `tw` · `gaa` · `ee` |
| `audio_base64` | Base64-encoded WAV, MP3, FLAC, or OGG |

**Response `202`:**
```json
{
  "call_id": "uuid",
  "status": "PROCESSING"
}
```
> If the AI flags it as a prank: `"status": "PRANK_DETECTED"`.

---

### 2. `GET /api/v1/calls/{call_id}`
Fetches the full result after `initiate` returns. The pipeline is synchronous — the result is always ready by the time `initiate` responds, so no polling is needed.

**Response `200`:**
```json
{
  "call_id": "uuid",
  "status": "COMPLETE",
  "severity": "CRITICAL",
  "incident_type": "Cardiac arrest",
  "landmark_name": "Accra Mall, Spintex Road",
  "directions_narrative": "Caller is near Accra Mall, Spintex, Greater Accra.",
  "first_aid_script": "Stay calm. Lay the person flat...",
  "first_aid_audio_url": "https://nkwa-audio.s3.amazonaws.com/.../first_aid_en.mp3",
  "dispatcher_brief": "CRITICAL — Cardiac arrest near Accra Mall. Dispatch AMBULANCE immediately.",
  "is_prank": false
}
```

| `severity` | Badge colour |
|---|---|
| `CRITICAL` | Red |
| `URGENT` | Amber |
| `NON_EMERGENCY` | Green |

> For pranks: `status` is `"PRANK"`, most fields are `null`.

---

### 3. `POST /api/v1/calls/{call_id}/end`
Call this when the user dismisses the result screen. Marks the call as `ENDED` in the system.

**Request body:** `{}`  
**Response `200`:** `{ "message": "Call uuid ended" }`

---

### 4. `GET /health`
Check the backend is reachable on app load.

**Response `200`:** `{ "status": "ok", "timestamp": "..." }`

---

## APIs not needed for the caller flow

These exist on the backend but are either for the dispatcher dashboard, bypassed for the MVP, or not part of the caller screen flow.

| Endpoint | Reason not needed |
|---|---|
| `GET /api/v1/calls/{id}/status` | Pipeline is synchronous — `GET /calls/{id}` is enough |
| `GET /api/v1/calls` | Dispatcher dashboard only |
| `GET /api/v1/calls/stats` | Dispatcher dashboard only |
| `GET /api/v1/first-aid` | Not in current caller flow |
| `GET /api/v1/first-aid/{id}` | Not in current caller flow |
| All `/auth/*` routes | Bypassed for MVP — no login needed |
| All `/users/*` routes | Bypassed for MVP |
| All `/contacts/*` routes | Bypassed for MVP |
| `POST /api/v1/sos` | Bypassed for MVP — returns 503 |

---

## Important notes

**Audio format and Chrome**  
Chrome's `MediaRecorder` records in WebM by default. WebM works for English calls but **fails for local languages** (Khaya ASR only accepts WAV, MP3, FLAC, OGG). For Twi/Ga/Ewe demos, use Firefox — it records in OGG which the backend accepts.

**No geolocation?**  
If the user denies location access, send `"gps_lat": 0, "gps_lon": 0`. The backend handles it gracefully.

**First-aid audio**  
`first_aid_audio_url` is a public S3 link — drop it straight into `<audio src="...">`, no headers needed. It may be `null` for non-emergency classifications.

**Expected wait time**  
`initiate` takes 10–25 seconds to respond. Always show a loading state.
