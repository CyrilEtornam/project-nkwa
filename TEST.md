# Nkwa — Test Guide

Run these tests from your local machine against the live EC2 server. All commands use Python 3 (no extra packages needed).

**EC2 server:** `http://54.218.53.26:8000`  
**Test audio directory:** `project-nkwa/test-audio/`

---

## Quick sanity check

```bash
curl http://54.218.53.26:8000/health
```
Expected: `{"status":"ok","timestamp":"..."}`

---

## How to send a test call

All pipeline tests use this Python helper. Save it as `send_call.py` inside `test-audio/`:

```python
# test-audio/send_call.py
import base64, json, sys, urllib.request

EC2 = "http://54.218.53.26:8000"

def send_call(audio_file, language, service_type="AMBULANCE", gps_lat=5.6037, gps_lon=-0.1870):
    audio = base64.b64encode(open(audio_file, "rb").read()).decode()
    body = json.dumps({
        "service_type": service_type,
        "language": language,
        "gps_lat": gps_lat,
        "gps_lon": gps_lon,
        "audio_base64": audio,
    }).encode()
    req = urllib.request.Request(
        f"{EC2}/api/v1/calls/initiate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            result = json.loads(r.read())
            print(json.dumps(result, indent=2))
            return result
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        print(f"ERROR {e.code}:", json.dumps(err, indent=2))

if __name__ == "__main__":
    audio_file = sys.argv[1]
    language   = sys.argv[2]
    service    = sys.argv[3] if len(sys.argv) > 3 else "AMBULANCE"
    send_call(audio_file, language, service)
```

---

## Scenario 1 — English Fire (CRITICAL) ✅ already confirmed working

```bash
cd test-audio
python3 send_call.py English/fireTestEnglish.mp3 en FIRE
```

**What to verify:**
- HTTP 202 with `call_id` and `first_aid_audio_url`
- Bedrock triage runs (`severity: CRITICAL`, `call_classification: REAL_EMERGENCY`)
- `first_aid_audio_url` points to an S3 URL ending in `.mp3`
- The MP3 URL is publicly accessible (paste it in a browser — it should play or download)

---

## Scenario 2 — English Medical Emergency (CRITICAL/URGENT)

```bash
python3 send_call.py English/medicalTestEnglish.mp3 en AMBULANCE
```

**What to verify:**
- `severity` is `CRITICAL` or `URGENT`
- `first_aid_script` in the full call record matches a cardiac/bleeding/medical protocol
- `recommended_response_unit` is `AMBULANCE`

Check the full call record:
```bash
# Replace CALL_ID with the call_id from the response above
python3 -c "
import json, urllib.request
r = urllib.request.urlopen('http://54.218.53.26:8000/api/v1/calls/CALL_ID')
print(json.dumps(json.loads(r.read()), indent=2))
"
```

---

## Scenario 3 — English Prank Call (PRANK)

```bash
python3 send_call.py English/prankTestEnglish.mp3 en AMBULANCE
```

**What to verify:**
- `status` is `PRANK_DETECTED`
- No `first_aid_audio_url` (pipeline short-circuits, no TTS generated)
- No S3 MP3 file created (Khaya credits saved)
- Call record in DynamoDB has `status: PRANK`, `is_prank: true`

---

## Scenario 4 — Ewe Fire Emergency (LOCAL LANGUAGE — tests Khaya)

> This is the critical local-language test. It exercises: Khaya ASR (`ee`) → Khaya Translation (`ee-en`) → Bedrock triage → Khaya TTS (`ee`) → S3.

```bash
python3 send_call.py Ewe/fireTestEwe.mp3 ee FIRE
```

**What to verify:**
- HTTP 202 (not 500)
- `transcription_original` in the call record contains Ewe text
- `transcription_translated` contains English
- `first_aid_audio_url` exists and points to `first_aid_ee.mp3`
- The MP3 plays audio in Ewe

If you get a Khaya 401 error: your `KHAYA_API_KEY` in `.env` on EC2 is wrong or expired.  
If you get a Khaya 429: you've hit the 100-request monthly limit.

---

## Scenario 5 — Twi Emergency (LOCAL LANGUAGE — tests Khaya)

```bash
python3 send_call.py Twi/khayaTestTwi.mp3 tw AMBULANCE
```

**What to verify:**
- Same checks as Ewe above
- `first_aid_audio_url` ends in `first_aid_tw.mp3`
- Twi audio plays correctly

---

## Scenario 6 — OGG Format (audio format detection)

