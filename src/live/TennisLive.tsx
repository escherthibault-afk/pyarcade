import { useRef, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'
import { sfx } from '../lib/sound'

/** Tennis lab powered by the student's win_point / game_over / game_score / estimate_win / plot_curve. */
export default function TennisLive({ ns }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const [la, setLa] = useState(55)
  const [lb, setLb] = useState(45)
  const [sets, setSets] = useState(3)
  const [score, setScore] = useState('0-0')
  const [points, setPoints] = useState<string[]>([])
  const [prob, setProb] = useState<number | null>(null)
  const [img, setImg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<PyError | null>(null)
  const stop = useRef(false)

  const playGame = async () => {
    setBusy(true)
    setErr(null)
    stop.current = false
    let a = 0
    let b = 0
    const log: string[] = []
    setPoints([])
    setScore('0-0')
    for (let i = 0; i < 60 && !stop.current; i++) {
      const over = await pyCall<boolean>(`game_over(${a}, ${b})`, { ns })
      if (!over.ok) return setErr(over.error ?? null), setBusy(false)
      if (over.value) break
      const p = await pyCall<boolean>(`win_point(${la}, ${lb})`, { ns })
      if (!p.ok) return setErr(p.error ?? null), setBusy(false)
      if (p.value) a++
      else b++
      log.push(p.value ? 'A' : 'B')
      const s = await pyCall<string>(`game_score(${a}, ${b})`, { ns })
      if (!s.ok) return setErr(s.error ?? null), setBusy(false)
      setScore(String(s.value))
      setPoints([...log])
      sfx.tick()
      await new Promise((r) => setTimeout(r, 350))
    }
    sfx.ok()
    setBusy(false)
  }

  const estimate = async () => {
    setBusy(true)
    const r = await pyCall<number>(`estimate_win(${la}, ${lb}, ${sets}, 400)`, { ns, timeoutMs: 30000 })
    setBusy(false)
    if (r.ok) setProb(Number(r.value))
    else setErr(r.error ?? null)
  }

  const curve = async () => {
    setBusy(true)
    const r = await pyCall('None', { ns, exec: `import matplotlib.pyplot as plt\nplt.close('all')\nplt.figure(figsize=(6, 3.5))\nplot_curve(list(range(30, 71, 5)), ${lb})`, media: true, timeoutMs: 60000 })
    setBusy(false)
    if (r.images?.[0]) setImg(r.images[0])
    else if (r.error) setErr(r.error)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ['A', la, setLa],
          ['B', lb, setLb],
        ].map(([name, v, set]) => (
          <label key={name as string} className="text-sm">
            {tr('Niveau', 'Level')} {name as string} : <b>{v as number}</b>
            <input type="range" min={1} max={100} value={v as number} onChange={(e) => (set as (n: number) => void)(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
          </label>
        ))}
        <label className="text-sm">
          {tr('Format', 'Format')}
          <select className="ml-2 rounded-lg border border-line bg-bg2 px-2 py-1" value={sets} onChange={(e) => setSets(Number(e.target.value))}>
            <option value={3}>3 sets</option>
            <option value={5}>5 sets</option>
          </select>
        </label>
      </div>
      <div className="text-center text-sm text-muted">
        {tr('Probabilité de gagner un point', 'Point win probability')} : <b className="text-fg">{((100 * la) / (la + lb)).toFixed(1)} %</b>
      </div>
      {err && <ErrorCard error={err} />}
      <div className="card p-4 text-center">
        <div className="text-xs uppercase tracking-wider text-muted">🎾 {tr('Un jeu, point par point (ton game_score)', 'One game, point by point (your game_score)')}</div>
        <div className="my-2 font-display text-4xl">{score}</div>
        <div className="flex flex-wrap justify-center gap-1">
          {points.map((p, i) => (
            <span key={i} className={`rounded px-1.5 text-xs font-bold ${p === 'A' ? 'bg-accent2/30' : 'bg-ko/30'}`}>
              {p}
            </span>
          ))}
        </div>
        <button className="btn btn-primary mt-3" onClick={playGame} disabled={busy}>
          ▶ {tr('Jouer un jeu', 'Play one game')}
        </button>
      </div>
      <div className="card p-4 text-center">
        <div className="text-xs uppercase tracking-wider text-muted">🎲 Monte Carlo ({tr('ton estimate_win, 400 matchs', 'your estimate_win, 400 matches')})</div>
        {prob !== null && (
          <div className="my-2 font-display text-4xl">
            {(prob * 100).toFixed(1)} %<span className="block text-sm text-muted">{tr('de chances pour A de gagner le match', 'chance for A to win the match')}</span>
          </div>
        )}
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button className="btn" onClick={estimate} disabled={busy}>
            🎲 {tr('Estimer', 'Estimate')}
          </button>
          <button className="btn" onClick={curve} disabled={busy}>
            📈 {tr('Courbe (ton plot_curve)', 'Curve (your plot_curve)')}
          </button>
        </div>
        {busy && <div className="mt-2 animate-pulse text-sm text-muted">{tr('simulation…', 'simulating…')}</div>}
        {img && <img className="mx-auto mt-3 rounded-lg bg-white" src={`data:image/png;base64,${img}`} alt="courbe" />}
      </div>
    </div>
  )
}
