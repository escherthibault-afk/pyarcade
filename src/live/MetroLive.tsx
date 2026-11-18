import { useEffect, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, type MapData, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'
import { MapView } from '../components/MapView'

/** The network map drawn by create_complete_map, plus a trip timer using travel_time. */
export default function MetroLive({ ns }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const [map, setMap] = useState<MapData | null>(null)
  const [stations, setStations] = useState<Record<string, { name: string; line: string }>>({})
  const [path, setPath] = useState<number[]>([])
  const [time, setTime] = useState<string>('')
  const [err, setErr] = useState<PyError | null>(null)

  useEffect(() => {
    void (async () => {
      const r = await pyCall<Record<string, { name: string; line: string }>>("read_stations('stations.csv')", {
        ns,
        exec: "__m = create_complete_map('stations.csv', 'connexions.csv')\n__C = read_connexions('connexions.csv')",
        media: true,
      })
      if (!r.ok) return setErr(r.error ?? null)
      setStations(r.value!)
      if (r.maps?.length) setMap(r.maps[r.maps.length - 1])
    })()
  }, [ns])

  useEffect(() => {
    if (path.length < 2) return setTime('')
    void pyCall<number | null>(`travel_time(__C, ${JSON.stringify(path)})`, { ns }).then((r) => {
      if (!r.ok) setErr(r.error ?? null)
      else setTime(r.value === null ? tr('❌ deux stations consécutives ne sont pas reliées', '❌ two consecutive stations are not connected') : `⏱ ${r.value} min`)
    })
  }, [path, ns, tr])

  return (
    <div className="space-y-3">
      {err && <ErrorCard error={err} />}
      {map ? <MapView data={map} height={420} /> : <div className="text-center text-muted">…</div>}
      <div className="card p-3">
        <div className="text-sm font-semibold">🧭 {tr('Compose un trajet (ta fonction travel_time)', 'Build a trip (your travel_time)')}</div>
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(stations).map(([id, s]) => (
            <button key={id} className="pill" onClick={() => setPath([...path, Number(id)])}>
              {s.line} · {s.name}
            </button>
          ))}
        </div>
        <div className="mt-2 text-sm">
          {path.map((id) => stations[String(id)]?.name).join(' → ') || tr('Clique sur des stations voisines…', 'Click neighbouring stations…')}
        </div>
        <div className="mt-1 font-display text-xl">{time}</div>
        <button className="btn mt-2 text-sm" onClick={() => setPath([])}>
          ↺ {tr('Effacer', 'Clear')}
        </button>
      </div>
    </div>
  )
}
