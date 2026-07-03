// Display metadata shared across the console. Severity is a reserved status
// palette — every use pairs the colour with an icon and a written label.

export const SEVERITY = {
  CRITICAL: {
    label: 'Critical',
    hex:   '#FF5A70',
    text:  'text-sev-critical',
    chip:  'bg-sev-critical/15 text-sev-critical border border-sev-critical/40',
    spine: 'bg-sev-critical',
  },
  URGENT: {
    label: 'Urgent',
    hex:   '#FFB020',
    text:  'text-sev-urgent',
    chip:  'bg-sev-urgent/15 text-sev-urgent border border-sev-urgent/40',
    spine: 'bg-sev-urgent',
  },
  NON_EMERGENCY: {
    label: 'Non-emergency',
    hex:   '#4FAA7D',
    text:  'text-sev-ok',
    chip:  'bg-sev-ok/15 text-sev-ok border border-sev-ok/40',
    spine: 'bg-sev-ok',
  },
  PRANK: {
    label: 'Prank',
    hex:   '#8C9DB5',
    text:  'text-sev-prank',
    chip:  'bg-sev-prank/15 text-sev-prank border border-sev-prank/40',
    spine: 'bg-sev-prank',
  },
  PROCESSING: {
    label: 'Incoming',
    hex:   '#EFB93F',
    text:  'text-brand-gold',
    chip:  'bg-brand-gold/15 text-brand-gold border border-brand-gold/40',
    spine: 'bg-brand-gold',
  },
  FAILED: {
    label: 'Failed',
    hex:   '#8C9DB5',
    text:  'text-sev-prank',
    chip:  'bg-sev-prank/15 text-sev-prank border border-sev-prank/40',
    spine: 'bg-sev-prank',
  },
}

// Which status entry a call renders with.
export function severityOf(call) {
  if (!call) return SEVERITY.PROCESSING
  if (call.status === 'PRANK' || call.is_prank) return SEVERITY.PRANK
  if (call.status === 'FAILED') return SEVERITY.FAILED
  if (call.severity && SEVERITY[call.severity]) return SEVERITY[call.severity]
  return SEVERITY.PROCESSING
}

export const LANGUAGE_NAMES = {
  en:  'English',
  tw:  'Twi',
  gaa: 'Ga',
  ee:  'Ewe',
  fat: 'Fante',
  kus: 'Kusaal',
  dag: 'Dagbani',
}

export function languageName(code) {
  return LANGUAGE_NAMES[code] ?? code ?? '—'
}

export const EVENT_LABELS = {
  CALL_RECEIVED:       'Call received',
  TRANSCRIPTION_READY: 'Transcription ready',
  TRIAGE_COMPLETE:     'AI triage complete',
  PRANK_DETECTED:      'Prank detected — de-prioritised',
  LOCATION_RESOLVED:   'Location resolved',
  BRIEF_READY:         'Dispatcher brief ready',
  SNS_ALERT_SENT:      'SMS alert sent to response unit',
  ERROR:               'Pipeline error',
}

const SEV_RANK = { CRITICAL: 1, URGENT: 2, NON_EMERGENCY: 3 }

function feedRank(call) {
  if (call.status === 'PROCESSING') return 0 // live incoming call — always on top
  if (call.status === 'FAILED') return 4
  return SEV_RANK[call.severity] ?? 3
}

// Split calls into the main feed (severity-ordered, newest first within a
// band) and the prank queue (newest first).
export function partitionCalls(callsMap) {
  const all = [...callsMap.values()]
  const isPrank = (c) => c.status === 'PRANK' || c.is_prank
  const pranks = all.filter(isPrank)
  const feed = all.filter((c) => !isPrank(c))

  feed.sort((a, b) => {
    const rank = feedRank(a) - feedRank(b)
    if (rank !== 0) return rank
    return (b.timestamp ?? '').localeCompare(a.timestamp ?? '')
  })
  pranks.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))

  return { feed, pranks }
}

export function timeAgo(iso, nowMs = Date.now()) {
  if (!iso) return '—'
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return '—'
  const s = Math.max(0, Math.floor((nowMs - then) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function clockTime(iso) {
  if (!iso) return '--:--:--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--:--'
  return d.toLocaleTimeString('en-GB', { hour12: false })
}

export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return null
  return `${Number(seconds).toFixed(1)}s`
}

export function shortId(callId) {
  return callId ? callId.slice(0, 8) : '—'
}
