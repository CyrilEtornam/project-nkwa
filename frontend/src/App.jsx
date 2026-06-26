import { useState, useEffect, useRef } from 'react'
import {
  Phone, ChevronRight, ChevronLeft,
  Cross, Flame, Shield, Megaphone,
  Globe, X,
} from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const SERVICES = [
  {
    id:    'AMBULANCE',
    label: 'Ambulance',
    sub:   'Medical emergency',
    icon:  Cross,
    bg:    'bg-service-ambulanceBg',
    text:  'text-service-ambulance',
  },
  {
    id:    'FIRE',
    label: 'Fire Service',
    sub:   'Fire & rescue',
    icon:  Flame,
    bg:    'bg-service-fireBg',
    text:  'text-service-fire',
  },
  {
    id:    'POLICE',
    label: 'Police',
    sub:   'Crime & security',
    icon:  Shield,
    bg:    'bg-service-policeBg',
    text:  'text-service-police',
  },
  {
    id:       'SOS',
    label:    'SOS Alert',
    sub:      'Instant panic dispatch',
    icon:     Megaphone,
    bg:       'bg-service-sosBg',
    text:     'text-service-sos',
    disabled: true,
  },
]

const LANGUAGES = [
  { code: 'en',  label: 'English', native: 'English' },
  { code: 'tw',  label: 'Twi',     native: 'Twi'     },
  { code: 'gaa', label: 'Ga',      native: 'Ga'       },
  { code: 'ee',  label: 'Ewe',     native: 'Eʋegbe'   },
]

// ─── Shell wrapper ────────────────────────────────────────────────────────────

function Shell({ children, gradient = false }) {
  return (
    <div className={`min-h-screen ${gradient ? 'bg-nkwa-gradient' : 'bg-surface'}`}>
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  )
}

// ─── Screen 1 — Home ─────────────────────────────────────────────────────────

