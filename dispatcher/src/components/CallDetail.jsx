import {
  Cross, Flame, Shield, Megaphone, MapPin, Zap, LoaderCircle,
  Languages, HeartPulse, AlertTriangle, ListTree,
} from 'lucide-react'
import AdinkraMark from './AdinkraMark.jsx'
import CallMap from './CallMap.jsx'
import {
  severityOf, languageName, clockTime, formatDuration, shortId, EVENT_LABELS,
} from '../lib/meta.js'

const SERVICE_ICONS = { AMBULANCE: Cross, FIRE: Flame, POLICE: Shield, SOS: Megaphone }

function Label({ children }) {
  return (
    <p className="font-mono text-[11px] font-medium text-text-low uppercase tracking-[0.18em] mb-2">
      {children}
    </p>
  )
}

function Panel({ children, className = '' }) {
  return (
    <div className={`bg-panel border border-edge rounded-xl p-4 ${className}`}>
      {children}
    </div>
  )
}

export default function CallDetail({ call }) {
  if (!call) {
    return (
      <section className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 text-center">
        <AdinkraMark className="w-14 h-14 text-edge2" />
        <p className="text-sm text-text-mid max-w-[260px]">
          Select a call from the feed to see the dispatcher brief.
        </p>
      </section>
    )
  }

  const sev = severityOf(call)
  const ServiceIcon = SERVICE_ICONS[call.service_type] ?? Cross
  const processing = call.status === 'PROCESSING'
  const isPrank = call.status === 'PRANK' || call.is_prank
  const isEnglish = call.language === 'en'
  const events = call.events ?? []

  return (
    <section className="flex-1 min-h-0 overflow-y-auto pr-1" aria-label="Call detail">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 pb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg
                          font-display text-sm font-bold uppercase tracking-wide ${sev.chip}`}>
          {processing && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
          {sev.label}
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight">
          {processing ? 'Incoming call' : (call.incident_type ?? (isPrank ? 'Prank call' : 'Unclassified'))}
        </h2>
        {call.recommended_response_unit && call.recommended_response_unit !== 'NONE' && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-brand-deep/30
                           border border-brand-green/40 font-display text-sm font-bold uppercase
                           tracking-wide text-brand-green">
            <ServiceIcon className="w-3.5 h-3.5" />
            Dispatch {call.recommended_response_unit}
          </span>
        )}
      </div>

      {/* meta line */}
      <p className="font-mono text-xs text-text-low pb-4 flex flex-wrap gap-x-4 gap-y-1">
        <span>ID {shortId(call.call_id)}</span>
        <span>{clockTime(call.timestamp)}</span>
        <span>{languageName(call.language)}</span>
        <span>{call.service_type ?? '—'}</span>
        {call.pipeline_duration_seconds != null && (
          <span className="text-brand-gold">pipeline {formatDuration(call.pipeline_duration_seconds)}</span>
        )}
        {call.confidence != null && <span>confidence {Math.round(call.confidence * 100)}%</span>}
      </p>

      {/* failure banner */}
      {call.status === 'FAILED' && (
        <Panel className="mb-3 border-sev-critical/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-sev-critical mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-sev-critical">
                Pipeline failed{call.failure_stage ? ` at ${call.failure_stage}` : ''}
              </p>
              {call.error_message && (
                <p className="text-sm text-text-mid mt-1">{call.error_message}</p>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* SNS alert banner */}
      {call.sns_alert && (
        <Panel className="mb-3 border-sev-critical/40 bg-sev-critical/[0.06]">
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-sev-critical flex-shrink-0" />
            <p className="text-sm text-text-hi">
              <span className="font-semibold text-sev-critical">SMS alert sent to response unit.</span>{' '}
              {typeof call.sns_alert === 'string' ? call.sns_alert : ''}
            </p>
          </div>
        </Panel>
      )}

      {/* dispatcher brief — the payload this console exists to deliver */}
      {call.dispatcher_brief && (
        <div className="mb-3 bg-panel2 border border-brand-gold/30 rounded-xl p-5 relative overflow-hidden">
          <AdinkraMark className="absolute -right-8 -top-8 w-32 h-32 text-brand-gold/[0.06] pointer-events-none" />
          <Label>Dispatcher brief</Label>
          <p className="text-[15px] leading-relaxed text-text-hi">{call.dispatcher_brief}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-3">
        {/* left column — what the caller said, first aid */}
        <div className="space-y-3 min-w-0">
          {(call.transcription_original || call.transcription_translated) && (
            <Panel>
              <Label>
                {isEnglish ? 'Transcript' : `Caller said · ${languageName(call.language)}`}
              </Label>
              <p className="text-sm leading-relaxed text-text-hi">
                {call.transcription_original ?? '—'}
              </p>
              {!isEnglish && call.transcription_translated && (
                <div className="mt-3 pt-3 border-t border-edge">
                  <Label>English translation</Label>
                  <p className="text-sm leading-relaxed text-text-mid flex gap-2">
                    <Languages className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-green" />
                    <span>{call.transcription_translated}</span>
                  </p>
                </div>
              )}
            </Panel>
          )}

          {(call.first_aid_audio_url || call.first_aid_script) && (
            <Panel>
              <Label>First aid delivered to caller</Label>
              {call.first_aid_audio_url && (
                <audio controls src={call.first_aid_audio_url} className="w-full h-10 mb-3" />
              )}
              {call.first_aid_script && (
                <p className="text-sm leading-relaxed text-text-mid flex gap-2 max-h-40 overflow-y-auto">
                  <HeartPulse className="w-4 h-4 flex-shrink-0 mt-0.5 text-brand-green" />
                  <span>{call.first_aid_script}</span>
                </p>
              )}
            </Panel>
          )}

          {isPrank && (
            <Panel>
              <Label>Why it was filtered</Label>
              <p className="text-sm leading-relaxed text-text-mid">
                Flagged {call.prank_confidence != null ? `with ${Math.round(call.prank_confidence * 100)}% confidence` : ''} as
                a prank. The pipeline stopped after triage — no location lookup, first aid, or
                alert was spent on this call.
              </p>
            </Panel>
          )}
        </div>

        {/* right column — where they are, pipeline trace */}
        <div className="space-y-3 min-w-0">
          {!isPrank && <CallMap call={call} />}

          {(call.landmark_name || call.directions_narrative) && (
            <Panel>
              <Label>Caller location</Label>
              <p className="font-semibold text-[15px] text-text-hi flex items-center gap-2">
                <MapPin className="w-4 h-4 text-brand-gold flex-shrink-0" />
                {call.landmark_name ?? 'Unknown'}
              </p>
              {call.directions_narrative && (
                <p className="text-sm text-text-mid mt-1.5 leading-relaxed">{call.directions_narrative}</p>
              )}
              {call.gps_lat != null && call.gps_lon != null && (
                <p className="font-mono text-xs text-text-low mt-2">
                  {call.gps_lat.toFixed(5)}, {call.gps_lon.toFixed(5)}
                </p>
              )}
            </Panel>
          )}

          {events.length > 0 && (
            <Panel>
              <Label>Pipeline trace</Label>
              <ol className="space-y-2">
                {events.map((e, i) => (
                  <li key={`${e.type}-${i}`} className="flex items-center gap-3 text-sm">
                    <ListTree className="w-3.5 h-3.5 text-brand-green flex-shrink-0" />
                    <span className="text-text-hi flex-1">{EVENT_LABELS[e.type] ?? e.type}</span>
                    <span className="font-mono text-xs text-text-low">{clockTime(e.timestamp)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </div>
      </div>
    </section>
  )
}
