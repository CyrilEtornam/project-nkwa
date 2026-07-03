import { useState, useEffect, useRef } from 'react'
import {
  Phone, ChevronRight, ChevronLeft,
  Cross, Flame, Shield, Megaphone, X,
  Languages, MapPin, HeartPulse, Timer,
  Mic, Radio, AlertTriangle, Ban, Check,
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
  { code: 'en',  label: 'English', native: 'English', glyph: 'En' },
  { code: 'tw',  label: 'Twi',     native: 'Twi',     glyph: 'Tw' },
  // Khaya's speech-to-text has no Ga model yet, so Ga voice calls can't be
  // transcribed. Keep it visible but flag it so we show a clear message.
  { code: 'gaa', label: 'Ga',      native: 'Gã',      glyph: 'Gã', voiceSupported: false },
  { code: 'ee',  label: 'Ewe',     native: 'Eʋegbe',  glyph: 'Eʋ' },
]

// ─── Brand mark ───────────────────────────────────────────────────────────────

// Adinkrahene — the "chief of adinkra" symbol, three concentric circles. It is
// the app's mark, the pulse around the call button, and the watermark on the
// in-call screens: rings radiating outward, a signal going out for help.
function AdinkraMark({ className }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="6.5" fill="currentColor" />
      <circle cx="24" cy="24" r="14" fill="none" stroke="currentColor" strokeWidth="3.5" />
      <circle cx="24" cy="24" r="21.5" fill="none" stroke="currentColor" strokeWidth="3.5" />
    </svg>
  )
}

// ─── Shell wrapper ────────────────────────────────────────────────────────────

function Shell({ children, gradient = false }) {
  return (
    <div className={`min-h-screen ${gradient ? 'bg-nkwa-gradient relative overflow-hidden' : 'bg-surface'}`}>
      {gradient && (
        <AdinkraMark className="absolute -top-24 -right-24 w-96 h-96 text-white/[0.05] pointer-events-none" />
      )}
      <div className="relative max-w-md mx-auto min-h-screen flex flex-col animate-screen-in">
        {children}
      </div>
    </div>
  )
}

// ─── Screen 1 — Home ─────────────────────────────────────────────────────────

const HOME_FEATURES = [
  { icon: Languages, text: 'Twi, Ga, Ewe, English' },
  { icon: MapPin,    text: 'Landmark location'     },
  { icon: HeartPulse, text: 'Live first-aid guide' },
  { icon: Timer,     text: 'Under 30 seconds'      },
]

