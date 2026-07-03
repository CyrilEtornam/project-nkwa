import { PhoneIncoming, HeartPulse, Ban, Timer, Siren } from 'lucide-react'
import { formatDuration } from '../lib/meta.js'

function Tile({ icon: Icon, label, value, tone = 'default' }) {
  const valueClass =
    tone === 'critical' ? 'text-sev-critical' : 'text-text-hi'
  const iconClass =
    tone === 'critical' ? 'text-sev-critical' : 'text-brand-green'

  return (
    <div className="flex items-center gap-3 bg-panel border border-edge rounded-xl px-4 py-3 min-w-0">
      <span className="w-9 h-9 rounded-lg bg-panel2 flex items-center justify-center flex-shrink-0">
        <Icon className={`w-[18px] h-[18px] ${iconClass}`} strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className={`text-2xl font-semibold leading-tight ${valueClass}`}>{value}</p>
        <p className="text-xs text-text-mid truncate">{label}</p>
      </div>
    </div>
  )
}

export default function StatsStrip({ stats }) {
  const s = stats ?? {}
  const critical = s.critical_active ?? 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 px-6 py-4">
      <Tile icon={PhoneIncoming} label="Calls today"        value={s.total_calls_today ?? '—'} />
      <Tile icon={HeartPulse}    label="Real emergencies"   value={s.real_emergencies_today ?? '—'} />
      <Tile icon={Ban}           label="Pranks filtered"    value={s.pranks_filtered_today ?? '—'} />
      <Tile icon={Timer}         label="Avg pipeline"       value={formatDuration(s.avg_pipeline_duration_seconds) ?? '—'} />
      <Tile
        icon={Siren}
        label="Critical active"
        value={critical}
        tone={critical > 0 ? 'critical' : 'default'}
      />
    </div>
  )
}
