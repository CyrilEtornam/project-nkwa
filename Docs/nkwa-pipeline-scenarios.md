# Nkwa — Pipeline Scenarios (Plain English)

Every possible path a call can take through the Nkwa backend, explained simply.

---

## The 5 Scenarios

| #   | What happens                   | Severity         | Dispatcher sees                      |
| --- | ------------------------------ | ---------------- | ------------------------------------ |
| 1   | Real emergency — CRITICAL      | 🔴 CRITICAL      | Full brief, map pin, SNS alert fires |
| 2   | Real emergency — URGENT        | 🟡 URGENT        | Full brief, map pin, no SNS          |
| 3   | Real emergency — NON-EMERGENCY | 🟢 NON-EMERGENCY | Full brief, map pin, no SNS          |
| 4   | Prank call detected            | ⚫ PRANK          | Routed to prank queue, not main feed |
| 5   | Pipeline fails mid-way         | ❌ ERROR          | Error card shown, call marked failed |

---

## Scenario 1 — Real Emergency, CRITICAL 🔴

> **Example:** Caller speaks Twi. "Me nua atɔ ase, na onnhome yiye." (My brother fell and is not breathing well.)

This is the main demo scenario. Everything fires.

**Step 1 — App sends the call**

The caller taps "Ambulance", picks Twi, taps the call button. The Flutter app records their voice, encodes it, and sends it to the backend along with their GPS coordinates.

**Step 2 — Audio is saved**

The backend receives the audio and saves it to S3. Think of S3 as a filing cabinet in the cloud. The audio sits there while everything else runs.

**Step 3 — Transcription**

The backend checks DynamoDB first: has this exact audio been transcribed before? If yes, it reads the saved result. If no, it sends the audio to Khaya ASR. Khaya listens and returns:

```
"Me nua atɔ ase, na onnhome yiye"
```

**Step 4 — Translation**

The backend checks DynamoDB again. Cache miss, so it sends the Twi text to Khaya Translation. Khaya returns:

```
"My brother fell and he is not breathing well"
```

**Step 5 — Bedrock triage**

The English text goes to Amazon Bedrock (Claude). The backend asks Claude:

> "Someone called and said: my brother fell and is not breathing well. How serious is this? Is it a prank? What type of emergency? What first-aid steps should the caller follow right now? Write me a brief for the dispatcher."

Claude reads it and responds with structured JSON:

```json
{
  "severity": "CRITICAL",
  "call_classification": "REAL_EMERGENCY",
  "incident_type": "Cardiac arrest",
  "is_prank": false,
  "confidence": 0.94,
  "first_aid_script": "Stay calm. Lay the person flat on a firm surface...",
  "first_aid_script_twi": "Gyae suro. Fa obi da no fam...",
  "dispatcher_brief": "CRITICAL — Cardiac arrest. Caller speaking Twi. Dispatch AMBULANCE immediately.",
  "recommended_response_unit": "AMBULANCE"
}
```

**Step 6 — Location resolution**

At the same time as Step 5, the backend sends the GPS coordinates to AWS Location Service. It asks: "What is near these coordinates?" AWS Location responds:

```
150 metres east of Accra Mall, near Total filling station, Spintex Road
```

**Step 7 — First-aid audio**

The backend takes the Twi first-aid script from Claude and sends it to Khaya TTS. Khaya reads it out in a female Twi voice and returns an MP3 file. The backend saves that MP3 to S3 and stores the link.

**Step 8 — Everything saved**

The full call record is written to DynamoDB: transcription, translation, severity, incident type, location, first-aid audio URL, dispatcher brief, and timestamps for every step.

**Step 9 — Dispatcher dashboard updates**

The backend sends a `BRIEF_READY` WebSocket message to the dispatcher dashboard. The call card appears on screen in real time showing:

- 🔴 CRITICAL badge
- Incident type: Cardiac Arrest
- Location: 150m east of Accra Mall
- Map pin dropped on the correct spot
- Dispatcher brief text
- Timeline showing every step and how long it took

**Step 10 — SNS alert fires**

Because severity is CRITICAL, the backend triggers SNS. An SMS is sent to the demo phone number:

```
CRITICAL — Cardiac arrest near Accra Mall, Spintex Road. Dispatch AMBULANCE immediately.
```

**Step 11 — First-aid plays to caller**

The Flutter app receives the audio URL in the call status poll response. It plays the Twi first-aid audio automatically to the caller while help is on the way.

```
CRITICAL path complete. Total time: under 30 seconds.
```

---

## Scenario 2 — Real Emergency, URGENT 🟡

> **Example:** Caller speaks Ewe. "Ame aɖe wọ ati si, na asi ne wòɖo le afime." (Someone broke their arm in a fall at home.)

The pipeline runs identically to Scenario 1 up to the Bedrock step. The difference is what Claude returns.

**Where it diverges — Bedrock triage**

Claude reads the translated text and classifies it as non-life-threatening but serious:

```json
{
  "severity": "URGENT",
  "call_classification": "REAL_EMERGENCY",
  "incident_type": "Fracture",
  "is_prank": false,
  "recommended_response_unit": "AMBULANCE",
  "first_aid_script": "Keep the injured arm still. Do not try to straighten it..."
}
```

**What is different from Scenario 1**

- The dispatcher dashboard shows an 🟡 URGENT badge instead of red
- The call card appears mid-feed, not at the top
- No audio alert plays on the dashboard
- SNS does NOT fire — URGENT does not trigger the ambulance SMS
- First-aid audio still plays to the caller in Ewe
- Everything else is identical

```
URGENT path complete. Same pipeline, no SNS.
```

---

## Scenario 3 — Real Emergency, NON-EMERGENCY 🟢

> **Example:** Caller speaks English. "I cut my finger while cooking. It's bleeding a little but I'm okay."

Same pipeline again. The difference is entirely in what Claude returns.

**Where it diverges — Bedrock triage**

Claude reads the translation and classifies it as minor:

```json
{
  "severity": "NON_EMERGENCY",
  "call_classification": "REAL_EMERGENCY",
  "incident_type": "Minor laceration",
  "is_prank": false,
  "recommended_response_unit": "NONE",
  "first_aid_script": "Rinse the cut under clean running water for 5 minutes. Apply pressure with a clean cloth..."
}
```

**What is different**

- Dashboard shows a 🟢 NON-EMERGENCY badge
- Call card sits at the bottom of the feed, below CRITICAL and URGENT calls
- No dashboard alert, no SNS
- `recommended_response_unit` is NONE — the dispatcher may choose not to dispatch anything
- First-aid audio still plays to the caller (they still need guidance)
- Full record still saved to DynamoDB

```
NON-EMERGENCY path complete. Pipeline runs fully, nothing dispatched.
```

---

## Scenario 4 — Prank Call Detected ⚫

> **Example:** Caller speaks Twi. Laughing. Saying random nonsense or making fake distress sounds with friends in the background.

This is the most important scenario for the judges to see because it directly addresses the 90% prank call problem.

**Step 1 to 4 — Identical**

Audio comes in, gets transcribed, gets translated. The pipeline does not know it is a prank yet.

**Step 5 — Bedrock triage catches it**

Claude reads the translated text and the patterns in the language. It classifies it as a prank:

```json
{
  "severity": "NON_EMERGENCY",
  "call_classification": "PRANK",
  "incident_type": null,
  "is_prank": true,
  "prank_confidence": 0.91,
  "recommended_response_unit": "NONE",
  "first_aid_script": null,
  "dispatcher_brief": "Likely prank call. Caller was laughing and speaking incoherently. No emergency detected."
}
```

**Where the pipeline branches**

The moment `is_prank` is `true`, the backend takes a completely different path:

- It does NOT generate first-aid audio
- It does NOT call Khaya TTS
- It does NOT send an SNS alert
- It writes the call to a separate prank record in DynamoDB
- It pushes a WebSocket event that routes the call to the PRANK queue, not the main feed

**What the dispatcher sees**

The call does not appear in the main emergency feed at all. It goes to the collapsible prank queue at the bottom of the dashboard. The dispatcher can review it if they want but it does not interrupt their work.

The main feed stays clean. The real emergencies stay visible.

```
PRANK path complete. Three Khaya API calls saved. Dispatcher feed uncluttered.
```

---