> Tests that the magic-byte format detector correctly identifies OGG and sends `Content-Type: audio/ogg` to Khaya ASR.

```bash
python3 send_call.py Twi/test2.ogg tw AMBULANCE
```

**What to verify:**
- HTTP 202 (not 500)
- No `INVALID_AUDIO_FORMAT` error from Khaya
- Call record saved with the audio at `calls/{call_id}/audio.ogg`

---

## Scenario 7 — FLAC Format (audio format detection)

```bash
python3 send_call.py Twi/test3.flac tw AMBULANCE
```

**What to verify:**
- HTTP 202 (not 500)
- Audio stored at `calls/{call_id}/audio.flac`

---

## Scenario 8 — Stats & Dashboard Data

```bash
python3 -c "
import json, urllib.request
r = urllib.request.urlopen('http://54.218.53.26:8000/api/v1/calls/stats')
print(json.dumps(json.loads(r.read()), indent=2))
"
```

**What to verify:**
- `total_calls_today` matches the number of calls you've sent
- `pranks_filtered_today` ≥ 1 (if you ran Scenario 3)
- `real_emergencies_today` = total − pranks
- `critical_active` > 0
- `avg_pipeline_duration_seconds` is a reasonable number (< 30 seconds)

---

## Scenario 9 — Call List (Dispatcher View)

```bash
# All calls
python3 -c "
import json, urllib.request
r = urllib.request.urlopen('http://54.218.53.26:8000/api/v1/calls?limit=10')
data = json.loads(r.read())
print(f'Total calls: {data[\"total\"]}')
for c in data['results']:
    print(f'  {c[\"call_id\"][:8]}  lang={c.get(\"language\")}  severity={c.get(\"severity\")}  status={c[\"status\"]}')
"

# Filter CRITICAL only
python3 -c "
import json, urllib.request
r = urllib.request.urlopen('http://54.218.53.26:8000/api/v1/calls?severity=CRITICAL')
data = json.loads(r.read())
print(f'CRITICAL calls: {data[\"total\"]}')
"
```

---

## Scenario 10 — End a Call

```bash
# Replace CALL_ID with any call_id from earlier tests
python3 -c "
import json, urllib.request
req = urllib.request.Request(
    'http://54.218.53.26:8000/api/v1/calls/CALL_ID/end',
    data=b'{}',
    headers={'Content-Type': 'application/json'},
    method='POST'
)
r = urllib.request.urlopen(req)
print(json.loads(r.read()))
"
```

**What to verify:**
- `{"message": "Call CALL_ID ended"}`
- Re-fetching the call detail shows `status: ENDED`

---

## Scenario 11 — First Aid Guides

```bash
# List all guides
python3 -c "
import json, urllib.request
r = urllib.request.urlopen('http://54.218.53.26:8000/api/v1/first-aid')
data = json.loads(r.read())
for g in data.get('guides', []):
    print(f'  {g[\"guide_id\"]}  {g[\"title\"]}')
"

# Get one guide with full steps
python3 -c "
import json, urllib.request
r = urllib.request.urlopen('http://54.218.53.26:8000/api/v1/first-aid/fa-001')
print(json.dumps(json.loads(r.read()), indent=2))
"
```

**What to verify:**
- 12 guides listed
- Guide `fa-001` is Cardiac Arrest with 5 steps

---

## Scenario 12 — WebSocket (Dispatcher Feed)

Open your browser console on any page and paste this:

```javascript
const ws = new WebSocket("ws://54.218.53.26:8000/ws");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onopen = () => ws.send(JSON.stringify({ type: "PING" }));
```

Then in another tab, send a test call (Scenario 1). In the console you should see events arriving in order:
```
CONNECTION_ACK
CALL_RECEIVED
TRANSCRIPTION_READY
TRIAGE_COMPLETE
LOCATION_RESOLVED
BRIEF_READY
SNS_ALERT_SENT   ← only if severity is CRITICAL and SNS is enabled
```

> Note: WebSocket broadcast is currently bypassed in the codebase (`ws_manager.py`). The connection itself works and PING/PONG works, but live pipeline events won't appear until the WebSocket feature is re-enabled.

---

## All-in-one test runner

Save this as `test-audio/run_all_tests.py` and run it from the `test-audio/` directory:

