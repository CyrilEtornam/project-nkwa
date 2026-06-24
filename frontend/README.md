# Nkwa Frontend

React web app for the Nkwa emergency caller flow. Built with Vite, Tailwind CSS, and lucide-react. Single-page, mobile-first layout — no router, no component library beyond icons.

---

## Directory structure

```
frontend/
├── src/
│   ├── App.jsx          # Entire application — all screens and logic live here
│   ├── main.jsx         # React root mount
│   └── styles/
│       └── index.css    # Tailwind directives + base styles
├── index.html           # HTML shell — loads Inter font from Google Fonts
├── tailwind.config.js   # Design tokens (colors, shadows, animations)
├── vite.config.js       # Dev server on port 5174
├── postcss.config.js
└── package.json
```

---

## Setup and running

```bash
npm install

# Set the backend URL (defaults to http://localhost:8000 if not set)
echo "VITE_API_BASE_URL=http://localhost:8000" > .env

npm run dev
```

App runs at `http://localhost:5174`.

To build for production:

```bash
npm run build    # output goes to dist/
npm run preview  # serve the production build locally
```

---

## Screen flow

All state and navigation live in the `App` component using a `screen` string and `useState`. There is no router.

```
home → service → language → calling → processing → result
                                  ↑                      |
                               onCancel ←────────────────┘
                                  │
                               (reset to home)
```

| Screen | Component | What it does |
|---|---|---|
| `home` | `HomeScreen` | Call button with pulsing rings, language/feature chips |
| `service` | `ServiceScreen` | Pick AMBULANCE, FIRE, or POLICE (SOS shows "Coming soon") |
| `language` | `LanguageScreen` | Pick English, Twi, Ga, or Ewe |
| `calling` | `CallingScreen` | Requests mic + location, records audio, "Stop & Send" button |
| `processing` | `ProcessingScreen` | POSTs to `/api/v1/calls/initiate`, shows loading animation |
| `result` | `ResultScreen` | Shows severity, landmark, first-aid audio player, instructions |

### Calling screen detail

On mount, `CallingScreen` simultaneously:
- Calls `navigator.mediaDevices.getUserMedia({ audio: true })` and starts a `MediaRecorder`
- Calls `navigator.geolocation.getCurrentPosition()` for GPS coordinates

Both are released when the component unmounts (cancel or after submit). An `active` flag prevents state updates if the component unmounts before either callback fires.

When the user taps **Stop & Send**, the recorder stops, the audio blob is base64-encoded via `FileReader`, and `onSubmit({ audioBase64, coords })` is called to transition to the processing screen.

If mic access is denied, the Stop & Send button is hidden and the user can only cancel.

### Processing screen detail

On mount, `ProcessingScreen` fires `POST /api/v1/calls/initiate` with:

```json
{
  "service_type": "AMBULANCE",
  "language": "tw",
  "gps_lat": 5.6037,
  "gps_lon": -0.187,
  "audio_base64": "..."
}
```

This request blocks until the full pipeline completes (up to ~30 seconds). On success it immediately fetches `GET /api/v1/calls/{call_id}` for the full call record, then transitions to the result screen.

On error (network failure or non-200 response) it shows an inline error card with a "Go back" button.

---

## Backend integration

The backend URL is read from `import.meta.env.VITE_API_BASE_URL` with a fallback of `http://localhost:8000`.

**Auth:** no `Authorization` header is sent. Auth is currently bypassed on the backend — all endpoints accept requests without a token.

**WebSocket:** not implemented in the frontend. The backend's `push_event()` is bypassed and broadcasts no events. When the dispatcher dashboard is re-enabled, a WS client will need to be added to `ProcessingScreen` to receive incremental pipeline events.

---

## Language and service codes

These are the values sent to the backend — distinct from the display labels:

| Display | Sent as |
|---|---|
| English | `en` |
| Twi | `tw` |
| Ga | `gaa` |
| Ewe | `ee` |

| Display | Sent as |
|---|---|
| Ambulance | `AMBULANCE` |
| Fire Service | `FIRE` |
| Police | `POLICE` |
| SOS Alert | disabled (UI blocks selection) |

---

## Design system

Custom Tailwind tokens defined in `tailwind.config.js`:

| Token | Value | Used for |
|---|---|---|
| `bg-nkwa-gradient` | `135deg, #6322C8 → #8B3FE8` | Calling/processing screens, primary button |
| `bg-surface` | `#FAF8FE` | Page background |
| `shadow-card` | subtle purple-tinted shadow | White cards |
| `animate-pulse-ring` | scale + fade out over 1.8s | Call button rings |
| `text-ink-{400,500,700,900}` | purple-grey scale | Body text |
| `bg-service-{type}Bg` | per-service pastel | Service icon backgrounds |
| `text-service-{type}` | per-service colour | Service icon colour |

The focus ring (`:focus-visible`) is set to `2px solid #8B3FE8` globally in `index.css`.
Reduced-motion users get animations collapsed to effectively 0ms via the `prefers-reduced-motion` media query.
