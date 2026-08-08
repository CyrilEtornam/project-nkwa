# Nkwa — Ghana 112 Emergency Copilot

Nkwa lets anyone in Ghana call for emergency help (ambulance, fire, police) by speaking in their own language. The caller records a voice message in Twi, Ga, Ewe, or English; the backend transcribes it, classifies the emergency with AI, resolves the caller's GPS to a recognisable landmark, and returns a first-aid audio guide in the caller's language — all in under 30 seconds.

---

## Repo structure

```
project-nkwa/
├── backend/          # FastAPI server (Python 3.11)
├── frontend/         # React web caller app (Vite + Tailwind)
├── mobile-app/       # Mobile client (separate — not covered here)
├── simulation/       # Scenario simulator for pre-caching demo calls
├── test-audio/       # Sample audio files for manual testing
├── Docs/             # API docs, pipeline scenarios, Postman collections
├── DEPLOYMENT.md     # Full AWS deployment guide (EC2 + DynamoDB + S3 + Bedrock)
└── CONTEXT.md        # Architecture and schema reference
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- Git

No AWS account is needed for local development — the backend has a mock mode that intercepts all external calls and returns realistic fake data.

---

## Quick start (mock mode — no AWS needed)

This gets both services running locally with zero external dependencies.

### 1. Clone the repo

```bash
git clone https://github.com/CyrilEtornam/project-nkwa.git
cd project-nkwa
```

### 2. Start the backend

```bash
cd backend

# Create and activate a virtual environment
python3.11 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create the root-level .env file (the server reads from ../.env)
cat > ../.env << 'EOF'
USE_MOCK=true
JWT_SECRET=local-dev-secret
AWS_REGION=us-west-2
EOF

# Start the server
USE_MOCK=true JWT_SECRET=local-dev-secret uvicorn main:app --reload --port 8000
```

The API is live at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

### 3. Start the frontend

Open a new terminal:

```bash
cd frontend
npm install

# Point the frontend at the local backend
echo "VITE_API_BASE_URL=http://localhost:8000" > .env

npm run dev
```

The app opens at `http://localhost:5174`.

---

## Running the call pipeline end-to-end

With both services running in mock mode:

1. Open `http://localhost:5174`
2. Tap the call button → choose a service → choose a language
3. Allow microphone access and speak a short message
4. Tap **Stop & Send**
5. The processing screen calls `POST /api/v1/calls/initiate` and waits
6. The result screen shows the mock triage result, landmark, and first-aid instructions

In mock mode the backend returns pre-built responses without calling Khaya, Bedrock, or AWS. The full response structure is identical to production — useful for frontend development and testing the UI flow.

---

## Connecting to a live backend (EC2)

If the backend is already deployed on EC2, you only need to update the frontend env variable:

```bash
# In the frontend/ directory
echo "VITE_API_BASE_URL=http://YOUR_EC2_IP:8000" > .env
npm run dev
```

No other changes are needed. See `DEPLOYMENT.md` for the full EC2 setup guide.

---

## MVP feature status

Several features are temporarily disabled per supervisor feedback to focus the demo on the core call pipeline. Each one is a clean stub — re-enabling any feature means reverting a single file (see `DEPLOYMENT.md` → "Re-enabling Bypassed Features").

| Feature | Status | Note |
|---|---|---|
| Core call pipeline | **Active** | Audio → transcribe → AI triage → location → first-aid TTS |
| Bedrock AI triage | **Active** | Classifies severity, detects pranks, writes dispatcher brief |
| AWS Location | **Active** | GPS → readable landmark + directions |
| Khaya speech (ASR/TTS) | **Active** | Twi, Ga, Ewe, English transcription and voice synthesis |
| Authentication (JWT) | **Bypassed** | All endpoints accept requests with no token |
| User registration | **Bypassed** | Auth routes return stub responses |
| Emergency contacts | **Bypassed** | Contacts endpoints return 503 |
| SOS alert | **Bypassed** | SOS endpoint returns 503; UI shows "Coming soon" |
| SNS / SMS | **Bypassed** | No SMS is sent; SNS calls are no-ops |
| Dispatcher WebSocket feed | **Bypassed** | Server accepts WS connections but broadcasts no events |

---

## Branches and contribution

- `main` — stable, demo-ready
- Feature branches → PR into `main`

Before opening a PR, run a quick smoke test against mock mode to confirm the call pipeline still returns a result end-to-end.
