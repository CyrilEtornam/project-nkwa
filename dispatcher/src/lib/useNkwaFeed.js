import { useCallback, useEffect, useRef, useState } from 'react'

export const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const WS_URL = API.replace(/^http/, 'ws') + '/ws'

const POLL_MS = 12_000        // REST fallback cadence when the socket is down
const STATS_REFRESH_MS = 60_000
const PING_MS = 25_000
const MAX_BACKOFF_MS = 30_000

function num(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

// DynamoDB records arrive with numbers serialised as strings — normalise once
// so every component reads real numbers.
function fromRecord(r) {
  return {
    ...r,
    gps_lat: num(r.gps_lat),
    gps_lon: num(r.gps_lon),
    confidence: num(r.confidence),
    prank_confidence: num(r.prank_confidence),
    pipeline_duration_seconds: num(r.pipeline_duration_seconds),
    events: [],
    live: false,
  }
}

// Fold one WebSocket event into the calls map. Events render incrementally:
// a call card appears on CALL_RECEIVED and fills in as the pipeline runs.
function applyEvent(calls, msg) {
  const { type, call_id, timestamp, payload = {} } = msg
  if (!call_id) return calls

  const prev = calls.get(call_id) ?? {
    call_id,
    timestamp,
    status: 'PROCESSING',
    events: [],
  }
  const next = {
    ...prev,
    live: true,
    events: [...prev.events, { type, timestamp }],
  }

  switch (type) {
    case 'CALL_RECEIVED':
      Object.assign(next, {
        status: 'PROCESSING',
        timestamp,
        service_type: payload.service_type,
        language: payload.language,
        gps_lat: payload.gps?.lat ?? null,
        gps_lon: payload.gps?.lon ?? null,
      })
      break
    case 'TRANSCRIPTION_READY':
      Object.assign(next, {
        transcription_original: payload.transcription_original,
        transcription_translated: payload.transcription_translated,
      })
      break
    case 'TRIAGE_COMPLETE':
      Object.assign(next, {
        severity: payload.severity,
        call_classification: payload.call_classification,
        is_prank: payload.is_prank,
        incident_type: payload.incident_type,
        confidence: payload.confidence,
      })
      break
    case 'PRANK_DETECTED':
      Object.assign(next, {
        status: 'PRANK',
        is_prank: true,
        prank_confidence: payload.prank_confidence,
        call_classification: payload.call_classification,
      })
      break
    case 'LOCATION_RESOLVED':
      Object.assign(next, {
        landmark_name: payload.landmark_name,
        directions_narrative: payload.directions_narrative,
        map_pin: payload.map_pin,
      })
      break
    case 'BRIEF_READY':
      Object.assign(next, {
        status: 'COMPLETE',
        severity: payload.severity ?? next.severity,
        incident_type: payload.incident_type ?? next.incident_type,
        dispatcher_brief: payload.dispatcher_brief,
        recommended_response_unit: payload.recommended_response_unit,
        first_aid_audio_url: payload.first_aid_audio_url,
        first_aid_script: payload.first_aid_script,
        first_aid_script_translated: payload.first_aid_script_translated,
        landmark_name: payload.landmark_name ?? next.landmark_name,
        directions_narrative: payload.directions_narrative ?? next.directions_narrative,
        map_pin: payload.map_pin ?? next.map_pin,
        pipeline_duration_seconds: payload.pipeline_duration_seconds,
      })
      break
    case 'SNS_ALERT_SENT':
      Object.assign(next, { sns_alert: payload.message_preview ?? 'Alert sent' })
      break
    case 'ERROR':
      Object.assign(next, {
        status: 'FAILED',
        failure_stage: payload.failure_stage,
        error_message: payload.message,
      })
      break
    default:
      return calls // unknown event — don't add noise to the trace
  }

  const map = new Map(calls)
  map.set(call_id, next)
  return map
}

// Live data layer for the console: REST snapshot on load, WebSocket for live
// events, and REST polling whenever the socket is down (e.g. the Lambda
// deployment, which has no /ws route).
export function useNkwaFeed() {
  const [calls, setCalls] = useState(() => new Map())
  const [stats, setStats] = useState(null)
  const [connection, setConnection] = useState('connecting') // connecting | live | polling
  const [backendDown, setBackendDown] = useState(false)

  const wsRef = useRef(null)
  const backoffRef = useRef(1_000)
  const connectionRef = useRef('connecting')
  const closedRef = useRef(false)

  const setConn = useCallback((value) => {
    connectionRef.current = value
    setConnection(value)
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/calls/stats`)
      if (res.ok) setStats(await res.json())
    } catch { /* polling continues; banner handled by fetchCalls */ }
  }, [])

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/calls?limit=100`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { results = [] } = await res.json()
      setBackendDown(false)
      setCalls((prev) => {
        const map = new Map(prev)
        for (const r of results) {
          const rec = fromRecord(r)
          const existing = map.get(r.call_id)
          if (existing) {
            // keep the live trace; the saved record is authoritative for data
            rec.events = existing.events
            rec.live = existing.live
          }
          map.set(r.call_id, rec)
        }
        return map
      })
    } catch {
      setBackendDown(true)
    }
  }, [])

  // WebSocket with reconnect; falls back to polling while disconnected.
  useEffect(() => {
    closedRef.current = false
    let pingTimer = null
    let reconnectTimer = null

    function connect() {
      if (closedRef.current) return
      let ws
      try {
        ws = new WebSocket(WS_URL)
      } catch {
        scheduleReconnect()
        return
      }
      wsRef.current = ws

      ws.onopen = () => {
        backoffRef.current = 1_000
        setConn('live')
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }))
          }
        }, PING_MS)
      }

      ws.onmessage = (e) => {
        let msg
        try { msg = JSON.parse(e.data) } catch { return }
        if (msg.type === 'CONNECTION_ACK' || msg.type === 'PONG') return
        setCalls((prev) => applyEvent(prev, msg))
        // terminal events change today's stats — refresh them
        if (['BRIEF_READY', 'PRANK_DETECTED', 'ERROR', 'SNS_ALERT_SENT'].includes(msg.type)) {
          fetchStats()
        }
      }

      ws.onclose = () => {
        clearInterval(pingTimer)
        if (!closedRef.current) {
          setConn('polling')
          scheduleReconnect()
        }
      }
      ws.onerror = () => ws.close()
    }

    function scheduleReconnect() {
      if (closedRef.current) return
      reconnectTimer = setTimeout(connect, backoffRef.current)
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS)
    }

    connect()
    return () => {
      closedRef.current = true
      clearInterval(pingTimer)
      clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, [setConn, fetchStats])

  // initial snapshot + fallback polling + periodic stats refresh
  useEffect(() => {
    fetchCalls()
    fetchStats()
    const poll = setInterval(() => {
      if (connectionRef.current !== 'live') {
        fetchCalls()
        fetchStats()
      }
    }, POLL_MS)
    const statsTimer = setInterval(fetchStats, STATS_REFRESH_MS)
    return () => {
      clearInterval(poll)
      clearInterval(statsTimer)
    }
  }, [fetchCalls, fetchStats])

  return { calls, stats, connection, backendDown, refresh: fetchCalls }
}
