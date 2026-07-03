import { useEffect, useRef, useState } from 'react'
import { WifiOff } from 'lucide-react'
import TopBar from './components/TopBar.jsx'
import StatsStrip from './components/StatsStrip.jsx'
import CallFeed from './components/CallFeed.jsx'
import CallDetail from './components/CallDetail.jsx'
import { useNkwaFeed, API } from './lib/useNkwaFeed.js'
import { partitionCalls } from './lib/meta.js'

export default function App() {
  const { calls, stats, connection, backendDown } = useNkwaFeed()
  const [selectedId, setSelectedId] = useState(null)
  const manualPick = useRef(false)

  const { feed, pranks } = partitionCalls(calls)
  const selected = selectedId ? calls.get(selectedId) : null

  // Keep the top of the feed selected until the dispatcher picks a call
  // themselves — live cards then fill in in place.
  useEffect(() => {
    if (manualPick.current && selectedId && calls.has(selectedId)) return
    const top = feed[0] ?? pranks[0]
    if (top && top.call_id !== selectedId) setSelectedId(top.call_id)
  }, [feed, pranks, selectedId, calls])

  function handleSelect(id) {
    manualPick.current = true
    setSelectedId(id)
  }

  return (
    <div className="h-screen flex flex-col animate-screen-in">
      <TopBar connection={connection} />

      {backendDown && (
        <div className="flex items-center gap-2.5 mx-6 mt-4 px-4 py-2.5 rounded-lg
                        border border-sev-urgent/40 bg-sev-urgent/10 text-sm">
          <WifiOff className="w-4 h-4 text-sev-urgent flex-shrink-0" />
          <span className="text-text-hi">
            Backend unreachable at <span className="font-mono text-xs">{API}</span> — retrying automatically.
          </span>
        </div>
      )}

      <StatsStrip stats={stats} />

      <main className="flex-1 min-h-0 grid lg:grid-cols-[380px_1fr] gap-6 px-6 pb-6">
        <CallFeed
          feed={feed}
          pranks={pranks}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
        <CallDetail call={selected} />
      </main>
    </div>
  )
}
