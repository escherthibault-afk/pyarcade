import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ALL_LEVELS, WORLDS } from '../content'
import type { CodeLevel, PredictLevel } from '../content/schema'
import { resolveFiles, runLevelTests, type TestReport } from '../engine/api'
import { useProfile, useSettings, useStore } from '../store/store'
import { useTr } from '../i18n'
import { CodeEditor, type EditorThemeName } from '../components/CodeEditor'
import { CodeBlock, Markdown } from '../components/Markdown'
import { TestPanel } from '../components/TestPanel'
import { examplesBlock } from '../games/CodeGame'
import { awardBadges } from '../lib/badges'

type Exo = CodeLevel | PredictLevel
const CODE_TYPES = new Set(['code_fill', 'bug_hunt', 'copy', 'refactor'])

function pick(worlds: string[], n: number): Exo[] {
  const pool = ALL_LEVELS.filter(
    (l): l is Exo => worlds.includes(String(l.world)) && (CODE_TYPES.has(l.type) || l.type === 'predict_output') && l.difficulty >= 2,
  )
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  // at most one "predict the output" for every three exercises
  const out: Exo[] = []
  let predicts = 0
  for (const l of shuffled) {
    if (out.length >= n) break
    if (l.type === 'predict_output') {
      if (predicts >= Math.ceil(n / 3)) continue
      predicts++
    }
    out.push(l)
  }
  return out
}

const norm = (s: string) => s.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').replace(/\n+$/, '')

