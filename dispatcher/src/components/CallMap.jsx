import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { severityOf } from '../lib/meta.js'

const ACCRA = [5.6037, -0.187]

export default function CallMap({ call }) {
  const divRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    const map = L.map(divRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView(ACCRA, 12)

    // CARTO dark basemap — free tier with attribution, matches the console
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  const lat = call?.map_pin?.lat ?? call?.gps_lat
  const lon = call?.map_pin?.lon ?? call?.gps_lon
  const hasPin = lat != null && lon != null && !(lat === 0 && lon === 0)
  const sevHex = severityOf(call).hex

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
    if (!hasPin) {
      map.setView(ACCRA, 12)
      return
    }

    const icon = L.divIcon({
      className: '',
      html: `<div class="nkwa-pin" style="--pin:${sevHex}"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    })
    markerRef.current = L.marker([lat, lon], { icon }).addTo(map)
    if (call?.map_pin?.label || call?.landmark_name) {
      markerRef.current.bindTooltip(call.landmark_name ?? call.map_pin.label, {
        direction: 'top',
        offset: [0, -12],
      })
    }
    map.flyTo([lat, lon], 15, { duration: 0.8 })
  }, [call?.call_id, lat, lon, hasPin, sevHex]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative rounded-xl overflow-hidden border border-edge">
      <div ref={divRef} className="h-64 w-full" aria-label="Caller location map" />
      {!hasPin && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-bg/60 pointer-events-none">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-mid">
            No GPS fix
          </p>
        </div>
      )}
    </div>
  )
}
