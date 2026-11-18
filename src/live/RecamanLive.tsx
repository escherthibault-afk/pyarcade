import { useEffect, useRef, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'

/** Classic Recamán arcs drawn from the student's recaman_fast, plus a list-vs-set race. */
export default function RecamanLive({ ns }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const ref = useRef<HTMLCanvasElement>(null)
  const [n, setN] = useState(60)
  const [terms, setTerms] = useState<number[]>([])
  const [race, setRace] = useState<{ slow: number; fast: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<PyError | null>(null)

  useEffect(() => {
    void pyCall<number[]>(`recaman_fast(${n})`, { ns }).then((r) => (r.ok ? setTerms(r.value!) : setErr(r.error ?? null)))
  }, [n, ns])

  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || terms.length < 2) return
    const W = c.width
    const H = c.height
    ctx.clearRect(0, 0, W, H)
    const maxV = Math.max(...terms)
    const s = (W - 20) / maxV
    const mid = H / 2
    ctx.lineWidth = 1.2
    for (let i = 1; i < terms.length; i++) {
      const a = terms[i - 1]
      const b = terms[i]
      const cx = 10 + ((a + b) / 2) * s
      const r = (Math.abs(b - a) / 2) * s
      ctx.strokeStyle = `hsl(${(i * 360) / terms.length}, 80%, 65%)`
      ctx.beginPath()
      // alternate above / below the axis
      if (i % 2) ctx.arc(cx, mid, r, Math.PI, 0)
      else ctx.arc(cx, mid, r, 0, Math.PI)
      ctx.stroke()
    }
  }, [terms])

  const runRace = async () => {
    setBusy(true)
    setRace(null)
    const r = await pyCall<{ slow: number; fast: number }>(
      "{'slow': __t1, 'fast': __t2}",
      { ns, exec: 'import time\n__a = time.perf_counter()\nrecaman(4000)\n__t1 = time.perf_counter() - __a\n__a = time.perf_counter()\nrecaman_fast(4000)\n__t2 = time.perf_counter() - __a', timeoutMs: 60000 },
    )
    setBusy(false)
    if (r.ok) setRace(r.value!)
    else setErr(r.error ?? null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {err && <ErrorCard error={err} />}
      <label className="block text-sm">
        {tr('Nombre de termes', 'Number of terms')} : <b>{n}</b>
        <input type="range" min={5} max={250} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
      </label>
      <canvas ref={ref} width={760} height={420} className="w-full rounded-xl border border-line bg-[#0d1021]" aria-label="arcs de Recamán" />
      <p className="text-center text-xs text-muted">{tr('Chaque saut a(n-1) → a(n) est un demi-cercle, alternativement au-dessus et en dessous. Tracé avec ta fonction recaman_fast.', 'Each jump is a half circle, alternately above and below. Drawn with your recaman_fast.')}</p>
      <div className="card p-4 text-center">
        <div className="font-display text-lg">🏁 {tr('Course : liste contre set (4 000 termes)', 'Race: list vs set (4,000 terms)')}</div>
        <button className="btn btn-primary mt-2" onClick={runRace} disabled={busy}>
          {busy ? '…' : '▶ ' + tr('Lancer la course', 'Start the race')}
        </button>
        {race && (
          <div className="mt-3 space-y-2 text-left text-sm">
            {[
              ['recaman (liste)', race.slow, 'bg-ko'],
              ['recaman_fast (set)', race.fast, 'bg-ok'],
            ].map(([label, t, color]) => (
              <div key={label as string}>
                <div className="flex justify-between">
                  <span className="font-mono">{label as string}</span>
                  <span>{((t as number) * 1000).toFixed(1)} ms</span>
                </div>
                <div className="h-3 rounded-full bg-panel2">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(1, (100 * (t as number)) / Math.max(race.slow, race.fast))}%` }} />
                </div>
              </div>
            ))}
            <div className="text-center font-semibold">
              {tr('Le set est', 'The set is')} ×{Math.max(1, Math.round(race.slow / Math.max(race.fast, 1e-6)))} {tr('plus rapide', 'faster')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