/** Mock written exam: 5-8 exercises on the chosen topics, timed, with a detailed correction. */
export default function RevisionPage() {
  const tr = useTr()
  const p = useProfile()
  const settings = useSettings()
  const [worlds, setWorlds] = useState<string[]>(['wordle'])
  const [n, setN] = useState(6)
  const [minutes, setMinutes] = useState(45)
  const [exos, setExos] = useState<Exo[] | null>(null)
  const [answers, setAnswers] = useState<string[]>([])
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [reports, setReports] = useState<(TestReport | boolean | null)[] | null>(null)
  const [grading, setGrading] = useState(false)

  useEffect(() => {
    if (!exos || reports) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [exos, reports])

  const remaining = exos ? Math.max(0, startedAt + minutes * 60_000 - now) : 0
  const available = useMemo(() => WORLDS.filter((w) => !w.secret), [])

  const start = () => {
    const chosen = pick(worlds, n)
    setExos(chosen)
    setAnswers(chosen.map((e) => (e.type === 'predict_output' ? '' : e.starter_code)))
    setReports(null)
    setStartedAt(Date.now())
  }

  const handIn = async () => {
    if (!exos) return
    setGrading(true)
    const out: (TestReport | boolean | null)[] = []
    for (const [i, e] of exos.entries()) {
      if (e.type === 'predict_output') out.push(norm(answers[i]) === norm(e.answer))
      else {
        const tests = [...e.tests.visible, ...e.tests.hidden.map((t) => ({ ...t, hidden: true }))]
        out.push(
          await runLevelTests({ code: answers[i], tests, statistical: e.tests.statistical, seed: e.tests.random_seed, files: await resolveFiles(e.files), given_code: e.given_code, constraints: [e.constraints], packages: e.packages }),
        )
      }
      setReports([...out, ...exos.slice(out.length).map(() => null)])
    }
    setGrading(false)
    useStore.getState().bump('mock_done')
    awardBadges()
  }

  const scoreOf = (r: TestReport | boolean | null) => {
    if (r === null) return 0
    if (typeof r === 'boolean') return r ? 1 : 0
    if (r.loadError) return 0
    const total = r.results.length || 1
    return (r.results.filter((x) => x.passed).length / total) * (r.violations.length ? 0.8 : 1)
  }
  const note = reports ? (reports.reduce((a: number, r) => a + scoreOf(r), 0) / (exos?.length || 1)) * 20 : 0

  if (!exos)
    return (
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-6">
        <h1 className="font-display text-3xl">🧾 {tr('Mode révision DS : sujet blanc', 'Mock exam')}</h1>
        <p className="mt-1 text-sm text-muted">
          {tr('Un sujet de 5 à 8 exercices tirés des notions de ton choix, chronométré, sans indice, puis un corrigé détaillé.', '5 to 8 exercises on the topics you choose, timed, no hints, then a detailed correction.')}
        </p>
        <div className="card mt-4 space-y-4 p-4">
          <div>
            <div className="mb-2 text-sm font-semibold">{tr('Notions', 'Topics')}</div>
            <div className="flex flex-wrap gap-2">
              {available.map((w) => {
                const id = String(w.id)
                const on = worlds.includes(id)
                return (
                  <button key={id} className={`pill ${on ? 'border-accent bg-accent/15 text-accent' : ''}`} onClick={() => setWorlds(on ? worlds.filter((x) => x !== id) : [...worlds, id])}>
                    {w.emoji} {w.title}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="block text-sm">
            {tr('Nombre d’exercices', 'Exercises')} : <b>{n}</b>
            <input type="range" min={5} max={8} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full" />
          </label>
          <label className="block text-sm">
            {tr('Durée', 'Duration')} :{' '}
            <select className="rounded-lg border border-line bg-bg2 px-2 py-1" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={start} disabled={!worlds.length}>
            ⏱ {tr('Générer le sujet et commencer', 'Generate and start')}
          </button>
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-6">
      <div className="sticky top-14 z-30 mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-bg/90 p-2 backdrop-blur">
        <h1 className="font-display text-xl">🧾 {tr('Sujet blanc', 'Mock exam')}</h1>
        {!reports && <span className={`pill font-mono ${remaining < 5 * 60_000 ? 'border-ko text-ko' : ''}`}>⏱ {Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}</span>}
        {reports && <span className="pill border-gold text-lg text-gold">{note.toFixed(1)} / 20</span>}
        <div className="ml-auto flex gap-2">
          {!reports && (
            <button className="btn btn-ok" onClick={handIn} disabled={grading}>
              📤 {grading ? tr('Correction…', 'Grading…') : tr('Rendre la copie', 'Hand in')}
            </button>
          )}
          {reports && (
            <button className="btn" onClick={() => setExos(null)}>
              ↺ {tr('Nouveau sujet', 'New mock exam')}
            </button>
          )}
        </div>
      </div>
      {exos.map((e: Exo, i) => {
        const r = reports?.[i]
        return (
          <section key={e.id} className="card mb-4 space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg">
                {tr('Exercice', 'Exercise')} {i + 1} — {e.title}
              </h2>
              <span className="pill">{(20 / exos.length).toFixed(1)} pts{r !== undefined && r !== null ? ` · ${(scoreOf(r) * (20 / exos.length)).toFixed(1)}` : ''}</span>
            </div>
            <Markdown src={e.statement_md} />
            {e.type === 'predict_output' ? (
              <>
                <CodeBlock code={e.code} />
                <textarea
                  className="h-24 w-full rounded-xl border border-line bg-bg2 p-2 font-mono text-sm"
                  value={answers[i]}
                  disabled={!!reports}
                  onChange={(ev) => setAnswers(answers.map((a, j) => (j === i ? ev.target.value : a)))}
                  placeholder={tr('Sortie du programme…', 'Program output…')}
                />
                {reports && (
                  <div className={`text-sm ${r ? 'text-ok' : 'text-ko'}`}>
                    {r ? '✓' : '✗'} {tr('Sortie attendue', 'Expected output')} :<pre className="mt-1 rounded-lg bg-bg2 p-2 font-mono text-xs">{e.answer}</pre>
                  </div>
                )}
              </>
            ) : (
              <>
                {e.tests.visible.length > 0 && <CodeBlock code={examplesBlock(e.tests.visible, tr)} />}
                <div className="h-[240px]">
                  <CodeEditor value={answers[i]} onChange={(c) => setAnswers((a) => a.map((x, j) => (j === i ? c : x)))} readOnly={!!reports} theme={p.equipped.editorTheme as EditorThemeName} fontSize={settings.fontSize} />
                </div>
                {r && typeof r !== 'boolean' && <TestPanel report={r} running={false} total={r.results.length} partial={[]} />}
              </>
            )}
            {reports && (
              <details className="rounded-xl border border-accent2/40 bg-accent2/5 p-3" open={scoreOf(r ?? null) < 1}>
                <summary className="cursor-pointer text-sm font-semibold">📗 {tr('Corrigé détaillé', 'Detailed correction')}</summary>
                {e.type !== 'predict_output' && <CodeBlock code={e.solution} className="mt-2" />}
                {e.explanation_md && <Markdown src={e.explanation_md} className="mt-2 text-sm" />}
                {e.exam_tip && <Markdown src={`🎓 ${e.exam_tip}`} className="mt-2 text-sm" />}
                <Link to={`/level/${e.id}`} className="mt-2 inline-block text-sm text-accent2 underline">
                  {tr('Refaire ce niveau', 'Replay this level')}
                </Link>
              </details>
            )}
          </section>
        )
      })}
    </div>
  )
}