function HomeScreen({ onStart }) {
  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">

        {/* big call button with pulsing rings */}
        <div className="relative mb-10">
          <span className="absolute inset-0 rounded-full bg-nkwa-200 animate-pulse-ring" />
          <span
            className="absolute inset-0 rounded-full bg-nkwa-100 animate-pulse-ring"
            style={{ animationDelay: '0.6s' }}
          />
          <button
            type="button"
            onClick={onStart}
            aria-label="Start emergency call"
            className="relative z-10 w-40 h-40 rounded-full bg-nkwa-gradient shadow-card-lg
                       flex items-center justify-center
                       transition-transform active:scale-95 hover:shadow-2xl"
          >
            <Phone className="w-16 h-16 text-white" strokeWidth={2} />
          </button>
        </div>

        <h1 className="text-2xl font-bold text-ink-900 mb-3">
          Call for help
        </h1>
        <p className="text-ink-500 text-sm leading-relaxed max-w-xs">
          Tap the button to reach Ghana's 112 emergency line.
          Speak in any Ghanaian language — we'll handle the rest.
        </p>

        {/* feature chips */}
        <div className="mt-10 grid grid-cols-2 gap-3 w-full max-w-xs text-left">
          {[
            { emoji: '🇬🇭', text: 'Twi, Ga, Ewe, English' },
            { emoji: '📍', text: 'Landmark location'      },
            { emoji: '🩺', text: 'Live first-aid guide'   },
            { emoji: '⚡', text: 'Under 30 seconds'       },
          ].map(({ emoji, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-card"
            >
              <span className="text-lg">{emoji}</span>
              <span className="text-xs font-medium text-ink-700">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-ink-400 pb-8">
        nkwa · Ghana 112 Emergency Copilot
      </p>
    </Shell>
  )
}

// ─── Screen 2 — Pick service ──────────────────────────────────────────────────

function ServiceScreen({ onSelect, onBack }) {
  return (
    <Shell>
      {/* header */}
      <div className="px-6 pt-8 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-nkwa-50 flex items-center justify-center
                     text-ink-700 hover:bg-nkwa-100 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs text-ink-400 font-medium uppercase tracking-wide">
            Step 1 of 2
          </p>
          <h1 className="text-xl font-bold text-ink-900">Choose a service</h1>
        </div>
      </div>

      {/* service list */}
      <div className="flex-1 px-6 pb-8 pt-2 space-y-3">
        {SERVICES.map((service) => {
          const Icon = service.icon
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => !service.disabled && onSelect(service)}
              disabled={service.disabled}
              className={`w-full bg-white rounded-2xl shadow-card p-4
                         flex items-center gap-4 text-left transition-shadow
                         ${service.disabled
                           ? 'opacity-50 cursor-not-allowed'
                           : 'hover:shadow-card-lg active:scale-[0.98]'}`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center
                            flex-shrink-0 ${service.bg} ${service.text}`}
              >
                <Icon className="w-6 h-6" strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink-900">{service.label}</p>
                <p className="text-sm text-ink-500">{service.sub}</p>
              </div>
              {service.disabled
                ? <span className="text-xs font-semibold text-ink-400 bg-ink-400/10 px-2 py-1 rounded-full flex-shrink-0">Coming soon</span>
                : <ChevronRight className="w-5 h-5 text-ink-400 flex-shrink-0" />}
            </button>
          )
        })}
      </div>
    </Shell>
  )
}

// ─── Screen 3 — Pick language ─────────────────────────────────────────────────

function LanguageScreen({ service, onSelect, onBack }) {
  return (
    <Shell>
      {/* header */}
      <div className="px-6 pt-8 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-nkwa-50 flex items-center justify-center
                     text-ink-700 hover:bg-nkwa-100 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-xs text-ink-400 font-medium uppercase tracking-wide">
            Step 2 of 2 · {service.label}
          </p>
          <h1 className="text-xl font-bold text-ink-900">Choose your language</h1>
        </div>
      </div>

      {/* language list */}
      <div className="flex-1 px-6 pb-8 pt-2 space-y-3">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => onSelect(lang)}
            className="w-full bg-white rounded-2xl shadow-card p-4
                       flex items-center gap-4
                       hover:shadow-card-lg transition-shadow active:scale-[0.98]
                       text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-nkwa-50 flex items-center justify-center flex-shrink-0">
              <Globe className="w-5 h-5 text-nkwa-600" strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink-900">{lang.label}</p>
              <p className="text-sm text-ink-500">{lang.native}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-ink-400 flex-shrink-0" />
          </button>
        ))}
      </div>
    </Shell>
  )
}

// ─── Screen 4 — Calling ───────────────────────────────────────────────────────

// Pick a recording format the browser actually supports, preferring Opus.
// Returns '' to let MediaRecorder use its own default if none match.
function pickAudioMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) || ''
}

// Peak RMS below this means the mic captured effectively nothing (dead/muted
// mic, or audio so quiet ASR returns an empty transcript). ~ -34 dBFS.
const SILENCE_PEAK_THRESHOLD = 0.02
const MIN_RECORDING_MS = 1000

function CallingScreen({ service, language, onCancel, onSubmit }) {
  const Icon = service.icon

  const [phase,        setPhase]        = useState('starting')  // starting | recording | encoding
  const [geoStatus,    setGeoStatus]    = useState('pending')   // pending | ready | error
  const [micError,     setMicError]     = useState(false)
  const [coords,       setCoords]       = useState(null)
  const [level,        setLevel]        = useState(0)           // live mic level 0..1
  const [captureError, setCaptureError] = useState(null)

  const recorderRef    = useRef(null)
  const chunksRef      = useRef([])
  const streamRef      = useRef(null)
  const audioCtxRef    = useRef(null)
  const rafRef         = useRef(null)
  const peakLevelRef   = useRef(0)        // loudest RMS seen across the recording
  const startTimeRef   = useRef(0)

  useEffect(() => {
    let active = true

    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl:  true,
      },
    })
      .then(stream => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream

        // Monitor live input level so we can detect a silent/dead mic and show
        // the user their voice is being picked up. Best-effort — never blocks
        // recording if the Web Audio API is unavailable.
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext
          const ctx = new AudioCtx()
          audioCtxRef.current = ctx
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 2048
          ctx.createMediaStreamSource(stream).connect(analyser)
          const data = new Uint8Array(analyser.fftSize)
          const tick = () => {
            if (!active) return
            analyser.getByteTimeDomainData(data)
            let sum = 0
            for (let i = 0; i < data.length; i++) {
              const v = (data[i] - 128) / 128
              sum += v * v
            }
            const rms = Math.sqrt(sum / data.length)
            peakLevelRef.current = Math.max(peakLevelRef.current, rms)
            setLevel(rms)
            rafRef.current = requestAnimationFrame(tick)
          }
          rafRef.current = requestAnimationFrame(tick)
        } catch { /* level monitoring is optional */ }

        const mimeType = pickAudioMimeType()
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream)
        recorderRef.current = recorder
        chunksRef.current = []
        recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
        recorder.start()
        startTimeRef.current = Date.now()
        setPhase('recording')
      })
      .catch(() => {
        if (!active) return
        setMicError(true)
        setPhase('recording')
      })

    navigator.geolocation.getCurrentPosition(
      pos => {
        if (!active) return
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeoStatus('ready')
      },
      () => { if (active) setGeoStatus('error') },
      { enableHighAccuracy: true, timeout: 10000 }
    )

    return () => {
      active = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      audioCtxRef.current?.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [])

  function handleSend() {
    const recorder = recorderRef.current

    if (!recorder || recorder.state === 'inactive') {
      onSubmit({ audioBase64: null, coords })
      return
    }

    // Validate BEFORE stopping so the user can keep speaking and retry without
    // losing the recorder. These guards stop silent/empty audio from reaching
    // the backend, where it would fail with a confusing transcription error.
    const elapsed = Date.now() - startTimeRef.current
    if (elapsed < MIN_RECORDING_MS) {
      setCaptureError('Please speak for a moment before sending.')
      return
    }
    if (peakLevelRef.current < SILENCE_PEAK_THRESHOLD) {
      setCaptureError('We could not hear anything. Check your microphone and speak clearly, then send again.')
      return
    }

    setCaptureError(null)
    setPhase('encoding')
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      streamRef.current?.getTracks().forEach(t => t.stop())
      audioCtxRef.current?.close().catch(() => {})
      const reader = new FileReader()
      reader.onloadend = () => onSubmit({ audioBase64: reader.result.split(',')[1], coords })
      reader.readAsDataURL(blob)
    }
    recorder.stop()
  }

  const heading = phase === 'starting'  ? 'Getting ready…'
                : phase === 'recording' ? 'Speak now'
                : 'Processing…'

  return (
    <Shell gradient>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">

        {/* pulsing service icon */}
        <div className="relative mb-10">
          <span className="absolute inset-0 rounded-full bg-white/20 animate-pulse-ring" />
          <span
            className="absolute inset-0 rounded-full bg-white/10 animate-pulse-ring"
            style={{ animationDelay: '0.7s' }}
          />
          <div className="relative z-10 w-32 h-32 rounded-full bg-white/20
                          flex items-center justify-center">
            <Icon className="w-14 h-14 text-white" strokeWidth={2} />
          </div>
        </div>

        {/* status text */}
        <h1 className="text-white text-3xl font-bold">{heading}</h1>
        <p className="text-white/70 text-base mt-2 font-medium">
          {service.label} · {language.label}
        </p>

        {/* live mic level — reassures the user their voice is being captured */}
        {phase === 'recording' && !micError && (
          <div className="mt-5 w-44 h-2 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-75"
              style={{ width: `${Math.min(100, Math.round(level * 320))}%` }}
            />
          </div>
        )}

        {/* live status cards */}
        <div className="mt-10 w-full max-w-xs space-y-2.5">
          <StatusCard
            emoji="🗣️"
            label={
              micError              ? 'Microphone unavailable' :
              phase === 'starting'  ? 'Requesting microphone…' :
              phase === 'recording' ? 'Recording your message…' :
                                     'Recording complete'
            }
            status={micError ? 'error' : phase === 'recording' ? 'active' : phase === 'starting' ? 'pending' : 'ready'}
          />
          <StatusCard
            emoji="📍"
            label={
              geoStatus === 'ready' ? 'Location captured' :
              geoStatus === 'error' ? 'Location unavailable' :
                                     'Getting your location…'
            }
            status={geoStatus === 'ready' ? 'ready' : geoStatus === 'error' ? 'error' : 'active'}
          />
          <StatusCard emoji="📡" label="Reaching a dispatcher" status="pending" />
          <StatusCard emoji="🩺" label="First-aid guidance ready" status="pending" />
        </div>
      </div>

      {/* actions */}
      <div className="px-6 pb-12 space-y-3">
        {captureError && (
          <p className="text-center text-sm font-semibold text-red-100 bg-red-500/30
                        rounded-xl px-4 py-3">
            {captureError}
          </p>
        )}
        {!micError && (
          <button
            type="button"
            onClick={handleSend}
            disabled={phase !== 'recording'}
            className="w-full flex items-center justify-center
                       bg-white text-nkwa-700 font-bold py-4 rounded-2xl
                       disabled:opacity-50 disabled:cursor-not-allowed
                       hover:bg-white/90 active:scale-[0.98] transition-all"
          >
            {phase === 'encoding' ? 'Processing…' : 'Stop & Send'}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2
                     bg-white/15 hover:bg-white/25 active:scale-[0.98]
                     text-white font-semibold py-4 rounded-2xl transition-colors"
        >
          <X className="w-5 h-5" />
          Cancel call
        </button>
      </div>
    </Shell>
  )
}

function StatusCard({ emoji, label, status = 'pending' }) {
  const dot      = status === 'ready' ? '✓' : status === 'error' ? '✕' : status === 'active' ? '●' : '○'
  const dotColor = status === 'ready' ? 'text-green-300'
                 : status === 'error' ? 'text-red-300'
                 : status === 'active' ? 'text-white animate-pulse'
                 : 'text-white/30'
  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-left">
      <span className="text-xl flex-shrink-0">{emoji}</span>
      <p className="text-white/85 text-sm font-medium flex-1">{label}</p>
      <span className={`text-sm font-bold flex-shrink-0 ${dotColor}`}>{dot}</span>
    </div>
  )
}

// ─── Screen 5 — Processing ───────────────────────────────────────────────────

function ProcessingScreen({ service, language, audioBase64, coords, onDone, onCancel }) {
  const Icon = service.icon
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const initRes = await fetch(`${API}/api/v1/calls/initiate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_type: service.id,
            language:     language.code,
            gps_lat:      coords?.lat ?? 0,
            gps_lon:      coords?.lon ?? 0,
            audio_base64: audioBase64 ?? '',
          }),
        })

        if (!initRes.ok) {
          const body = await initRes.json().catch(() => ({}))
          throw new Error(body.detail || `Error ${initRes.status}`)
        }

        const { call_id } = await initRes.json()

        const detailRes = await fetch(`${API}/api/v1/calls/${call_id}`)
        if (!detailRes.ok) throw new Error('Could not retrieve call details')
        const detail = await detailRes.json()

        if (!cancelled) onDone(detail)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }

    run()
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <Shell gradient>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <p className="text-5xl">⚠️</p>
          <h1 className="text-white text-2xl font-bold">Something went wrong</h1>
          <p className="text-white/70 text-sm">{error}</p>
        </div>
        <div className="px-6 pb-12">
          <button
            type="button"
            onClick={onCancel}
            className="w-full bg-white/15 hover:bg-white/25 text-white font-semibold py-4 rounded-2xl transition-colors"
          >
            Go back
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell gradient>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="relative mb-10">
          <span className="absolute inset-0 rounded-full bg-white/20 animate-pulse-ring" />
          <span
            className="absolute inset-0 rounded-full bg-white/10 animate-pulse-ring"
            style={{ animationDelay: '0.7s' }}
          />
          <div className="relative z-10 w-32 h-32 rounded-full bg-white/20 flex items-center justify-center">
            <Icon className="w-14 h-14 text-white" strokeWidth={2} />
          </div>
        </div>

        <h1 className="text-white text-3xl font-bold">Analysing…</h1>
        <p className="text-white/70 text-base mt-2 font-medium">
          {service.label} · {language.label}
        </p>
        <p className="text-white/50 text-sm mt-6">This may take up to 30 seconds</p>
      </div>

      <div className="px-6 pb-12">
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2
                     bg-white/15 hover:bg-white/25 active:scale-[0.98]
                     text-white font-semibold py-4 rounded-2xl transition-colors"
        >
          <X className="w-5 h-5" />
          Cancel
        </button>
      </div>
    </Shell>
  )
}

// ─── Screen 6 — Result ────────────────────────────────────────────────────────

function ResultScreen({ result, onDone }) {
  const isPrank  = result.status === 'PRANK'
  const severity = result.severity

  const severityStyle =
    severity === 'CRITICAL'      ? 'bg-red-100 text-red-700'      :
    severity === 'URGENT'        ? 'bg-orange-100 text-orange-700' :
    severity === 'NON_EMERGENCY' ? 'bg-green-100 text-green-700'   :
    'bg-nkwa-50 text-nkwa-700'

  if (isPrank) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <p className="text-5xl">🚫</p>
          <h1 className="text-2xl font-bold text-ink-900">Prank Detected</h1>
          <p className="text-ink-500 text-sm max-w-xs">
            This call was flagged as a non-emergency. Please only use this service for genuine emergencies.
          </p>
        </div>
        <div className="px-6 pb-12">
          <button
            type="button"
            onClick={onDone}
            className="w-full bg-nkwa-gradient text-white font-bold py-4 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Done
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="px-6 pt-10 pb-8 flex-1 flex flex-col overflow-y-auto">

        <div className="mb-4">
          <h1 className="text-2xl font-bold text-ink-900">Help is on the way</h1>
          <p className="text-ink-500 text-sm mt-1">Dispatcher has been briefed</p>
        </div>

        <div className="flex items-center gap-3 mb-6">
          {severity && (
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${severityStyle}`}>
              {severity}
            </span>
          )}
          {result.incident_type && (
            <p className="text-ink-700 font-medium text-sm">{result.incident_type}</p>
          )}
        </div>

        {result.landmark_name && (
          <div className="bg-white rounded-2xl shadow-card p-4 mb-3">
            <p className="text-xs text-ink-400 font-medium uppercase tracking-wide mb-1">Location identified</p>
            <p className="font-semibold text-ink-900">{result.landmark_name}</p>
            {result.directions_narrative && (
              <p className="text-sm text-ink-500 mt-1">{result.directions_narrative}</p>
            )}
          </div>
        )}

        {result.first_aid_audio_url && (
          <div className="bg-white rounded-2xl shadow-card p-4 mb-3">
            <p className="text-xs text-ink-400 font-medium uppercase tracking-wide mb-2">First-aid audio</p>
            <audio controls src={result.first_aid_audio_url} className="w-full" />
          </div>
        )}

        {result.first_aid_script && (
          <div className="bg-white rounded-2xl shadow-card p-4 mb-6">
            <p className="text-xs text-ink-400 font-medium uppercase tracking-wide mb-1">Instructions</p>
            <p className="text-sm text-ink-700 leading-relaxed">{result.first_aid_script}</p>
          </div>
        )}

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={onDone}
            className="w-full bg-nkwa-gradient text-white font-bold py-4 rounded-2xl
                       hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </Shell>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,   setScreen]   = useState('home')
  const [service,  setService]  = useState(null)
  const [language, setLanguage] = useState(null)
  const [callData, setCallData] = useState(null)
  const [result,   setResult]   = useState(null)

  function reset() {
    setService(null)
    setLanguage(null)
    setCallData(null)
    setResult(null)
    setScreen('home')
  }

  if (screen === 'home') {
    return <HomeScreen onStart={() => setScreen('service')} />
  }

  if (screen === 'service') {
    return (
      <ServiceScreen
        onSelect={(s) => { setService(s); setScreen('language') }}
        onBack={reset}
      />
    )
  }

  if (screen === 'language') {
    return (
      <LanguageScreen
        service={service}
        onSelect={(l) => { setLanguage(l); setScreen('calling') }}
        onBack={() => setScreen('service')}
      />
    )
  }

  if (screen === 'calling') {
    return (
      <CallingScreen
        service={service}
        language={language}
        onCancel={reset}
        onSubmit={(data) => { setCallData(data); setScreen('processing') }}
      />
    )
  }

  if (screen === 'processing') {
    return (
      <ProcessingScreen
        service={service}
        language={language}
        audioBase64={callData?.audioBase64}
        coords={callData?.coords}
        onDone={(data) => { setResult(data); setScreen('result') }}
        onCancel={reset}
      />
    )
  }

  if (screen === 'result') {
    return <ResultScreen result={result} onDone={reset} />
  }

  return null
}
