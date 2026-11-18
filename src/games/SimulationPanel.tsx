import { useEffect, useRef, useState } from 'react'
import type { SimulationLevel } from '../content/schema'
import { loadNamespace, pyCall, resolveFiles } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'
import type { Session } from '../pages/LevelPage'
import { useStore } from '../store/store'
import { LineChart } from '../components/LineChart'

const CELL_COLORS: Record<string, string> = {
  S: '#4ade80', I: '#ef4444', R: '#60a5fa', V: '#a78bfa', '.': '#1d2346', '#': '#e5e7eb', T: '#16a34a', F: '#f97316', A: '#facc15', '0': '#1d2346', '1': '#facc15',
}

/** After the rule passes its tests: sliders + live run + observation question. */
export function SimulationPanel({ level, code, session }: { level: SimulationLevel; code: string; session: Session }) {
  const tr = useTr()
  const [params, setParams] = useState<Record<string, number>>(() => Object.fromEntries(level.sim.params.map((p) => [p.name, p.default])))
  const [frames, setFrames] = useState<unknown[] | null>(null)
  const [curve, setCurve] = useState<number[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [err, setErr] = useState<import('../engine/api').PyError | null>(null)
  const [busy, setBusy] = useState(false)
  const [answer, setAnswer] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const simulate = async () => {
    setBusy(true)
    setErr(null)
    const files = await resolveFiles(level.files)
    const load = await loadNamespace(code, 'sim', { files, given_code: level.given_code })
    if (!load.ok) {
      setErr(load.error)
      setBusy(false)
      return
    }
    const assign = Object.entries(params).map(([k, v]) => `${k} = ${v}`).join('\n')
    const r = await pyCall<{ frames?: unknown[]; curve?: number[] }>("{'frames': globals().get('frames'), 'curve': globals().get('curve')}", { ns: 'sim', exec: `${assign}\n${level.sim.driver}`, timeoutMs: 10000 })
    setBusy(false)
    if (!r.ok) {
      setErr(r.error ?? null)
      return
    }
    setFrames(r.value?.frames ?? null)
    setCurve(r.value?.curve ?? null)
    setIdx(0)
  }

  useEffect(() => {
    void simulate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (timer.current) clearInterval(timer.current)
    if (!frames?.length) return
    timer.current = setInterval(() => setIdx((i) => (i + 1 < frames.length ? i + 1 : i)), 120)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [frames])

  const frame = frames?.[idx] as unknown
  const q = level.sim.question

  return (
    <div className="card space-y-3 p-4">
      <div className="font-display text-xl">🎛️ {tr('À toi de jouer avec la simulation', 'Play with the simulation')}</div>
      {level.sim.params.map((p) => (
        <label key={p.name} className="block text-sm">
          <span className="flex justify-between">
            <span>{p.label}</span>
            <span className="font-mono text-accent2">{params[p.name]}</span>
          </span>
          <input type="range" min={p.min} max={p.max} step={p.step} value={params[p.name]} onChange={(e) => setParams({ ...params, [p.name]: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
        </label>
      ))}
      <button className="btn" onClick={simulate} disabled={busy}>
        {busy ? '…' : '▶ ' + tr('Relancer la simulation', 'Run the simulation again')}
      </button>
      {err && <ErrorCard error={err} />}
      {level.sim.kind === 'grid' && Array.isArray(frame) && (
        <div>
          <div className="inline-grid gap-px rounded-lg bg-line p-px" style={{ gridTemplateColumns: `repeat(${(frame as unknown[][])[0]?.length ?? 1}, minmax(0, 1fr))` }}>
            {(frame as unknown[][]).flatMap((row, y) =>
              row.map((cell, x) => <div key={`${y}-${x}`} className="h-3 w-3 sm:h-4 sm:w-4" style={{ background: CELL_COLORS[String(cell)] ?? '#888' }} />),
            )}
          </div>
          <div className="mt-1 text-xs text-muted">
            {tr('Étape', 'Step')} {idx + 1} / {frames?.length}
          </div>
        </div>
      )}
      {curve && <LineChart series={[{ name: tr('valeur', 'value'), values: curve }]} />}
      {q && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 p-3">
          <div className="font-semibold">🔎 {q.q}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {q.choices.map((c, i) => (
              <button
                key={i}
                className={`btn justify-start text-left ${answer === i ? (i === q.answer ? 'border-ok bg-ok/20' : 'border-ko bg-ko/20') : ''}`}
                disabled={answer === q.answer}
                onClick={() => {
                  setAnswer(i)
                  if (i === q.answer) {
                    if (/vaccin/i.test(q.q)) useStore.getState().bump('herd')
                    session.complete({ code })
                  } else session.fail(['observation'])
                }}
              >
                {c}
              </button>
            ))}
          </div>
          {answer !== null && answer !== q.answer && <div className="mt-2 text-sm text-warn">{tr('Pas tout à fait : bouge les curseurs et observe encore.', 'Not quite: move the sliders and observe again.')}</div>}
        </div>
      )}
      {!q && (
        <button className="btn btn-ok" onClick={() => session.complete({ code })}>
          ✓ {tr('Terminer', 'Finish')}
        </button>
      )}
    </div>
  )
}
