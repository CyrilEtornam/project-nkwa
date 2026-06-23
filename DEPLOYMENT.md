# Nkwa — AWS Deployment Guide

This guide walks you through deploying the Nkwa backend to AWS from scratch. Follow the steps in order. Do not skip ahead — each section builds on the previous one.

**Estimated time:** 2–3 hours if it's your first time.  
**AWS Region:** Everything must be in `us-west-2` (Oregon). This is non-negotiable — Bedrock's Claude model is only available in specific regions, and `us-west-2` is what the team agreed on.

---

## MVP Bypass Status

The following features have been **temporarily disabled** per supervisor feedback to focus on the core call pipeline. Each one is a clean stub — the code structure is preserved and re-enabling any feature means reverting a single file.

| Feature | Status | What changed |
|---|---|---|
| Authentication (JWT) | **Bypassed** | `get_current_user()` returns a hardcoded mock dispatcher; no token required on any endpoint |
| User accounts & registration | **Bypassed** | Auth routes return stub responses; no DynamoDB user writes |
| Emergency contacts | **Bypassed** | Contacts endpoints return 503; `nkwa-contacts` table not used |
| SOS alerts | **Bypassed** | SOS endpoint returns 503 |
| SNS (SMS messaging) | **Bypassed** | All SNS send functions are no-ops; no SMS is sent |
| Dispatcher dashboard (WebSocket) | **Bypassed** | `push_event()` is a no-op; real-time events are not broadcast |
| **Core call pipeline** | **Active** | Audio → Transcribe → AI triage → Location → First-aid TTS → REST response |
| **Bedrock AI triage** | **Active** | Fully operational; `dispatcher_brief` and `recommended_response_unit` still generated |
| **AWS Location** | **Active** | GPS to landmark resolution unchanged |
| **Khaya speech processing** | **Active** | ASR, translation, TTS for all Ghanaian languages unchanged |

---

## Before You Start

