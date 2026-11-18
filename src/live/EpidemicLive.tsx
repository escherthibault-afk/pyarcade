import { useEffect, useRef, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'
import { LineChart } from '../components/LineChart'
import { useStore } from '../store/store'

const N = 40
const COLORS: Record<string, string> = { S: '#3ddc84', I: '#ff5d73', R: '#5dade2', V: '#a78bfa' }

/** SIR epidemic driven by the student's create_vaccinated_grid / infect / step / count_state. */
export default function EpidemicLive({ ns }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const ref = useRef<HTMLCanvasElement>(null)
  const [p, setP] = useState(0.3)
  const [duration, setDuration] = useState(4)
  const [rate, setRate] = useState(0.2)
  const [history, setHistory] = useState<[number, number, number][]>([])
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState<PyError | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const draw = (rows: string[]) => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const s = 10
    rows.forEach((row, y) =>
      row.split('').forEach((c, x) => {
        ctx.fillStyle = COLORS[c] ?? '#222'
        ctx.fillRect(x * s, y * s, s - 1, s - 1)
      }),
    )
  }

  const state = "{'rows': [''.join(c['state'] for c in row) for row in __G], 'sir': (count_state(__G, 'S'), count_state(__G, 'I'), count_state(__G, 'R'))}"

  const start = async () => {
    setErr(null)
    setDone(null)
    const r = await pyCall<{ rows: string[]; sir: [number, number, number] }>(state, { ns, exec: `__G = create_vaccinated_grid(${N}, ${N}, ${rate})\ninfect(__G, ${N / 2}, ${N / 2})` })
    if (!r.ok) return setErr(r.error ?? null)
    draw(r.value!.rows)
    setHistory([r.value!.sir])
    setRunning(true)
  }

  useEffect(() => {
    if (!running) return
    let alive = true
    const loop = async () => {
      while (alive) {
        const r = await pyCall<{ rows: string[]; sir: [number, number, number] }>(state, { ns, exec: `__G = step(__G, ${p}, ${duration})`, timeoutMs: 5000 })
        if (!alive) break
        if (!r.ok) {
          setErr(r.error ?? null)
          setRunning(false)
          break
        }
        draw(r.value!.rows)
        setHistory((h) => [...h, r.value!.sir])
        if (r.value!.sir[1] === 0) {
          setRunning(false)
          const [, , R] = r.value!.sir
          const v = Math.round(rate * N * N)
          const reach = R / Math.max(1, N * N - v)
          setDone(tr(`Fin de l'épidémie : ${Math.round(reach * 100)} % des non-vaccinés ont été malades.`, `Epidemic over: ${Math.round(reach * 100)} % of the unvaccinated got sick.`))
          if (rate >= 0.4 && reach < 0.1) useStore.getState().bump('herd')
          break
        }
        await new Promise((res) => setTimeout(res, 80))
      }
    }
    void loop()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {err && <ErrorCard error={err} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs">
          {tr('transmission p', 'transmission p')} <b className="text-accent2">{p}</b>
          <input type="range" min={0.05} max={1} step={0.05} value={p} onChange={(e) => setP(Number(e.target.value))} className="w-full" />
        </label>
        <label className="text-xs">
          {tr('durée de la maladie', 'disease duration')} <b className="text-accent2">{duration}</b>
          <input type="range" min={1} max={10} step={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full" />
        </label>
        <label className="text-xs">
          {tr('part de vaccinés', 'vaccinated share')} <b className="text-accent2">{Math.round(rate * 100)} %</b>
          <input type="range" min={0} max={0.9} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-full" />
        </label>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">
        <canvas ref={ref} width={N * 10} height={N * 10} className="w-full rounded-xl border border-line bg-[#0d1021]" aria-label="grille de l'épidémie" />
        <div className="space-y-2">
          <LineChart
            series={[
              { name: 'S', values: history.map((h) => h[0]) },
              { name: 'I', values: history.map((h) => h[1]) },
              { name: 'R', values: history.map((h) => h[2]) },
            ]}
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(COLORS).map(([k, c]) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded" style={{ background: c }} />
                {k}
              </span>
            ))}
          </div>
          <button className="btn btn-primary" onClick={start} disabled={running}>
            ▶ {tr('Lancer l’épidémie', 'Start the epidemic')}
          </button>
          {done && <div className="text-sm">{done}</div>}
          <p className="text-xs text-muted">
            {tr('Cherche le seuil d’immunité collective : la plus petite part de vaccinés pour laquelle l’épidémie ne décolle pas.', 'Find the herd immunity threshold: the smallest vaccinated share that stops the outbreak.')}
          </p>
        </div>
      </div>
    </div>
  )
}