```python
import base64, json, urllib.request, time

EC2 = "http://54.218.53.26:8000"
PASS = "✓"
FAIL = "✗"

def call(audio_file, language, service_type="AMBULANCE"):
    audio = base64.b64encode(open(audio_file, "rb").read()).decode()
    body = json.dumps({
        "service_type": service_type, "language": language,
        "gps_lat": 5.6037, "gps_lon": -0.1870, "audio_base64": audio,
    }).encode()
    req = urllib.request.Request(
        f"{EC2}/api/v1/calls/initiate", data=body,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

results = []

tests = [
    ("EN fire (CRITICAL)",    "English/fireTestEnglish.mp3",  "en",  "FIRE",      202),
    ("EN medical (CRITICAL)", "English/medicalTestEnglish.mp3","en", "AMBULANCE", 202),
    ("EN prank (PRANK)",      "English/prankTestEnglish.mp3", "en",  "AMBULANCE", 202),
    ("EWE fire (CRITICAL)",   "Ewe/fireTestEwe.mp3",          "ee",  "FIRE",      202),
    ("TWI call (CRITICAL)",   "Twi/khayaTestTwi.mp3",         "tw",  "AMBULANCE", 202),
    ("TWI OGG format",        "Twi/test2.ogg",                "tw",  "AMBULANCE", 202),
    ("TWI FLAC format",       "Twi/test3.flac",               "tw",  "AMBULANCE", 202),
]

print(f"\n{'─'*65}")
print(f"  Nkwa Pipeline Tests  →  {EC2}")
print(f"{'─'*65}")

for name, audio, lang, svc, expected_status in tests:
    t0 = time.time()
    status, resp = call(audio, lang, svc)
    elapsed = time.time() - t0
    ok = status == expected_status
    call_id = resp.get("call_id", "")
    triage   = resp.get("status", resp.get("detail", "—"))
    url      = "✓ url" if resp.get("first_aid_audio_url") else "no url"
    icon = PASS if ok else FAIL
    print(f"  {icon}  {name:28}  [{status}]  {triage:18}  {url}  ({elapsed:.1f}s)")
    results.append((name, ok, elapsed, resp))

print(f"{'─'*65}")
passed = sum(1 for _, ok, _, _ in results if ok)
total  = len(results)

# Stats
try:
    r = urllib.request.urlopen(f"{EC2}/api/v1/calls/stats", timeout=10)
    stats = json.loads(r.read())
    print(f"\n  Stats today:  total={stats['total_calls_today']}  "
          f"emergencies={stats['real_emergencies_today']}  "
          f"pranks={stats['pranks_filtered_today']}  "
          f"avg_time={stats['avg_pipeline_duration_seconds']}s")
except Exception as e:
    print(f"\n  Stats: could not fetch ({e})")

print(f"\n  Result: {passed}/{total} passed")
print(f"{'─'*65}\n")
```

Run it:
```bash
cd test-audio
python3 run_all_tests.py
```

---

## Expected results summary

| Scenario | Language | Expected status | Khaya used |
|---|---|---|---|
| Fire emergency | `en` | PROCESSING (CRITICAL) | No |
| Medical emergency | `en` | PROCESSING (CRITICAL/URGENT) | No |
| Prank call | `en` | PRANK_DETECTED | No |
| Fire emergency | `ee` (Ewe) | PROCESSING (CRITICAL) | ASR + Translation + TTS |
| Emergency call | `tw` (Twi) | PROCESSING (CRITICAL) | ASR + Translation + TTS |
| OGG format | `tw` | PROCESSING | ASR + Translation + TTS |
| FLAC format | `tw` | PROCESSING | ASR + Translation + TTS |

---

## Troubleshooting

**`500 Pipeline failed at TRANSCRIBE`**  
→ Check that the S3 bucket IAM role has `AmazonTranscribeFullAccess`

**`500 Pipeline failed at TRIAGE: ValidationException`**  
→ The Bedrock model ID is wrong. Make sure `.env` has `BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-6`

**`500 Pipeline failed at AUDIO_UPLOAD: AccessControlListNotSupported`**  
→ S3 bucket needs ACLs enabled: Permissions tab → Object Ownership → ACLs enabled

**Khaya `401 Unauthorized`**  
→ `KHAYA_API_KEY` in `.env` on EC2 is wrong or expired

**Khaya `429 Too Many Requests`**  
→ You've hit the 100-request monthly limit. Switch to `USE_MOCK=true` for further testing and save remaining credits for the demo

**`first_aid_audio_url` exists but audio doesn't play**  
→ Check S3 bucket policy allows `s3:GetObject` on `calls/*/first_aid_*.mp3`

**Local-language audio returns garbled or empty transcription**  
→ The test audio file may not be recorded clearly. Try recording a short phrase ("There is a fire") in Twi/Ewe at normal speaking pace, re-encode to MP3, and retry.
