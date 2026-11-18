import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { MapData } from '../engine/api'

/** Renders a folium_lite map with Leaflet. */
export function MapView({ data, height = 360 }: { data: MapData; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const map = L.map(ref.current, { center: data.center, zoom: data.zoom, scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    const bounds: [number, number][] = []
    for (const it of data.items) {
      if (it.kind === 'circle' && it.loc) {
        const m = L.circleMarker(it.loc, { radius: it.radius ?? 6, color: it.color, fill: it.fill ?? true, fillColor: it.fillColor ?? it.color, fillOpacity: it.fillOpacity ?? 0.8 }).addTo(map)
        if (it.popup) m.bindPopup(it.popup)
        if (it.tooltip) m.bindTooltip(it.tooltip)
        bounds.push(it.loc)
      } else if (it.kind === 'marker' && it.loc) {
        const m = L.circleMarker(it.loc, { radius: 8, color: '#8b7cff', fillOpacity: 0.9 }).addTo(map)
        if (it.popup) m.bindPopup(it.popup)
        if (it.tooltip) m.bindTooltip(it.tooltip)
        bounds.push(it.loc)
      } else if (it.kind === 'line' && it.locs) {
        const l = L.polyline(it.locs, { color: it.color, weight: it.weight ?? 3, opacity: it.opacity ?? 1 }).addTo(map)
        if (it.tooltip) l.bindTooltip(it.tooltip)
        bounds.push(...it.locs)
      }
    }
    if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] })
    return () => {
      map.remove()
    }
  }, [data])
  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-xl border border-line" />
}