## Scenario 5 — Pipeline Failure ❌

> **Example:** Khaya ASR times out. Or Bedrock returns an unexpected response. Or the GPS coordinates are missing.

Things will break. This is what happens when they do.

**Sub-scenario A — Khaya ASR fails**

The backend tries to transcribe the audio. Khaya returns a 500 error or times out.

The backend retries once after 2 seconds. If it fails again, it does not crash. It writes a `FAILED` record to DynamoDB with `failure_stage: "TRANSCRIPTION"` and pushes an `ERROR` WebSocket event to the dispatcher:

```json
{
  "type": "ERROR",
  "call_id": "uuid",
  "payload": {
    "code": "TRANSCRIPTION_FAILED",
    "message": "Audio could not be transcribed.",
    "recoverable": false
  }
}
```

The dispatcher sees a failed call card in grey. They know a call came in but processing could not complete.

**Sub-scenario B — Bedrock returns bad JSON**

Claude occasionally returns malformed output. The backend has a try/except around the JSON parse. If it fails to parse, it retries the Bedrock call once with a simpler prompt. If that also fails, it writes a failed record and pushes the ERROR event.

**Sub-scenario C — GPS is missing or invalid**

If the Flutter app fails to get GPS before placing the call, `gps_lat` and `gps_lon` come in as null. The pipeline continues without the location step. AWS Location Service is skipped entirely. The dispatcher brief says "Location unavailable — caller GPS not resolved." The rest of the pipeline runs normally.

**Sub-scenario D — Audio is too short or silent**

Khaya ASR returns an empty `text` field or a very short string like "um" or "hello". The backend checks for this. If the transcription is under 3 words, it skips translation and sends the raw text straight to Bedrock with a note: "Very short audio clip — possible accidental call." Bedrock usually classifies these as NON-EMERGENCY or PRANK.

```
FAILURE paths complete. System degrades gracefully, never crashes silently.
```

---

## How All 5 Scenarios Fit Together

```
Call comes in
      ↓
  Transcribe
      ↓
  Translate
      ↓
  Bedrock triage
      ↓
  ┌───────────────────────────────────────┐
  │                                       │
is_prank = true?              is_prank = false?
  │                                       │
  ↓                                       ↓
Prank queue              What is the severity?
WebSocket event          ┌────────┬────────┐
No SNS                CRITICAL  URGENT  NON-EMERGENCY
No TTS                   │        │          │
                         ↓        ↓          ↓
                    SNS fires   No SNS    No SNS
                    Top of feed  Mid-feed  Bottom
                         │        │          │
                         └────────┴──────────┘
                                  ↓
                     Location resolution
                                  ↓
                     TTS first-aid audio
                                  ↓
                     Save to DynamoDB
                                  ↓
                     BRIEF_READY → WebSocket
                                  ↓
                     Audio URL → Flutter app
```

---

## Quick Reference

| Scenario      | Khaya ASR | Khaya Translate | Bedrock   | Location  | Khaya TTS | SNS | WebSocket event               |
| ------------- | --------- | --------------- | --------- | --------- | --------- | --- | ----------------------------- |
| CRITICAL      | ✅         | ✅               | ✅         | ✅         | ✅         | ✅   | BRIEF_READY                   |
| URGENT        | ✅         | ✅               | ✅         | ✅         | ✅         | ❌   | BRIEF_READY                   |
| NON-EMERGENCY | ✅         | ✅               | ✅         | ✅         | ✅         | ❌   | BRIEF_READY                   |
| PRANK         | ✅         | ✅               | ✅         | ❌         | ❌         | ❌   | TRIAGE_COMPLETE (prank queue) |
| FAILURE       | ✅ (fails) | ❌ skipped       | ❌ skipped | ❌ skipped | ❌ skipped | ❌   | ERROR                         |

---

## One Thing Every Team Member Should Know

Scenarios 1, 2, and 3 all run the exact same code. The only thing that changes the outcome is what Bedrock returns. The pipeline does not have separate logic for each severity level. It reads the `severity` and `is_prank` fields from the Bedrock response and routes accordingly. If Bedrock gets the classification wrong, the whole thing goes wrong. The quality of the Bedrock prompt is therefore the most important single piece of code in the entire system.