You need:
- An AWS account with billing enabled
- A terminal (Mac: Terminal app / Windows: PowerShell or WSL)
- The Nkwa GitHub repo cloned on your machine
- Your Khaya API key from [GhanaNLP](https://translation-api.ghananlp.org)

You do **not** need to install the AWS CLI for this guide. We'll use the AWS Console (the website) for most steps.

---

## Overview — What We're Building

Here's what we're creating and why:

| AWS Service | What it does in Nkwa | Status for MVP |
|---|---|---|
| EC2 (t3.medium) | Runs the FastAPI server | **Required** |
| DynamoDB | Stores calls and first-aid guides | **Required** (only `nkwa-calls` and `nkwa-first-aid` tables are active; `nkwa-users` and `nkwa-contacts` are created but unused until auth is re-enabled) |
| S3 | Stores audio recordings and TTS MP3 files | **Required** |
| Bedrock (Claude) | Classifies emergency calls and writes the dispatcher brief | **Required** |
| AWS Location | Converts GPS coordinates to a readable landmark name | **Required** |
| SNS | Sends OTP SMS and CRITICAL alerts | **Bypassed** — all SNS calls are no-ops; the SNS topic and IAM policy are not needed right now |

> **Note on WebSocket / Dispatcher Dashboard:** The server still accepts WebSocket connections at `/ws`, but no events are broadcast during call processing. The real-time dispatcher feed will be restored when the dashboard is re-enabled.

---

## Part 1 — Create an IAM Role for EC2

> **Why an IAM role?** Instead of putting your AWS username and password into the server (which is dangerous and expires), you create a "role" — a set of permissions that the EC2 server automatically inherits just by being the machine it is. No credentials to manage or rotate.

1. Go to [https://console.aws.amazon.com/iam](https://console.aws.amazon.com/iam)
2. In the left sidebar, click **Roles**
3. Click the orange **Create role** button
4. Under "Trusted entity type", select **AWS service**
5. Under "Use case", select **EC2** → click **Next**
6. In the search box, search for and check each of these policies one at a time:
   - `AmazonDynamoDBFullAccess`
   - `AmazonS3FullAccess`
   - `AmazonBedrockFullAccess`
   - `AmazonLocationFullAccess`
   - `AmazonTranscribeFullAccess`
   - `AmazonPollyFullAccess`

   > **About `AmazonLocationFullAccess` and the new API:** AWS updated this managed policy to cover both the old Place Index API and the new standalone `geo-places` API. You do not need to create or attach any additional policy for location lookups.

   > **SNS not listed:** `AmazonSNSFullAccess` is intentionally omitted. SNS is bypassed for this MVP — the server never calls AWS SNS, so the permission is not needed. Add it back when SMS is re-enabled.

7. Click **Next**
8. Under "Role name", type `nkwa-ec2-role`
9. Click **Create role**

> **Note:** `FullAccess` policies are broad — acceptable for a demo/prototype. In production you would scope these down to only the specific tables and buckets Nkwa uses.

---

## Part 2 — Create the EC2 Server

> **Why t3.medium?** The server runs Bedrock inference, handles audio processing, and manages multiple concurrent requests — it needs at least 4GB of RAM. t2.micro (the free tier) only has 1GB and will run out of memory mid-call.

1. Go to [https://console.aws.amazon.com/ec2](https://console.aws.amazon.com/ec2)
2. Make sure the region in the top-right corner says **US West (Oregon) us-west-2**
3. Click **Launch instance**
4. Fill in the form:
   - **Name:** `nkwa-backend`
   - **Application and OS Images:** Select **Ubuntu** → choose **Ubuntu Server 24.04 LTS (HVM)** (64-bit x86)
   - **Instance type:** Select `t3.medium`
   - **Key pair:** Click **Create new key pair** → name it `nkwa-key` → type RSA → format `.pem` → click **Create key pair**. A file called `nkwa-key.pem` will download. **Save this file — you cannot download it again.**
5. Under **Network settings**, click **Edit** and add these inbound rules:
   - Rule 1 (already there): Type `SSH`, Port `22`, Source `My IP`
   - Click **Add security group rule**: Type `Custom TCP`, Port `8000`, Source `Anywhere (0.0.0.0/0)` — this is the port the API runs on
6. Under **Advanced details**, find **IAM instance profile** and select `nkwa-ec2-role` from the dropdown
7. Leave everything else as default
8. Click **Launch instance**

Wait about 2 minutes for the instance to start. When the **Instance state** shows `Running`, note the **Public IPv4 address** (e.g. `54.201.12.34`) — you'll need it throughout this guide.

### Connect to the server

On your local machine, open a terminal and run:

```bash
# First, fix the permissions on your key file (required — SSH will refuse to connect otherwise)
chmod 400 ~/Downloads/nkwa-key.pem

# Connect (replace YOUR_EC2_IP with the public IP from above)
ssh -i ~/Downloads/nkwa-key.pem ubuntu@YOUR_EC2_IP
```

You should see a welcome message from Ubuntu. You are now inside the server.

---

## Part 3 — Set Up the Server

Run these commands inside the EC2 terminal (after SSH-ing in):

```bash
# Update the package list
sudo apt update

# Install Python 3.11, pip, git, and the virtual environment tool
sudo apt install -y python3.11 python3.11-venv python3-pip git

# Verify Python installed correctly
python3.11 --version
# Should print: Python 3.11.x
```

### Clone the repository

```bash
cd ~
git clone https://github.com/CyrilEtornam/project-nkwa.git
cd project-nkwa/backend
```

> If the repo is private, you'll need to authenticate with GitHub first. The easiest way is to generate a Personal Access Token on GitHub (Settings → Developer settings → Personal access tokens → Tokens classic → Generate new token → check `repo`) and use it as the password when prompted.

### Create the virtual environment and install dependencies

```bash
# Create the virtual environment inside the backend folder
python3.11 -m venv .env

# Activate it
source .env/bin/activate

# Install all required packages
pip install -r requirements.txt
```

---

## Part 4 — Create DynamoDB Tables

> **Why DynamoDB?** DynamoDB is a key-value store — unlike a SQL database, it doesn't do joins. Each entity gets its own table. This is the standard DynamoDB pattern.

1. Go to [https://console.aws.amazon.com/dynamodb](https://console.aws.amazon.com/dynamodb)
2. Make sure you're in **us-west-2**
3. Click **Create table** and create each table below.

---

**Table 1: `nkwa-calls`** ← Core, actively used
- Table name: `nkwa-calls`
- Partition key: `call_id` (String)
- Leave sort key empty
- Settings: Default settings → Create table

---

**Table 2: `nkwa-first-aid`** ← Used by the first-aid guides endpoint
- Table name: `nkwa-first-aid`
- Partition key: `guide_id` (String)
- Leave sort key empty
- Settings: Default settings → Create table

---

**Table 3: `nkwa-cache`** ← Used by Khaya client to cache ASR/TTS responses
- Table name: `nkwa-cache`
- Partition key: `cache_key` (String)
- Leave sort key empty
- Settings: Default settings → Create table

---

**Table 4: `nkwa-users`** ← Create now, not actively used until auth is re-enabled
- Table name: `nkwa-users`
- Partition key: `user_id` (String)
- Leave sort key empty
- Settings: Default settings → Create table

> **Why create it now?** Auth is bypassed but the table name is still referenced in the environment config. Creating it now means zero code changes when auth is turned back on.

---

**Table 5: `nkwa-contacts`** ← Create now, not actively used until contacts/SOS are re-enabled
- Table name: `nkwa-contacts`
- Partition key: `user_id` (String)
- Sort key: `contact_id` (String)

> **Why a sort key here?** A user can have many contacts. The sort key lets us store all contacts for one user under the same partition key (`user_id`) and query them all with a single call — much faster and cheaper than scanning the whole table.

- Settings: Default settings → Create table

---

Wait until all five tables show **Active** status before continuing.

---

## Part 5 — Create the S3 Bucket

> **Why S3?** The server generates TTS audio (MP3 files) for the first-aid instructions and needs somewhere to store them so the caller's phone can play them. S3 gives each file a permanent URL. The incoming call audio is also saved here for the transcription pipeline.

1. Go to [https://console.aws.amazon.com/s3](https://console.aws.amazon.com/s3)
2. Click **Create bucket**
3. Fill in:
   - **Bucket name:** `nkwa-audio` *(must be globally unique — if it's taken, try `nkwa-audio-2025` or `nkwa-audio-gh`)*
   - **AWS Region:** `US West (Oregon) us-west-2`
4. Under **Block Public Access settings for this bucket**, **uncheck** "Block all public access" and confirm the warning checkbox. This is required so the first-aid MP3 files can be played by the caller's phone.
5. Leave everything else as default → click **Create bucket**

### Add a public-read policy for TTS audio

After the bucket is created:

1. Click on the `nkwa-audio` bucket name
2. Go to the **Permissions** tab
3. Scroll down to **Bucket policy** → click **Edit**
4. Paste this policy (replace `nkwa-audio` if you used a different name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadFirstAid",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::nkwa-audio/calls/*/first_aid_*.mp3"
    }
  ]
}
```

> **Why only `first_aid_*.mp3`?** The caller's raw audio recording is private — only the server should access it. The first-aid TTS audio needs to be public so the mobile app can play it directly without authenticating. This policy makes only the TTS files public and keeps everything else private.

5. Click **Save changes**

---

## Part 6 — Enable Bedrock (Claude)

> **Important:** Bedrock models are not available by default. You must explicitly request access. The process takes under 5 minutes but you must do it before deploying.

1. Go to [https://console.aws.amazon.com/bedrock](https://console.aws.amazon.com/bedrock)
2. Make sure you're in **us-west-2**
3. In the left sidebar, click **Model access**
4. Click **Modify model access**
5. Find `Claude 3.5 Sonnet v2` under Anthropic — check its checkbox
6. Click **Next** → **Submit**
7. Wait until the status shows **Access granted** (usually within 2–5 minutes)

> **Only enable the model you need.** Do not enable Claude 3 Opus, Mistral, or other models — you pay per token for every model you use.

---

## Part 7 — SNS Setup (Skip for MVP)

> **SNS is bypassed for this MVP.** All SMS functions (`send_otp`, `send_critical_alert`, `send_sos_alert`) are no-ops in the current codebase — they log a `[BYPASS]` message and return without calling AWS. You do not need to create an SNS topic or add phone numbers.
>
> **When you're ready to re-enable SMS:** Follow these steps, then restore `backend/shared/sns_client.py` to its original implementation and add `SNS_ALERT_TOPIC_ARN` back to your `.env`.

<details>
<summary>SNS setup instructions (for when you re-enable)</summary>

### Enable SMS (one-time setup)

1. Go to [https://console.aws.amazon.com/sns](https://console.aws.amazon.com/sns)
2. Make sure you're in **us-west-2**
3. In the left sidebar, click **Text messaging (SMS)**
4. Click **Edit account-level settings**
5. Set **Default message type** to `Transactional` (more reliable delivery, higher priority)
6. Click **Save changes**

### Create the CRITICAL alert topic

1. In the left sidebar, click **Topics**
2. Click **Create topic**
3. Fill in:
   - **Type:** Standard
   - **Name:** `nkwa-critical-alerts`
4. Click **Create topic**
5. Copy the **ARN** that appears (it looks like `arn:aws:sns:us-west-2:123456789:nkwa-critical-alerts`) — you'll need this for the `.env` file
6. Click **Create subscription**:
   - Protocol: `SMS`
   - Endpoint: The demo phone number in E.164 format (e.g. `+233241112222`)
   - Click **Create subscription**

> **What is E.164 format?** It's the international phone number format: `+` followed by country code followed by number, no spaces. Ghana country code is `233`. So `0241112222` becomes `+233241112222`.

Also add `AmazonSNSFullAccess` to the `nkwa-ec2-role` IAM role (Part 1) before restarting the server.

</details>

---

## Part 8 — Configure Environment Variables on EC2

Back in your EC2 SSH terminal:

```bash
cd ~/project-nkwa/backend

# Create the environment file
nano ../.env
```

Paste this and fill in the values marked with `<...>`:

```env
# --- Core ---
USE_MOCK=false
# JWT_SECRET is kept for when auth is re-enabled; it is not enforced right now
JWT_SECRET=<generate a long random string — e.g. run: openssl rand -hex 32>
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# --- AWS ---
AWS_REGION=us-west-2
# No ACCESS_KEY_ID or SECRET_ACCESS_KEY needed — the EC2 IAM role handles auth automatically

# --- Khaya (GhanaNLP) ---
KHAYA_API_KEY=<your key from GhanaNLP dashboard>

# --- S3 ---
S3_BUCKET_NAME=nkwa-audio

# --- DynamoDB ---
DYNAMO_CALLS_TABLE=nkwa-calls
DYNAMO_FIRSTAID_TABLE=nkwa-first-aid
DYNAMO_CACHE_TABLE=nkwa-cache
# These two tables exist in DynamoDB but are not actively used until auth/contacts are re-enabled
DYNAMO_USERS_TABLE=nkwa-users
DYNAMO_CONTACTS_TABLE=nkwa-contacts

# --- Bedrock ---
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# --- SNS (bypassed — leave blank for now) ---
# SNS_ALERT_TOPIC_ARN=
# Uncomment and fill in when SMS is re-enabled

# --- Amazon Transcribe (English ASR) ---
TRANSCRIBE_LANGUAGE_CODE=en-US

# --- Amazon Polly (English TTS) ---
POLLY_VOICE_ID=Joanna
POLLY_OUTPUT_FORMAT=mp3
POLLY_ENGINE=neural

# --- Server ---
PORT=8000
HOST=0.0.0.0
```

Save and exit: `Ctrl+X` → `Y` → `Enter`

> **Why no AWS credentials in the file?** The EC2 instance has an IAM role (`nkwa-ec2-role`) attached. When boto3 runs on the server, it automatically picks up those role credentials — no keys needed. This is safer than putting keys in a file (they can't be leaked if the file is accidentally committed or exposed).

### Generate a strong JWT secret

Even though JWT is not enforced right now, generate a proper value so re-enabling auth later requires no changes to `.env`:

```bash
openssl rand -hex 32
```

Copy the output and paste it as the value for `JWT_SECRET`.

---

## Part 9 — Load the Environment and Seed First-Aid Guides

```bash
cd ~/project-nkwa/backend
source .env/bin/activate

# Load the env vars into the current shell session
export $(cat ../.env | grep -v '^#' | xargs)

# Confirm the variables loaded
echo $AWS_REGION   # should print: us-west-2
echo $USE_MOCK     # should print: false
```

### Seed the first-aid guides into DynamoDB

```bash
python scripts/seed_first_aid.py
```

This populates the `nkwa-first-aid` table with the 12 WHO emergency protocols. You only need to run this once.

> **No dispatcher account needed.** Auth is bypassed — `get_current_user()` returns a hardcoded mock dispatcher (`mock-dispatcher-001`) on every request. There is no need to create a real user in DynamoDB. When auth is re-enabled, run the dispatcher account creation script at that point.

<details>
<summary>Dispatcher account creation script (for when auth is re-enabled)</summary>

```bash
python3 -c "
import os, uuid
from datetime import datetime, timezone
from shared import dynamo_client
from shared.auth_utils import hash_password

dynamo_client.put_item('nkwa-users', {
    'user_id': str(uuid.uuid4()),
    'full_name': 'Nkwa Dispatcher',
    'email': 'dispatcher@nkwa.gh',
    'phone': '+233000000000',
    'region': 'Greater Accra',
    'home_address': 'Dispatch Centre',
    'nkwa_id': 'GA-000-0000',
    'password_hash': hash_password('dispatch2025'),
    'role': 'dispatcher',
    'otp': '',
    'otp_expiry': '',
    'verified': True,
    'created_at': datetime.now(timezone.utc).isoformat(),
})
print('Dispatcher account created.')
print('Email: dispatcher@nkwa.gh')
print('Password: dispatch2025')
"
```

Change the password to something stronger before the demo.

</details>

---

## Part 10 — Start the Server

```bash
cd ~/project-nkwa/backend
source .env/bin/activate
export $(cat ../.env | grep -v '^#' | xargs)

# Start the server — nohup keeps it running after you close the SSH session
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /var/log/nkwa.log 2>&1 &

echo "Server started. PID: $!"
```

### Verify it's running

```bash
# Check the process is alive
ps aux | grep uvicorn

# Check the health endpoint from inside the server
curl http://localhost:8000/health
```

You should see: `{"status":"ok","timestamp":"2025-..."}`

### Check the logs

```bash
tail -f /var/log/nkwa.log
```

Press `Ctrl+C` to stop watching the logs.

---

## Part 11 — Test from Your Local Machine

Replace `YOUR_EC2_IP` with your server's public IP in every command below.

> **No auth token needed.** All endpoints work without an `Authorization` header. The server uses a hardcoded mock dispatcher for every request.

```bash
# Health check
curl http://YOUR_EC2_IP:8000/health
```

### Test the core call pipeline

This is the main thing to verify. You need a base64-encoded WAV audio file. For a quick test, encode any short WAV:

```bash
# On your local machine, encode a WAV file
base64 -w 0 test_audio.wav > test_audio_b64.txt
AUDIO=$(cat test_audio_b64.txt)

# Submit an emergency call — no Authorization header required
curl -X POST http://YOUR_EC2_IP:8000/api/v1/calls/initiate \
  -H "Content-Type: application/json" \
  -d "{
    \"service_type\": \"AMBULANCE\",
    \"language\": \"en\",
    \"gps_lat\": 5.6037,
    \"gps_lon\": -0.1870,
    \"audio_base64\": \"$AUDIO\"
  }"
```

A successful response looks like:

```json
{
  "call_id": "uuid-here",
  "status": "PROCESSING",
  "first_aid_audio_url": "https://nkwa-audio.s3.amazonaws.com/calls/.../first_aid_en.mp3"
}
```

### Test the bypassed endpoints (confirm they behave as expected)

```bash
# Auth login — returns stub bypass token
curl -X POST http://YOUR_EC2_IP:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"any@email.com","password":"anything"}'
# Expected: {"token":"bypass-token","user":{"user_id":"mock-dispatcher-001",...}}

# Contacts — returns empty list with disabled notice
curl http://YOUR_EC2_IP:8000/api/v1/contacts
# Expected: {"total":0,"contacts":[],"message":"Feature temporarily disabled"}

# SOS — returns 503
curl -X POST http://YOUR_EC2_IP:8000/api/v1/sos \
  -H "Content-Type: application/json" \
  -d '{"gps_lat":5.6,"gps_lon":-0.18}'
# Expected: 503 {"detail":"Feature temporarily disabled"}

# First-aid guides — works without a token
curl http://YOUR_EC2_IP:8000/api/v1/first-aid
# Expected: list of seeded guides
```

### Retrieve call results

```bash
# List all calls (no token needed)
curl http://YOUR_EC2_IP:8000/api/v1/calls

# Get a specific call by ID
curl http://YOUR_EC2_IP:8000/api/v1/calls/<call_id_from_initiate_response>

# Get today's stats
curl http://YOUR_EC2_IP:8000/api/v1/calls/stats
```

---

## Part 12 — Pre-Cache Demo Scenarios (Do This Before the Demo)

> **Why?** You only have 100 Khaya API requests per month. If you run 15 emergency + 10 prank scenarios live during the demo, you'll burn 75 requests in 8 minutes. Pre-caching runs them all once before the demo so every request during the presentation hits the cache instead of Khaya.

```bash
cd ~/project-nkwa

# Make sure USE_MOCK=false is set
export USE_MOCK=false

# Run all simulator scenarios (this will take ~5 minutes)
python simulator/simulate.py

# After this completes, DO NOT change USE_MOCK — leave it as false
# The responses are now in DynamoDB cache
```

---

## Part 13 — Connect the Frontend App

> **Dispatcher dashboard is bypassed.** The WebSocket feed does not broadcast events, so the dispatcher dashboard frontend has nothing to receive. Only the web caller app (or mobile app) is relevant for this MVP.

Update the frontend environment file with your EC2 IP:

**Web caller (`web-caller/.env` or `frontend/.env`):**
```env
VITE_API_BASE_URL=http://YOUR_EC2_IP:8000
```

> `VITE_WS_URL` is not needed while the dispatcher dashboard is bypassed. Add it back when real-time events are re-enabled.

---

## Restarting the Server

If you need to restart the server (e.g. after a code change):

```bash
# SSH into the EC2 instance
ssh -i ~/Downloads/nkwa-key.pem ubuntu@YOUR_EC2_IP

# Kill the running server
pkill -f uvicorn

# Pull latest code
cd ~/project-nkwa
git pull

# Restart
cd backend
source .env/bin/activate
export $(cat ../.env | grep -v '^#' | xargs)
nohup uvicorn main:app --host 0.0.0.0 --port 8000 > /var/log/nkwa.log 2>&1 &
echo "Restarted. PID: $!"
```

---

## Re-enabling Bypassed Features

Each feature was disabled by changing exactly one file. To restore any feature:

| Feature | File to revert | Additional steps |
|---|---|---|
| Auth (JWT enforcement) | `backend/shared/auth_utils.py` — restore original `get_current_user()` with `Depends(security)` | Run the dispatcher account creation script from Part 10 |
| User registration routes | `backend/routers/auth.py` — restore original handlers | Requires auth re-enabled first |
| Contacts | `backend/routers/contacts.py` — restore original handlers | Requires auth re-enabled first |
| SOS | `backend/routers/sos.py` — restore original handler | Requires auth + contacts re-enabled |
| SNS (SMS) | `backend/shared/sns_client.py` — restore original send functions | Follow Part 8; add `SNS_ALERT_TOPIC_ARN` to `.env`; add `AmazonSNSFullAccess` to IAM role |
| Dispatcher dashboard (WebSocket) | `backend/shared/ws_manager.py` — restore original `push_event()` body | Add `VITE_WS_URL` to frontend `.env` |

No router registrations, database schemas, or IAM policies need to change for any of these — the infrastructure is already in place.

---

## Troubleshooting

**`Connection refused` on port 8000**
- Check the EC2 security group has a rule for port 8000 from `0.0.0.0/0`
- Run `ps aux | grep uvicorn` on the server to confirm it's running
- Check `/var/log/nkwa.log` for startup errors

**`An error occurred (ResourceNotFoundException)`**
- A DynamoDB table doesn't exist yet — double-check all five tables were created in `us-west-2` in Part 4

**`An error occurred (AccessDeniedException)`**
- The EC2 IAM role is missing a permission — go to IAM → Roles → `nkwa-ec2-role` and confirm all 6 policies from Part 1 are attached

**`ValidationException` from Bedrock**
- The model isn't enabled yet — go to Bedrock → Model access and confirm Claude 3.5 Sonnet v2 shows "Access granted"

**Khaya returns `401 Unauthorized`**
- Your `KHAYA_API_KEY` in `.env` is wrong or expired — double-check it from the GhanaNLP dashboard

**`POST /api/v1/calls/initiate` returns 500**
- Check `/var/log/nkwa.log` for which pipeline stage failed (`failure_stage` in the error response tells you exactly where)
- Common causes: S3 bucket doesn't exist, Bedrock model access not granted, IAM role missing `AmazonLocationFullAccess`

**Server dies after you close SSH**
- You forgot `nohup` before `uvicorn` — the `nohup` command is what keeps it alive after the session closes. Restart using the command in the "Restarting" section above.

---

## Architecture at a Glance (MVP)

```
Mobile App / Web Caller
        │
        │ POST /api/v1/calls/initiate  (no auth token required)
        ▼
   EC2 (port 8000)
   FastAPI + Uvicorn
        │
        ├──► S3                    (save raw audio + serve TTS MP3)
        ├──► Khaya ASR             (transcribe local language audio)
        ├──► Khaya TTS             (generate first-aid audio in caller's language)
        ├──► Amazon Transcribe     (transcribe English audio)
        ├──► Amazon Polly          (generate first-aid audio in English)
        ├──► Bedrock Claude        (classify call, detect prank, write dispatcher brief)
        ├──► AWS Location          (convert GPS to landmark description)
        └──► DynamoDB              (save call record)
        │
        │ REST response (call_id + first_aid_audio_url + full triage result)
        ▼
   Caller's phone / test client

[WebSocket /ws — connected but silent until dispatcher dashboard is re-enabled]
[SNS — bypassed, no SMS sent]
```

Total pipeline time from call received to full brief: under 30 seconds.
