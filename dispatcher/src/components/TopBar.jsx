import { useEffect, useState } from 'react'
import AdinkraMark from './AdinkraMark.jsx'

const CONN = {
  live:       { label: 'Live feed',  dot: 'bg-brand-gold',  text: 'text-brand-gold',  pulse: true  },
  polling:    { label: 'Polling',    dot: 'bg-sev-urgent',  text: 'text-sev-urgent',  pulse: false },
  connecting: { label: 'Connecting', dot: 'bg-text-low',    text: 'text-text-mid',    pulse: false },
}

export default function TopBar({ connection }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const conn = CONN[connection] ?? CONN.connecting

  return (
    <header className="flex items-center gap-3 px-6 py-4 border-b border-edge">
      <AdinkraMark className="w-8 h-8 text-brand-gold" />
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl font-bold tracking-tight">nkwa</span>
          <span className="font-display text-2xl font-semibold tracking-tight text-text-mid">dispatch</span>
        </div>
        <p className="font-mono text-[10px] font-medium text-text-low uppercase tracking-[0.22em]">
          Ghana 112 · Dispatcher console
        </p>
      </div>

      <div className="ml-auto flex items-center gap-5">
        {/* connection state — the console's live heartbeat */}
        <div className="flex items-center gap-2.5" role="status">
          <span className="relative flex w-2.5 h-2.5">
            {conn.pulse && (
              <span className={`absolute inset-0 rounded-full ${conn.dot} animate-pulse-ring`} />
            )}
            <span className={`relative w-2.5 h-2.5 rounded-full ${conn.dot}`} />
          </span>
          <span className={`font-mono text-xs font-medium uppercase tracking-[0.18em] ${conn.text}`}>
            {conn.label}
          </span>
        </div>

        <span className="font-mono text-sm text-text-mid tabular-nums">
          {now.toLocaleTimeString('en-GB', { hour12: false })}
        </span>
      </div>
    </header>
  )
}
