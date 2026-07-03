import { useEffect, useState } from 'react'
import {
  Cross, Flame, Shield, Megaphone, MapPin, Ban,
  ChevronDown, Zap, LoaderCircle,
} from 'lucide-react'
import AdinkraMark from './AdinkraMark.jsx'
import { severityOf, languageName, timeAgo, formatDuration } from '../lib/meta.js'

const SERVICE_ICONS = { AMBULANCE: Cross, FIRE: Flame, POLICE: Shield, SOS: Megaphone }

function FeedCard({ call, selected, onSelect }) {
  const sev = severityOf(call)
  const ServiceIcon = SERVICE_ICONS[call.service_type] ?? Cross
  const processing = call.status === 'PROCESSING'
  const dimmed = call.status === 'ENDED'

  return (
    <button
      type="button"
      onClick={() => onSelect(call.call_id)}
      aria-pressed={selected}
      className={`relative w-full text-left rounded-xl border overflow-hidden transition-colors
                  ${call.live ? 'animate-card-in' : ''}
                  ${dimmed ? 'opacity-55' : ''}
                  ${selected
                    ? 'border-brand-gold/60 bg-panel2 shadow-glow'
                    : 'border-edge bg-panel hover:border-edge2 hover:bg-panel2'}`}
    >
      {/* severity spine */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${sev.spine}`} aria-hidden="true" />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md
                            font-display text-xs font-bold uppercase tracking-wide ${sev.chip}`}>
            {processing && <LoaderCircle className="w-3 h-3 animate-spin" />}
            {sev.label}
          </span>
          {call.sns_alert && (
            <span title="SMS alert sent">
              <Zap className="w-3.5 h-3.5 text-sev-critical" aria-label="SMS alert sent" />
            </span>
          )}
          <span className="ml-auto font-mono text-[11px] text-text-low">
            {timeAgo(call.timestamp)}
          </span>
        </div>

        <p className="mt-2 font-semibold text-[15px] leading-snug text-text-hi">
          {processing ? 'Triaging call…' : (call.incident_type ?? call.error_message ?? 'Unclassified')}
        </p>

        <p className="mt-1 flex items-center gap-1.5 text-xs text-text-mid min-w-0">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {call.landmark_name ?? (processing ? 'Locating…' : 'No location')}
          </span>
        </p>

        <div className="mt-2 flex items-center gap-3 text-xs text-text-low">
          <span className="flex items-center gap-1">
            <ServiceIcon className="w-3.5 h-3.5" />
            {call.service_type ?? '—'}
          </span>
          <span>{languageName(call.language)}</span>
          {call.pipeline_duration_seconds != null && (
            <span className="ml-auto font-mono">{formatDuration(call.pipeline_duration_seconds)}</span>
          )}
        </div>
      </div>
    </button>
  )
}

function PrankCard({ call, selected, onSelect }) {
  const confidence = call.prank_confidence != null
    ? `${Math.round(call.prank_confidence * 100)}%`
    : '—'
  return (
    <button
      type="button"
      onClick={() => onSelect(call.call_id)}
      aria-pressed={selected}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors
                  ${selected
                    ? 'border-brand-gold/60 bg-panel2'
                    : 'border-edge bg-panel hover:border-edge2'}`}
    >
      <div className="flex items-center gap-2">
        <Ban className="w-3.5 h-3.5 text-sev-prank flex-shrink-0" />
        <span className="text-sm text-text-mid truncate flex-1">
          {call.transcription_translated || call.transcription_original || 'No speech detected'}
        </span>
        <span className="font-mono text-[11px] text-text-low flex-shrink-0">{confidence}</span>
      </div>
    </button>
  )
}

export default function CallFeed({ feed, pranks, selectedId, onSelect }) {
  const [pranksOpen, setPranksOpen] = useState(false)

  // pop the queue open the first time a prank actually arrives
  useEffect(() => {
    if (pranks.length > 0) setPranksOpen(true)
  }, [pranks.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="flex flex-col min-h-0" aria-label="Live call feed">
      <div className="flex items-baseline gap-2 pb-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Live feed</h2>
        <span className="font-mono text-xs text-text-low">{feed.length}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 pb-2">
        {feed.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <AdinkraMark className="w-10 h-10 text-edge2" />
            <p className="text-sm text-text-mid max-w-[220px]">
              No calls yet. The feed updates live as calls come in.
            </p>
          </div>
        )}
        {feed.map((call) => (
          <FeedCard
            key={call.call_id}
            call={call}
            selected={call.call_id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* prank queue — separate from the main feed by design */}
      <div className="border-t border-edge pt-3 mt-1">
        <button
          type="button"
          onClick={() => setPranksOpen((o) => !o)}
          aria-expanded={pranksOpen}
          className="w-full flex items-center gap-2 text-left"
        >
          <Ban className="w-4 h-4 text-sev-prank" />
          <span className="font-display text-sm font-bold tracking-tight">Prank queue</span>
          <span className="font-mono text-xs text-text-low">{pranks.length}</span>
          <ChevronDown
            className={`w-4 h-4 text-text-low ml-auto transition-transform ${pranksOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {pranksOpen && (
          <div className="mt-2.5 space-y-2 max-h-48 overflow-y-auto pr-1">
            {pranks.length === 0 && (
              <p className="text-xs text-text-low py-2">Nothing filtered yet today.</p>
            )}
            {pranks.map((call) => (
              <PrankCard
                key={call.call_id}
                call={call}
                selected={call.call_id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
