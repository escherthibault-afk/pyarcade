import { useEffect, useMemo, useState } from 'react'
import type { ParsonsLevel, TraceLevel, TruthTableLevel, RobotLevel, WriteTestLevel } from '../content/schema'
import { useTr } from '../i18n'
import { useProfile, useSettings } from '../store/store'
import { CodeBlock } from '../components/Markdown'
import { CodeEditor, type EditorThemeName } from '../components/CodeEditor'
import { ErrorCard } from '../components/ErrorCard'
import { TestPanel } from '../components/TestPanel'
import { checkCode, evalTruth, resolveFiles, runLevelTests, runRobot, runWriteTest, traceCode, type PyError, type RobotRun, type TestReport, type TestResult } from '../engine/api'
import { explainViolation } from '../engine/explain'
import { allBoolRows } from '../lib/truth'
import { sfx } from '../lib/sound'
import type { Session } from '../pages/LevelPage'
import { errorTypesOf } from './CodeGame'

/* ------------------------------------------------------------------ Parsons */

type Piece = { id: number; text: string; indent: number }

export function ParsonsGame({ session }: { session: Session }) {
  const level = session.level as ParsonsLevel
  const tr = useTr()
  const initial = useMemo(() => {
    const all = [...level.lines, ...level.distractors].map((t, id) => ({ id, text: t.trim(), indent: 0 }))
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[all[i], all[j]] = [all[j], all[i]]
    }
    return all
  }, [level])
  const [pool, setPool] = useState<Piece[]>(initial)
  const [sol, setSol] = useState<Piece[]>([])
  const [sel, setSel] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ from: 'pool' | 'sol'; id: number } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [report, setReport] = useState<TestReport | null>(null)
  const [running, setRunning] = useState(false)
  const [partial, setPartial] = useState<TestResult[]>([])

  const toSol = (p: Piece, at?: number) => {
    setPool((x) => x.filter((q) => q.id !== p.id))
    setSol((x) => {
      const y = x.filter((q) => q.id !== p.id)
      y.splice(at ?? y.length, 0, p)
      return y
    })
    setSel(p.id)
  }
  const toPool = (p: Piece) => {
    setSol((x) => x.filter((q) => q.id !== p.id))
    setPool((x) => [...x, { ...p, indent: 0 }])
    setSel(null)
  }
  const move = (id: number, d: number) =>
    setSol((x) => {
      const i = x.findIndex((q) => q.id === id)
      const j = i + d
      if (i < 0 || j < 0 || j >= x.length) return x
      const y = [...x]
      ;[y[i], y[j]] = [y[j], y[i]]
      return y
    })
  const indent = (id: number, d: number) => setSol((x) => x.map((q) => (q.id === id ? { ...q, indent: Math.max(0, Math.min(4, q.indent + d)) } : q)))

  const code = sol.map((p) => '    '.repeat(p.indent) + p.text).join('\n') + '\n'

  const check = async () => {
    setMsg(null)
    if (level.tests && level.tests.visible.length + level.tests.hidden.length > 0) {
      setRunning(true)
      const tests = [...level.tests.visible, ...level.tests.hidden.map((t) => ({ ...t, hidden: true }))]
      const rep = await runLevelTests({ code, tests, seed: level.tests.random_seed, files: await resolveFiles(level.files), onResult: (r, i) => setPartial((p) => { const c = [...p]; c[i] = r; return c }) })
      setRunning(false)
      setReport(rep)
      if (rep.allPassed && !sol.some((p) => level.distractors.map((d) => d.trim()).includes(p.text) && !level.lines.map((l) => l.trim()).includes(p.text))) session.complete({ code })
      else {
        session.fail(errorTypesOf(rep))
        setMsg(tr('Pas encore : regarde les tests.', 'Not yet: look at the tests.'))
      }
      return
    }
    const expected = level.lines.map((l) => l.replace(/\s+$/, ''))
    const got = sol.map((p) => '    '.repeat(p.indent) + p.text)
    if (got.length === expected.length && got.every((l, i) => l === expected[i])) session.complete({ code })
    else {
      session.fail(['parsons'])
      const firstWrong = got.findIndex((l, i) => l !== expected[i])
      setMsg(
        got.length !== expected.length
          ? tr(`Il faut ${expected.length} lignes (tu en as ${got.length}).`, `You need ${expected.length} lines (you have ${got.length}).`)
          : tr(`La ligne ${firstWrong + 1} n’est pas à sa place (ordre ou indentation).`, `Line ${firstWrong + 1} is misplaced (order or indentation).`),
      )
    }
  }

  const Line = ({ p, where }: { p: Piece; where: 'pool' | 'sol' }) => (
    <div
      draggable
      onDragStart={() => setDrag({ from: where, id: p.id })}
      onDragEnd={() => setDrag(null)}
      onClick={() => (where === 'pool' ? toSol(p) : setSel(sel === p.id ? null : p.id))}
      onKeyDown={(e) => {
        if (where !== 'sol') return
        if (e.key === 'ArrowRight') indent(p.id, 1)
        else if (e.key === 'ArrowLeft') indent(p.id, -1)
        else if (e.key === 'ArrowUp') move(p.id, -1)
        else if (e.key === 'ArrowDown') move(p.id, 1)
        else if (e.key === 'Delete' || e.key === 'Backspace') toPool(p)
        else return
        e.preventDefault()
      }}
      tabIndex={0}
      className={`cursor-grab select-none rounded-lg border bg-panel2 px-2 py-1.5 font-mono text-[0.85rem] whitespace-pre ${sel === p.id && where === 'sol' ? 'border-accent2 ring-1 ring-accent2' : 'border-line'}`}
      style={{ marginLeft: where === 'sol' ? p.indent * 24 : 0 }}
    >
      {p.text}
    </div>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="card p-4">{session.statement}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-3" onDragOver={(e) => e.preventDefault()} onDrop={() => drag?.from === 'sol' && toPool(sol.find((p) => p.id === drag.id)!)}>
          <div className="mb-2 text-xs uppercase tracking-wider text-muted">🧱 {tr('Lignes mélangées (clique ou glisse)', 'Shuffled lines (click or drag)')}</div>
          <div className="space-y-1.5">
            {pool.map((p) => (
              <Line key={p.id} p={p} where="pool" />
            ))}
            {!pool.length && <div className="text-sm text-muted">{tr('Toutes les lignes sont placées.', 'All lines are placed.')}</div>}
          </div>
          {level.distractors.length > 0 && <div className="mt-2 text-xs text-warn">⚠️ {tr('Attention : certaines lignes sont des leurres et ne servent pas.', 'Careful: some lines are decoys.')}</div>}
        </div>
        <div
          className="card min-h-[200px] p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            if (!drag) return
            const items = [...(e.currentTarget.querySelectorAll('[data-slot]') as NodeListOf<HTMLElement>)]
            let at = items.findIndex((el) => e.clientY < el.getBoundingClientRect().top + el.offsetHeight / 2)
            if (at < 0) at = sol.length
            const p = drag.from === 'pool' ? pool.find((q) => q.id === drag.id) : sol.find((q) => q.id === drag.id)
            if (p) toSol(p, drag.from === 'sol' && sol.findIndex((q) => q.id === p.id) < at ? at - 1 : at)
          }}
        >
          <div className="mb-2 text-xs uppercase tracking-wider text-muted">📝 {tr('Ton programme (← → pour indenter)', 'Your program (← → to indent)')}</div>
          <div className="space-y-1.5">
            {sol.map((p) => (
              <div key={p.id} data-slot className="flex items-center gap-1">
                <div className="flex-1">
                  <Line p={p} where="sol" />
                </div>
                {sel === p.id && (
                  <div className="flex gap-0.5">
                    {[
                      ['←', () => indent(p.id, -1), tr('désindenter', 'dedent')],
                      ['→', () => indent(p.id, 1), tr('indenter', 'indent')],
                      ['↑', () => move(p.id, -1), tr('monter', 'up')],
                      ['↓', () => move(p.id, 1), tr('descendre', 'down')],
                      ['✕', () => toPool(p), tr('retirer', 'remove')],
                    ].map(([label, fn, aria]) => (
                      <button key={label as string} className="kbd px-1.5 py-1" onClick={fn as () => void} aria-label={aria as string}>
                        {label as string}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!sol.length && <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">{tr('Dépose les lignes ici, dans l’ordre.', 'Drop the lines here, in order.')}</div>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={check} disabled={!sol.length || running}>
          ✓ {tr('Vérifier', 'Check')}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => {
            setPool(initial)
            setSol([])
            setMsg(null)
            setReport(null)
          }}
        >
          ↺ {tr('Tout remettre', 'Reset')}
        </button>
      </div>
      {msg && <div className="shake rounded-xl border border-ko/50 bg-ko/10 p-2 text-sm">✗ {msg}</div>}
      {level.tests && (report || running) && <TestPanel report={report} running={running} total={level.tests.visible.length + level.tests.hidden.length} partial={partial} />}
      <div className="card p-4">{session.hintPanel}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ Trace */

const normVal = (s: string) => s.replace(/\s+/g, '').replace(/"/g, "'")

export function TraceGame({ session }: { session: Session }) {
  const level = session.level as TraceLevel
  const tr = useTr()
  const display = useMemo(() => level.code.split('\n').map((l) => (l.includes('# @snap') ? l.split('# @snap')[0].trimEnd() : l)).join('\n'), [level.code])
  const [rows, setRows] = useState<Record<string, string>[] | null>(null)
  const [err, setErr] = useState<PyError | null>(null)
  const [cells, setCells] = useState<Record<string, string>[]>([])
  const [checked, setChecked] = useState<boolean[][] | null>(null)
  const [step, setStep] = useState<number | null>(null)

  useEffect(() => {
    void traceCode(level.code, level.watch, level.max_rows).then((r) => {
      if (r.error) setErr(r.error)
      setRows(r.rows)
      setCells(r.rows.map(() => Object.fromEntries(level.watch.map((w) => [w, '']))))
    })
  }, [level])

  useEffect(() => {
    if (step === null || !rows) return
    if (step >= rows.length) return
    const t = setTimeout(() => setStep(step + 1), 700)
    return () => clearTimeout(t)
  }, [step, rows])

  const validate = () => {
    if (!rows) return
    const res = rows.map((row, i) => level.watch.map((w) => normVal(cells[i][w] ?? '') === normVal(row[w])))
    setChecked(res)
    if (res.every((r) => r.every(Boolean))) {
      sfx.ok()
      setStep(0)
      setTimeout(() => session.complete(), 700 * rows.length + 400)
    } else session.fail(['trace'])
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="card space-y-3 p-4">
        {session.statement}
        <CodeBlock code={display} />
        <p className="text-sm text-muted">
          {tr(
            'Remplis une ligne du tableau chaque fois que la ligne marquée 👀 vient de s’exécuter. Écris les valeurs comme Python les afficherait avec repr (texte entre guillemets, listes entre crochets).',
            'Fill one row each time the 👀 line has just run. Write values like Python’s repr (quotes for text, brackets for lists).',
          )}
        </p>
        <p className="text-sm">
          👀 <code className="kbd">{level.code.split('\n').find((l) => l.includes('# @snap'))?.split('# @snap')[0].trim()}</code>
        </p>
      </div>
      {err && <ErrorCard error={err} />}
      {rows && (
        <div className="card overflow-x-auto p-3">
          <table className="w-full border-collapse font-mono text-sm">
            <thead>
              <tr>
                <th className="border border-line px-2 py-1 text-left text-muted">#</th>
                {level.watch.map((w) => (
                  <th key={w} className="border border-line bg-panel2 px-2 py-1 text-left">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={step !== null && i < step ? 'bg-ok/10' : ''}>
                  <td className="border border-line px-2 py-1 text-muted">{i + 1}</td>
                  {level.watch.map((w, k) => (
                    <td key={w} className={`border border-line p-0 ${checked && !checked[i][k] ? 'bg-ko/20' : ''}`}>
                      {step !== null ? (
                        <div className="px-2 py-1">{i < step ? row[w] : ''}</div>
                      ) : (
                        <input
                          className="w-full bg-transparent px-2 py-1 outline-none focus:bg-accent/10"
                          value={cells[i]?.[w] ?? ''}
                          onChange={(e) => setCells(cells.map((c, j) => (j === i ? { ...c, [w]: e.target.value } : c)))}
                          aria-label={`${w} ligne ${i + 1}`}
                          spellCheck={false}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {step === null && (
            <button className="btn btn-primary mt-3" onClick={validate}>
              ✓ {tr('Vérifier le tableau', 'Check the table')}
            </button>
          )}
          {checked && step === null && <div className="mt-2 text-sm text-ko">{tr('Les cases rouges sont fausses.', 'Red cells are wrong.')}</div>}
          {step !== null && <div className="mt-2 text-sm text-ok">▶ {tr('Rejeu pas à pas…', 'Step-by-step replay…')}</div>}
        </div>
      )}
      <div className="card p-4">{session.hintPanel}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ Truth table */

const fmt = (v: unknown) => (v === true ? 'True' : v === false ? 'False' : typeof v === 'string' ? `"${v}"` : String(v))

export function TruthGame({ session }: { session: Session }) {
  const level = session.level as TruthTableLevel
  const tr = useTr()
  const rows = useMemo(() => level.rows ?? allBoolRows(level.vars), [level])
  const [expected, setExpected] = useState<unknown[] | null>(null)
  const [expr, setExpr] = useState('')
  const [got, setGot] = useState<unknown[] | null>(null)
  const [err, setErr] = useState<PyError | null>(null)

  useEffect(() => {
    void evalTruth(level.solution, rows).then((r) => setExpected(r.ok ? (r.values ?? null) : null))
  }, [level.solution, rows])

  const test = async () => {
    setErr(null)
    const r = await evalTruth(expr, rows)
    if (!r.ok) {
      setErr(r.error ?? null)
      setGot(null)
      session.fail([r.error?.type ?? 'error'])
      return
    }
    setGot(r.values ?? null)
    const ok = expected && r.values && r.values.every((v, i) => v === expected[i])
    if (ok) {
      const simple = level.simple_len ? expr.replace(/\s+/g, '').length <= level.simple_len : undefined
      session.complete({ code: expr, bonus3: simple ?? session.mistakes === 0, extra: simple === false ? tr(`⭐ bonus : peux-tu l’écrire en ${level.simple_len} caractères ou moins ? (De Morgan…)`, `⭐ bonus: can you write it in ${level.simple_len} characters or fewer?`) : undefined })
    } else session.fail(['truth'])
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card p-4">{session.statement}</div>
      <div className="card overflow-x-auto p-3">
        <table className="w-full border-collapse font-mono text-sm">
          <thead>
            <tr>
              {level.vars.map((v) => (
                <th key={v} className="border border-line bg-panel2 px-2 py-1">
                  {v}
                </th>
              ))}
              <th className="border border-line bg-accent/20 px-2 py-1">{tr('attendu', 'expected')}</th>
              {got && <th className="border border-line px-2 py-1">{tr('ta condition', 'yours')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {level.vars.map((v) => (
                  <td key={v} className="border border-line px-2 py-1 text-center">
                    {fmt(row[v])}
                  </td>
                ))}
                <td className="border border-line px-2 py-1 text-center font-bold">{expected ? fmt(expected[i]) : '…'}</td>
                {got && <td className={`border border-line px-2 py-1 text-center ${expected && got[i] === expected[i] ? 'text-ok' : 'bg-ko/20 text-ko'}`}>{fmt(got[i])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card space-y-2 p-3">
        <label className="text-sm font-semibold" htmlFor="truth-expr">
          {tr('Ta condition (une expression Python qui utilise', 'Your condition (a Python expression using')} {level.vars.join(', ')})
        </label>
        <div className="flex gap-2">
          <input
            id="truth-expr"
            className="flex-1 rounded-lg border border-line bg-bg2 px-3 py-2 font-mono"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && test()}
            spellCheck={false}
            autoComplete="off"
            placeholder={`${level.vars[0]} and not ${level.vars[1] ?? level.vars[0]}`}
          />
          <button className="btn btn-primary" onClick={test} disabled={!expr.trim()}>
            ✓ {tr('Tester', 'Test')}
          </button>
        </div>
        {level.simple_len && <div className="text-xs text-muted">⭐ {tr(`3e étoile si ta condition fait au plus ${level.simple_len} caractères (sans les espaces).`, `3rd star if your condition has at most ${level.simple_len} chars (spaces ignored).`)}</div>}
        {err && <ErrorCard error={err} />}
      </div>
      <div className="card p-4">{session.hintPanel}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ Robot */

const SKINS: Record<string, string> = { classic: '🤖', cat: '🐱', snake: '🐍', ghost: '👻', alien: '👾', rocket: '🚀' }
const ROT: Record<string, number> = { '^': 0, '>': 90, v: 180, '<': 270 }


export function RobotGame({ session }: { session: Session }) {
  const level = session.level as RobotLevel
  const tr = useTr()
  const profile = useProfile()
  const settings = useSettings()
  const [code, setCode] = useState(level.starter_code)
  const [runs, setRuns] = useState<RobotRun[] | null>(null)
  const [gridIdx, setGridIdx] = useState(0)
  const [frame, setFrame] = useState(0)
  const [busy, setBusy] = useState(false)
  const [violations, setViolations] = useState<string[]>([])
  const skin = SKINS[profile.equipped.robotSkin] ?? '🤖'

  const run = async () => {
    setBusy(true)
    setViolations([])
    const check = await checkCode(code, [level.constraints])
    const r = await runRobot(code, level.grids, level.max_steps)
    setBusy(false)
    if (!r) return
    setRuns(r.results)
    setGridIdx(0)
    setFrame(0)
    const v = check.violations.map((x) => explainViolation(x, settings.lang))
    setViolations(v)
    const firstBad = r.results.findIndex((x) => !x.success)
    setTimeout(
      () => {
        if (r.success && !v.length) session.complete({ code })
        else {
          if (firstBad >= 0) setGridIdx(firstBad)
          session.fail(r.results.map((x) => x.reason ?? x.error?.type ?? '').filter(Boolean))
        }
      },
      Math.min(4000, (r.results[0]?.actions.length ?? 0) * 180 + 300),
    )
  }

  const current = runs?.[gridIdx]
  useEffect(() => {
    if (!current) return
    if (frame >= current.actions.length - 1) return
    const t = setTimeout(() => setFrame((f) => f + 1), 160)
    return () => clearTimeout(t)
  }, [current, frame])

  const grid = level.grids[gridIdx]
  const pos = current?.actions[Math.min(frame, current.actions.length - 1)]
  const picked = new Set(current?.actions.slice(0, frame + 1).filter((a) => a[3] === 'coin').map((a) => `${a[0]},${a[1]}`))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3">
        <div className="card space-y-2 p-4">
          {session.statement}
          <div className="text-sm text-muted">
            {tr('Commandes', 'Commands')} : <code>move()</code> <code>turn_left()</code> <code>turn_right()</code> <code>wall_ahead()</code> <code>at_goal()</code> <code>coin_here()</code> <code>pick_coin()</code>
          </div>
        </div>
        <div className="card p-4">
          {level.grids.length > 1 && (
            <div className="mb-2 flex gap-1">
              {level.grids.map((_, i) => (
                <button key={i} className={`pill ${i === gridIdx ? 'border-accent text-accent' : ''} ${runs ? (runs[i]?.success ? 'text-ok' : 'text-ko') : ''}`} onClick={() => { setGridIdx(i); setFrame(0) }}>
                  {tr('Carte', 'Map')} {i + 1} {runs ? (runs[i]?.success ? '✓' : '✗') : ''}
                </button>
              ))}
            </div>
          )}
          <div className="inline-grid gap-0.5 rounded-xl bg-line p-0.5" style={{ gridTemplateColumns: `repeat(${grid[0].length}, 2.2rem)` }}>
            {grid.flatMap((row, y) =>
              row.split('').map((c, x) => {
                const here = pos ? pos[0] === x && pos[1] === y : '^>v<'.includes(c)
                const dir = pos ? pos[2] : c
                return (
                  <div key={`${x}-${y}`} className={`flex h-[2.2rem] w-[2.2rem] items-center justify-center text-lg ${c === '#' ? 'bg-[#3a3f6b]' : 'bg-panel2'}`}>
                    {here ? (
                      <span style={{ transform: `rotate(${ROT[dir] ?? 0}deg)`, display: 'inline-block', transition: 'transform .15s' }} className={pos?.[3] === 'crash' ? 'shake' : ''}>
                        {skin}
                      </span>
                    ) : c === 'G' ? (
                      '🏁'
                    ) : c === '*' && !picked.has(`${x},${y}`) ? (
                      '🪙'
                    ) : c === '#' ? (
                      ''
                    ) : (
                      ''
                    )}
                  </div>
                )
              }),
            )}
          </div>
          {pos && <div className="mt-1 text-xs text-muted">↑ {tr('le robot regarde dans la direction de sa tête', 'the robot faces where its head points')}</div>}
          {current && !current.success && frame >= current.actions.length - 1 && (
            <div className="mt-2 rounded-lg border border-ko/50 bg-ko/10 p-2 text-sm">
              {current.error ? (
                <ErrorCard error={current.error} />
              ) : current.reason === 'crash' ? (
                tr('💥 Le robot s’est cogné dans un mur !', '💥 The robot hit a wall!')
              ) : current.reason === 'tired' ? (
                tr('😵 Le robot tourne en rond (trop de pas) : ta boucle s’arrête-t-elle ?', '😵 Too many steps: does your loop stop?')
              ) : current.reason === 'coins_left' ? (
                tr('🪙 Il reste des pièces à ramasser.', '🪙 Some coins are left.')
              ) : (
                tr('🏁 Le robot n’est pas sur l’arrivée.', '🏁 The robot is not on the goal.')
              )}
            </div>
          )}
        </div>
        {session.hintPanel && <div className="card p-4">{session.hintPanel}</div>}
      </section>
      <section className="space-y-3">
        <div className="h-[340px]">
          <CodeEditor value={code} onChange={setCode} onRun={run} theme={profile.equipped.editorTheme as EditorThemeName} fontSize={settings.fontSize} />
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={run} disabled={busy}>
            ▶ {tr('Lancer le robot', 'Run the robot')}
          </button>
          <button className="btn btn-ghost" onClick={() => setCode(level.starter_code)}>
            ↺ {tr('Réinitialiser', 'Reset')}
          </button>
        </div>
        {violations.map((v, i) => (
          <div key={i} className="rounded-lg border border-warn/50 bg-warn/10 px-2 py-1 text-sm">
            📐 {v.replace(/`/g, '')}
          </div>
        ))}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ Write the test */

export function WriteTestGame({ session }: { session: Session }) {
  const level = session.level as WriteTestLevel
  const tr = useTr()
  const profile = useProfile()
  const settings = useSettings()
  const [code, setCode] = useState(level.starter_code)
  const [results, setResults] = useState<{ label: string; passed: boolean; failure: PyError | null }[] | null>(null)
  const [err, setErr] = useState<PyError | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [done, setDone] = useState(false)

  const run = async () => {
    setErr(null)
    const r = await runWriteTest(code, level.implementations)
    if (!r) return
    if (!r.ok) {
      setErr(r.error ?? null)
      session.fail([r.error?.type ?? 'error'])
      return
    }
    setResults(r.results)
    const ok = level.implementations.every((impl, i) => (impl.correct ? r.results[i].passed : !r.results[i].passed))
    if (ok) {
      setDone(true)
      session.complete({ code })
    } else session.fail(['write_test'])
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3">
        <div className="card space-y-3 p-4">
          {session.statement}
          <CodeBlock code={level.signature} />
          <p className="text-sm text-muted">
            {tr(
              'Écris des `assert` qui passent sur la bonne version et échouent sur chaque version fausse. Pense aux cas limites : liste vide, un seul élément, égalités, négatifs…',
              'Write `assert`s that pass on the right version and fail on every wrong one. Think of edge cases: empty list, one item, ties, negatives…',
            )}
          </p>
        </div>
        <div className="card space-y-2 p-3">
          <div className="text-xs uppercase tracking-wider text-muted">{tr('Les suspects', 'The suspects')}</div>
          {level.implementations.map((impl, i) => {
            const r = results?.[i]
            const revealed = done
            return (
              <div key={i} className="rounded-lg border border-line">
                <button className="flex w-full items-center justify-between px-3 py-2 text-left text-sm" onClick={() => setOpen(open === i ? null : i)}>
                  <span>
                    {tr('Version', 'Version')} {'ABCDEF'[i]} {revealed && (impl.correct ? '😇' : '🦹')}
                  </span>
                  <span>{r ? (r.passed ? tr('survit 😇', 'survives 😇') : tr('éliminée 💀', 'eliminated 💀')) : ''}</span>
                </button>
                {open === i && <CodeBlock code={impl.code} className="m-2 mt-0" />}
              </div>
            )
          })}
          {results && !done && (
            <div className="text-sm text-warn">
              {tr('La bonne version doit survivre et toutes les autres doivent être éliminées.', 'The right version must survive and every other one must be eliminated.')}
            </div>
          )}
        </div>
        <div className="card p-4">{session.hintPanel}</div>
      </section>
      <section className="space-y-3">
        <div className="h-[340px]">
          <CodeEditor value={code} onChange={setCode} onRun={run} theme={profile.equipped.editorTheme as EditorThemeName} fontSize={settings.fontSize} />
        </div>
        <button className="btn btn-primary" onClick={run}>
          🧪 {tr('Lancer mes assert', 'Run my asserts')}
        </button>
        {err && <ErrorCard error={err} />}
      </section>
    </div>
  )
}
