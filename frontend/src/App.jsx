import { useState } from 'react'
import {
  Phone, ChevronRight, ChevronLeft,
  Cross, Flame, Shield, Megaphone,
  Globe, X,
} from 'lucide-react'

const SERVICES = [
  {
    id:    'ambulance',
    label: 'Ambulance',
    sub:   'Medical emergency',
    icon:  Cross,
    bg:    'bg-service-ambulanceBg',
    text:  'text-service-ambulance',
  },
  {
    id:    'fire',
    label: 'Fire Service',
    sub:   'Fire & rescue',
    icon:  Flame,
    bg:    'bg-service-fireBg',
    text:  'text-service-fire',
  },
  {
    id:    'police',
    label: 'Police',
    sub:   'Crime & security',
    icon:  Shield,
    bg:    'bg-service-policeBg',
    text:  'text-service-police',
  },
  {
    id:    'sos',
    label: 'SOS Alert',
    sub:   'Instant panic dispatch',
    icon:  Megaphone,
    bg:    'bg-service-sosBg',
    text:  'text-service-sos',
  },
]

const LANGUAGES = [
  { code: 'EN', label: 'English', native: 'English' },
  { code: 'TW', label: 'Twi',     native: 'Twi'     },
  { code: 'GA', label: 'Ga',      native: 'Ga'       },
  { code: 'EW', label: 'Ewe',     native: 'Eʋegbe'   },
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
              onClick={() => onSelect(service)}
              className="w-full bg-white rounded-2xl shadow-card p-4
                         flex items-center gap-4
                         hover:shadow-card-lg transition-shadow active:scale-[0.98]
                         text-left"
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
              <ChevronRight className="w-5 h-5 text-ink-400 flex-shrink-0" />
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

function CallingScreen({ service, language, onCancel }) {
  const Icon = service.icon

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
        <h1 className="text-white text-3xl font-bold">Connecting…</h1>
        <p className="text-white/70 text-base mt-2 font-medium">
          {service.label} · {language.label}
        </p>

        {/* live status cards */}
        <div className="mt-10 w-full max-w-xs space-y-2.5">
          <StatusCard emoji="📡" label="Reaching a dispatcher" />
          <StatusCard emoji="📍" label="Sharing your location" />
          <StatusCard emoji="🗣️" label={`Listening in ${language.label}`} />
          <StatusCard emoji="🩺" label="First-aid guidance ready" />
        </div>
      </div>

      {/* cancel */}
      <div className="px-6 pb-12">
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

function StatusCard({ emoji, label }) {
  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 text-left">
      <span className="text-xl flex-shrink-0">{emoji}</span>
      <p className="text-white/85 text-sm font-medium">{label}</p>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,   setScreen]   = useState('home')
  const [service,  setService]  = useState(null)
  const [language, setLanguage] = useState(null)

  function reset() {
    setService(null)
    setLanguage(null)
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
      />
    )
  }

  return null
}