function HomeScreen({ onStart }) {
  return (
    <Shell>
      {/* brand row */}
      <div className="px-6 pt-8 flex items-center gap-2.5">
        <AdinkraMark className="w-7 h-7 text-nkwa-600" />
        <span className="font-display text-2xl font-bold text-ink-900 tracking-tight">nkwa</span>
        <span className="ml-auto font-mono text-[11px] font-medium text-ink-400 uppercase tracking-[0.18em]">
          Ghana 112
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">

        {/* big call button with radiating adinkrahene rings */}
        <div className="relative mb-10">
          <span className="absolute inset-0 rounded-full border-[3px] border-nkwa-400/60 animate-pulse-ring" />
          <span
            className="absolute inset-0 rounded-full border-2 border-nkwa-300/50 animate-pulse-ring"
            style={{ animationDelay: '0.6s' }}
          />
          <button
            type="button"
            onClick={onStart}
            aria-label="Start emergency call"
            className="relative z-10 w-40 h-40 rounded-full bg-nkwa-gradient shadow-card-lg
                       flex items-center justify-center animate-breathe
                       transition-transform active:scale-95 hover:shadow-2xl"
          >
            <Phone className="w-16 h-16 text-white" strokeWidth={2} />
          </button>
        </div>

        <h1 className="font-display text-4xl font-bold text-ink-900 mb-3 tracking-tight">
          Call for help
        </h1>
        <p className="text-ink-500 text-sm leading-relaxed max-w-xs">
          Tap the button to reach Ghana's 112 emergency line.
          Speak in any Ghanaian language — we'll handle the rest.
        </p>

        {/* feature chips */}
        <div className="mt-10 grid grid-cols-2 gap-3 w-full max-w-xs text-left">
          {HOME_FEATURES.map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2.5 bg-white rounded-xl px-3 py-2.5
                         border border-nkwa-100 shadow-card"
            >
              <span className="w-7 h-7 rounded-lg bg-nkwa-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-nkwa-600" strokeWidth={2.25} />
              </span>
              <span className="text-xs font-medium text-ink-700">{text}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-ink-400 pb-8">
        Nkwa — <span className="italic">life</span> in Twi
        <span className="text-ink-900 mx-1.5">★</span>
        112 Emergency Copilot
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
          <p className="font-mono text-[11px] font-medium text-nkwa-600 uppercase tracking-[0.18em]">
            Step 1 of 2
          </p>
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">Choose a service</h1>
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
              className={`w-full bg-white rounded-2xl border border-nkwa-100 shadow-card p-4
                         flex items-center gap-4 text-left transition-all
                         ${service.disabled
                           ? 'opacity-50 cursor-not-allowed'
                           : 'hover:shadow-card-lg hover:border-nkwa-200 active:scale-[0.98]'}`}
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
          <p className="font-mono text-[11px] font-medium text-nkwa-600 uppercase tracking-[0.18em]">
            Step 2 of 2 · {service.label}
          </p>
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">Choose your language</h1>
        </div>
      </div>

      {/* language list */}
      <div className="flex-1 px-6 pb-8 pt-2 space-y-3">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => onSelect(lang)}
            className="w-full bg-white rounded-2xl border border-nkwa-100 shadow-card p-4
                       flex items-center gap-4
                       hover:shadow-card-lg hover:border-nkwa-200 transition-all active:scale-[0.98]
                       text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-nkwa-50 flex items-center justify-center flex-shrink-0">
              <span className="font-display text-lg font-bold text-nkwa-600">{lang.glyph}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-ink-900">{lang.label}</p>
              {lang.native !== lang.label && (
                <p className="text-sm text-ink-500">{lang.native}</p>
              )}
            </div>
            {lang.voiceSupported === false && (
              <span className="text-xs font-semibold text-ink-400 bg-ink-400/10 px-2 py-1 rounded-full flex-shrink-0">
                Voice soon
              </span>
            )}
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

// Relative heights for the live waveform bars — a calm symmetric shape that
// the measured mic level scales up and down.
const WAVE_BARS = [0.45, 0.7, 0.95, 1, 0.95, 0.7, 0.45]

function formatElapsed(ms) {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function CallingScreen({ service, language, onCancel, onSubmit }) {
  const Icon = service.icon

  // Khaya ASR has no model for this language — a voice call would always fail
  // at transcription, so we skip recording and show a clear message instead.
  const voiceUnsupported = language.voiceSupported === false

  const [phase,        setPhase]        = useState('starting')  // starting | recording | encoding
  const [geoStatus,    setGeoStatus]    = useState('pending')   // pending | ready | error
  const [micError,     setMicError]     = useState(false)
  const [coords,       setCoords]       = useState(null)
  const [level,        setLevel]        = useState(0)           // live mic level 0..1
  const [captureError, setCaptureError] = useState(null)
  const [elapsed,      setElapsed]      = useState(0)           // ms recorded so far

  const recorderRef    = useRef(null)
  const chunksRef      = useRef([])
  const streamRef      = useRef(null)
  const audioCtxRef    = useRef(null)
  const rafRef         = useRef(null)
  const peakLevelRef   = useRef(0)        // loudest RMS seen across the recording
  const startTimeRef   = useRef(0)

  useEffect(() => {
    if (voiceUnsupported) return   // no mic/recording for unsupported languages
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

  // Tick a live recording timer so the caller can see we're capturing and knows
  // to keep speaking. Reads the recorder's real start time; stops when we leave
  // the recording phase.
  useEffect(() => {
    if (phase !== 'recording' || micError) return
    const id = setInterval(() => {
      setElapsed(Date.now() - startTimeRef.current)
    }, 250)
    return () => clearInterval(id)
  }, [phase, micError])

  function handleSend() {
    const recorder = recorderRef.current

    if (!recorder || recorder.state === 'inactive') {
      onSubmit({ audioBase64: null, coords })
      return
    }

    // Validate BEFORE stopping so the user can keep speaking and retry without
    // losing the recorder. These guards stop silent/empty audio from reaching
    // the backend, where it would fail with a confusing transcription error.
    const elapsedMs = Date.now() - startTimeRef.current
    if (elapsedMs < MIN_RECORDING_MS) {
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

  if (voiceUnsupported) {
    return (
      <Shell gradient>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <span className="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center">
            <Languages className="w-10 h-10 text-white" strokeWidth={2} />
          </span>
          <h1 className="font-display text-white text-2xl font-bold tracking-tight">
            {language.label} voice calls aren't supported yet
          </h1>
          <p className="text-white/80 text-sm max-w-xs leading-relaxed">
            We can't transcribe {language.label} speech yet. Please go back and choose
            English, Twi, or Ewe — or call 112 directly for {language.label}.
          </p>
        </div>
        <div className="px-6 pb-12">
          <button
            type="button"
            onClick={onCancel}
            className="w-full flex items-center justify-center gap-2
                       bg-white/15 hover:bg-white/25 active:scale-[0.98]
                       text-white font-semibold py-4 rounded-2xl transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
            Choose another language
          </button>
        </div>
      </Shell>
    )
  }

  const heading = phase === 'starting'  ? 'Getting ready…'
                : phase === 'recording' ? 'Speak now'
                : 'Processing…'

  return (
    <Shell gradient>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">

        {/* pulsing service icon */}
        <div className="relative mb-10">
          <span className="absolute inset-0 rounded-full border-[3px] border-white/40 animate-pulse-ring" />
          <span
            className="absolute inset-0 rounded-full border-2 border-white/25 animate-pulse-ring"
            style={{ animationDelay: '0.7s' }}
          />
          <div className="relative z-10 w-32 h-32 rounded-full bg-white/20
                          flex items-center justify-center">
            <Icon className="w-14 h-14 text-white" strokeWidth={2} />
          </div>
        </div>

        {/* status text */}
        <h1 className="font-display text-white text-3xl font-bold tracking-tight">{heading}</h1>
        <p className="text-white/70 text-base mt-2 font-medium">
          {service.label} · {language.label}
        </p>

        {/* live waveform + recording timer — reassures the caller their voice is
            being captured and that they should keep speaking */}
        {phase === 'recording' && !micError && (
          <>
            <div className="mt-6 flex items-end justify-center gap-1.5 h-10" aria-hidden="true">
              {WAVE_BARS.map((mult, i) => {
                const h = Math.min(100, Math.max(22, level * 320 * mult))
                return (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-gold-400 transition-[height] duration-75"
                    style={{ height: `${h}%` }}
                  />
                )
              })}
            </div>
            <p className="mt-3 text-sm">
              <span className="font-mono font-medium text-gold-300 tracking-wide">
                {formatElapsed(elapsed)}
              </span>
              <span className="text-white/60 font-medium"> · keep speaking</span>
            </p>
          </>
        )}

        {/* live status cards */}
        <div className="mt-8 w-full max-w-xs space-y-2.5">
          <StatusCard
            icon={Mic}
            label={
              micError              ? 'Microphone unavailable' :
              phase === 'starting'  ? 'Requesting microphone…' :
              phase === 'recording' ? 'Recording your message…' :
                                     'Recording complete'
            }
            status={micError ? 'error' : phase === 'recording' ? 'active' : phase === 'starting' ? 'pending' : 'ready'}
          />
          <StatusCard
            icon={MapPin}
            label={
              geoStatus === 'ready' ? 'Location captured' :
              geoStatus === 'error' ? 'Location unavailable' :
                                     'Getting your location…'
            }
            status={geoStatus === 'ready' ? 'ready' : geoStatus === 'error' ? 'error' : 'active'}
          />
          <StatusCard icon={Radio} label="Reaching a dispatcher" status="pending" />
          <StatusCard icon={HeartPulse} label="First-aid guidance ready" status="pending" />
        </div>
      </div>

      {/* actions */}
      <div className="px-6 pb-12 space-y-3">
        {captureError && (
          <p className="text-center text-sm font-semibold text-service-sos bg-white/95
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
                     text-white font-semibold py-4 rounded-2xl transition-all"
        >
          <X className="w-5 h-5" />
          Cancel call
        </button>
      </div>
    </Shell>
  )
}

function StatusCard({ icon: Icon, label, status = 'pending' }) {
  const indicator =
    status === 'ready' ? <Check className="w-4 h-4 text-green-300" strokeWidth={3} />
  : status === 'error' ? <X className="w-4 h-4 text-red-300" strokeWidth={3} />
  : status === 'active' ? <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
  : <span className="w-2.5 h-2.5 rounded-full border-2 border-white/30" />

  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-left">
      <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-white" strokeWidth={2.25} />
      </span>
      <p className="text-white/85 text-sm font-medium flex-1">{label}</p>
      <span className="flex items-center justify-center w-5 flex-shrink-0">{indicator}</span>
    </div>
  )
}

// ─── Screen 5 — Processing ───────────────────────────────────────────────────

const PIPELINE_STEPS = [
  'Transcribing your message',
  'Understanding the emergency',
  'Pinpointing your location',
  'Preparing first-aid guidance',
]

function ProcessingScreen({ service, language, audioBase64, coords, onDone, onCancel }) {
  const Icon = service.icon
  const [error, setError] = useState(null)
  const [step,  setStep]  = useState(0)   // index of the step currently in progress

  // Advance the visual pipeline while the real request is in flight. Caps at the
  // last step so it stays "in progress" until the response actually arrives.
  useEffect(() => {
    if (error) return
    const id = setInterval(() => {
      setStep(s => Math.min(s + 1, PIPELINE_STEPS.length - 1))
    }, 6000)
    return () => clearInterval(id)
  }, [error])

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
          <span className="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-white" strokeWidth={2} />
          </span>
          <h1 className="font-display text-white text-2xl font-bold tracking-tight">We couldn't send your call</h1>
          <p className="text-white/80 text-sm max-w-xs leading-relaxed">
            Check your connection and try again. If this keeps happening, call 112 directly.
          </p>
          <p className="font-mono text-white/50 text-xs">{error}</p>
        </div>
        <div className="px-6 pb-12">
          <button
            type="button"
            onClick={onCancel}
            className="w-full bg-white/15 hover:bg-white/25 text-white font-semibold py-4 rounded-2xl transition-all"
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
          <span className="absolute inset-0 rounded-full border-[3px] border-white/40 animate-pulse-ring" />
          <span
            className="absolute inset-0 rounded-full border-2 border-white/25 animate-pulse-ring"
            style={{ animationDelay: '0.7s' }}
          />
          <div className="relative z-10 w-32 h-32 rounded-full bg-white/20 flex items-center justify-center">
            <Icon className="w-14 h-14 text-white" strokeWidth={2} />
          </div>
        </div>

        <h1 className="font-display text-white text-3xl font-bold tracking-tight">Analysing…</h1>
        <p className="text-white/70 text-base mt-2 font-medium">
          {service.label} · {language.label}
        </p>

        {/* live pipeline — makes the wait feel alive and shows what's happening */}
        <div className="mt-8 w-full max-w-xs space-y-2.5">
          {PIPELINE_STEPS.map((label, i) => (
            <StatusCard
              key={label}
              icon={i < step ? Check : Timer}
              label={label}
              status={i < step ? 'ready' : i === step ? 'active' : 'pending'}
            />
          ))}
        </div>

        <p className="text-white/50 text-sm mt-6">This may take up to 30 seconds</p>
      </div>

      <div className="px-6 pb-12">
        <button
          type="button"
          onClick={onCancel}
          className="w-full flex items-center justify-center gap-2
                     bg-white/15 hover:bg-white/25 active:scale-[0.98]
                     text-white font-semibold py-4 rounded-2xl transition-all"
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
    severity === 'CRITICAL'      ? 'bg-service-sosBg text-service-sos'  :
    severity === 'URGENT'        ? 'bg-orange-100 text-orange-700'      :
    severity === 'NON_EMERGENCY' ? 'bg-nkwa-100 text-nkwa-700'          :
    'bg-nkwa-50 text-nkwa-700'

  if (isPrank) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4">
          <span className="w-20 h-20 rounded-full bg-service-sosBg flex items-center justify-center">
            <Ban className="w-10 h-10 text-service-sos" strokeWidth={2} />
          </span>
          <h1 className="font-display text-2xl font-bold text-ink-900 tracking-tight">Prank detected</h1>
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
          <h1 className="font-display text-3xl font-bold text-ink-900 tracking-tight">Help is on the way</h1>
          <p className="text-ink-500 text-sm mt-1">Dispatcher has been briefed</p>
        </div>

        <div className="flex items-center gap-3 mb-6">
          {severity && (
            <span className={`px-3 py-1 rounded-lg font-display text-sm font-bold uppercase tracking-wide ${severityStyle}`}>
              {severity.replace('_', ' ')}
            </span>
          )}
          {result.incident_type && (
            <p className="text-ink-700 font-medium text-sm">{result.incident_type}</p>
          )}
        </div>

        {result.landmark_name && (
          <div className="bg-white rounded-2xl border border-nkwa-100 shadow-card p-4 mb-3">
            <p className="font-mono text-[11px] font-medium text-ink-400 uppercase tracking-[0.18em] mb-1">Location identified</p>
            <p className="font-semibold text-ink-900">{result.landmark_name}</p>
            {result.directions_narrative && (
              <p className="text-sm text-ink-500 mt-1">{result.directions_narrative}</p>
            )}
          </div>
        )}

        {result.first_aid_audio_url && (
          <div className="bg-white rounded-2xl border border-nkwa-100 shadow-card p-4 mb-3">
            <p className="font-mono text-[11px] font-medium text-ink-400 uppercase tracking-[0.18em] mb-2">First-aid audio</p>
            <audio controls src={result.first_aid_audio_url} className="w-full" />
          </div>
        )}

        {result.first_aid_script && (
          <div className="bg-white rounded-2xl border border-nkwa-100 shadow-card p-4 mb-6">
            <p className="font-mono text-[11px] font-medium text-ink-400 uppercase tracking-[0.18em] mb-1">Instructions</p>
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
