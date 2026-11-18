import { useEffect, useMemo, useRef, useState } from 'react'
import type { CodeLevel, SimulationLevel, TestCase } from '../content/schema'
import { resolveFiles, runLevelTests, type TestReport, type TestResult } from '../engine/api'
import { explainViolation } from '../engine/explain'
import { useLang, useTr } from '../i18n'
import { useProfile, useSettings, useStore } from '../store/store'
import { CodeEditor, type EditorThemeName } from '../components/CodeEditor'
import { CodeBlock } from '../components/Markdown'
import { TestPanel } from '../components/TestPanel'
import { RunConsole, useInteractiveRun } from '../components/RunConsole'
import type { Session } from '../pages/LevelPage'
import { SimulationPanel } from './SimulationPanel'

/** `countdown(3)  # -> [3, 2, 1]`: the exam format, built from the visible tests. */
export function examplesBlock(tests: TestCase[], tr: (fr: string, en?: string) => string) {
  return tests
    .map((t) => {
      if (t.script) {
        const ins = t.stdin?.length ? `${tr('# saisies', '# inputs')} : ${t.stdin.map((s) => JSON.stringify(s)).join(', ')}\n` : ''
        return `${ins}${tr('# affiche', '# prints')} :\n${(t.output ?? '').replace(/\n$/, '').split('\n').map((l) => `#   ${l}`).join('\n')}`
      }
      const setup = t.setup ? `${t.setup.trim()}\n` : ''
      if (t.raises) return `${setup}${t.call}  # -> ${t.raises}`
      if (t.output !== undefined && t.expected === undefined)
        return `${setup}${t.call}  ${tr('# affiche', '# prints')} : ${t.output.replace(/\n$/, '').replace(/\n/g, ' ⏎ ')}`
      return `${setup}${t.call}  # -> ${t.expected}`
    })
    .join('\n')
}

export function errorTypesOf(report: TestReport): string[] {
  const out = new Set<string>()
  if (report.loadError) out.add(report.loadError.type)
  for (const r of report.results) {
    if (r.error) out.add(r.error.type)
    if (r.reason) out.add(r.reason)
  }
  return [...out]
}

export function firstErrorLine(report: TestReport | null): number | null {
  if (!report) return null
  if (report.loadError?.line) return report.loadError.line
  return report.results.find((r) => r.error?.line)?.error?.line ?? null
}

export function CodeGame({ session }: { session: Session }) {
  const level = session.level as CodeLevel | SimulationLevel
  const tr = useTr()
  const lang = useLang()
  const profile = useProfile()
  const settings = useSettings()
  const saveDraft = useStore((s) => s.saveDraft)
  const copyMode = level.type === 'copy'
  const [code, setCode] = useState(() => (session.replayKey ? level.starter_code : profile.drafts[level.id] ?? level.starter_code))
  const [report, setReport] = useState<TestReport | null>(null)
  const [partial, setPartial] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)
  const [lives, setLives] = useState(level.type === 'bug_hunt' ? (level.bugs ?? 1) + 1 : 0)
  const [submitted, setSubmitted] = useState(false)
  const [passed, setPassed] = useState(false)
  const [shake, setShake] = useState(false)
  const [showGiven, setShowGiven] = useState(false)
  const run = useInteractiveRun()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const files = useRef<Record<string, string> | null>(null)

  const tests = useMemo(
    () => [...level.tests.visible.map((t) => ({ ...t, hidden: false })), ...level.tests.hidden.map((t) => ({ ...t, hidden: true }))],
    [level],
  )
  const total = tests.length + level.tests.statistical.length

  useEffect(() => {
    void resolveFiles(level.files).then((f) => (files.current = f))
  }, [level.files])

  const onChange = (c: string) => {
    setCode(c)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveDraft(level.id, c), 600)
  }

  const runTests = async () => {
    if (running || passed || (copyMode && submitted)) return
    setRunning(true)
    setPartial([])
    setReport(null)
    const f = files.current ?? (await resolveFiles(level.files))
    const acc: TestResult[] = []
    const rep = await runLevelTests({
      code,
      tests,
      statistical: level.tests.statistical,
      seed: level.tests.random_seed,
      files: f,
      given_code: level.given_code,
      constraints: [level.constraints],
      packages: level.packages,
      perTestMs: level.type === 'big_volume' ? level.time_limit_ms : undefined,
      onResult: (r, i) => {
        acc[i] = r
        if (!copyMode) setPartial([...acc])
      },
    })
    setRunning(false)
    setReport(rep)
    if (copyMode) setSubmitted(true)
    if (rep.allPassed) {
      setPassed(true)
      if (level.type === 'simulation') return // completion after the observation question
      const chars = code.trim().length
      session.complete({
        code,
        chars,
        bonus3: level.type === 'golf' && level.par_chars ? chars <= level.par_chars : undefined,
      })
    } else {
      session.fail(errorTypesOf(rep))
      setShake(true)
      setTimeout(() => setShake(false), 500)
      if (level.type === 'bug_hunt') {
        const left = lives - 1
        if (left <= 0) {
          setLives((level.bugs ?? 1) + 1)
          setCode(level.starter_code)
          useStore.getState().toast('info', tr('💥 Plus de vies ! Le code buggé revient : relis-le calmement.', '💥 Out of lives! The buggy code is back: read it calmly.'))
        } else setLives(left)
      }
    }
  }

  const reset = () => {
    if (confirm(tr('Revenir au code de départ ? Ton code actuel sera perdu.', 'Back to the starting code? Your current code will be lost.'))) {
      setCode(level.starter_code)
      saveDraft(level.id, level.starter_code)
      setReport(null)
      setPartial([])
    }
  }

  const constraintsText = useMemo(() => {
    const c = level.constraints
    const items: string[] = []
    c.required.forEach((r) => items.push(explainViolation({ rule: 'required', detail: r }, lang).replace(/^Ton code doit utiliser |^Your code must use /, '✅ ')))
    c.forbidden.forEach((r) => items.push(explainViolation({ rule: 'forbidden', detail: r }, lang).replace(/^Interdit ici : |^Not allowed here: /, '⛔ ')))
    if (c.max_lines) items.push(tr(`📏 ${c.max_lines} lignes max`, `📏 ${c.max_lines} lines max`))
    if (c.max_chars) items.push(tr(`✂️ ${c.max_chars} caractères max`, `✂️ ${c.max_chars} chars max`))
    for (const [k, v] of Object.entries(c.max_count ?? {})) items.push(`🔢 ${k} ≤ ${v}`)
    return items
  }, [level.constraints, lang, tr])

  const chars = code.trim().length

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="min-w-0 space-y-4" aria-label={tr('Énoncé', 'Statement')}>
        <div className="card space-y-3 p-4">
          {session.statement}
          {level.tests.visible.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{tr('Exemples', 'Examples')}</div>
              <CodeBlock code={examplesBlock(level.tests.visible, tr)} />
            </div>
          )}
          {constraintsText.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {constraintsText.map((t, i) => (
                <span key={i} className="pill text-xs">
                  {t.replace(/`/g, '').replace(/\.$/, '')}
                </span>
              ))}
            </div>
          )}
          {level.type === 'golf' && level.par_chars && (
            <div className="text-sm">
              ⛳ {tr('Par', 'Par')} : <b>{level.par_chars}</b> {tr('caractères pour la 3e étoile', 'characters for the 3rd star')}
            </div>
          )}
          {level.type === 'big_volume' && (
            <div className="text-sm">⏱ {tr('Limite', 'Limit')} : {((level.time_limit_ms ?? 3000) / 1000).toFixed(1)} s {tr('par test', 'per test')}</div>
          )}
          {copyMode && (
            <div className="rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm">
              📝 {tr('Mode copie : comme sur un DS papier, tu ne peux ni exécuter ni tester. Une seule soumission. XP ×2.', 'Paper mode: like a written exam, no running and no tests. One submission only. XP ×2.')}
            </div>
          )}
          {level.given_code && (
            <div>
              <button className="text-sm text-accent2 underline" onClick={() => setShowGiven(!showGiven)}>
                {showGiven ? '▾' : '▸'} {tr('Code fourni (déjà chargé, à utiliser)', 'Given code (already loaded, use it)')}
              </button>
              {showGiven && <CodeBlock code={level.given_code} className="mt-2" />}
            </div>
          )}
        </div>
        {!copyMode && <div className="card p-4">{session.hintPanel}</div>}
      </section>

      <section className="min-w-0 space-y-3" aria-label={tr('Ton code', 'Your code')}>
        <div className={shake ? 'shake' : ''}>
          <div className="h-[380px]">
            <CodeEditor
              value={code}
              onChange={onChange}
              onRun={runTests}
              errorLine={firstErrorLine(report)}
              theme={profile.equipped.editorTheme as EditorThemeName}
              fontSize={settings.fontSize}
              readOnly={passed || (copyMode && submitted)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={runTests} disabled={running || passed || (copyMode && submitted)}>
            {copyMode ? '📤 ' + tr('Rendre ma copie', 'Hand in') : '✓ ' + tr('Lancer les tests', 'Run tests')} <span className="kbd hidden sm:inline">⌘/Ctrl ↵</span>
          </button>
          {!copyMode && (
            <button className="btn" onClick={() => run.start({ code, files: files.current ?? {}, given_code: level.given_code, packages: level.packages })} disabled={run.running}>
              ▶ {tr('Exécuter', 'Run')}
            </button>
          )}
          <button className="btn btn-ghost" onClick={reset} disabled={copyMode && submitted}>
            ↺ {tr('Réinitialiser', 'Reset')}
          </button>
          {level.type === 'bug_hunt' && (
            <span className="pill ml-auto" aria-label={tr('vies', 'lives')}>
              {'❤️'.repeat(Math.max(0, lives))}
              <span className="opacity-25 grayscale">{'❤️'.repeat(Math.max(0, (level.bugs ?? 1) + 1 - lives))}</span>
              <span className="ml-1 text-muted">· {level.bugs} bug{(level.bugs ?? 1) > 1 ? 's' : ''}</span>
            </span>
          )}
          {level.type === 'golf' && (
            <span className={`pill ml-auto ${level.par_chars && chars <= level.par_chars ? 'border-ok text-ok' : ''}`}>
              ⛳ {chars} / {level.par_chars}
            </span>
          )}
        </div>
        {!copyMode && <RunConsole run={run} placeholder={tr('« Exécuter » lance ton programme. « Lancer les tests » vérifie tes fonctions.', '“Run” executes your program. “Run tests” checks your functions.')} />}
        {(!copyMode || submitted) && <TestPanel report={report} running={running} total={total} partial={partial} />}
        {copyMode && submitted && !passed && (
          <div className="card p-3 text-sm">
            {tr('Copie rendue… il reste des erreurs. Lis les tests ci-dessus, puis rejoue le niveau (bouton « Rejouer » en haut de la carte du niveau).', 'Handed in… there are mistakes. Read the tests above, then replay the level.')}{' '}
            <button
              className="btn mt-2"
              onClick={() => {
                setSubmitted(false)
                setReport(null)
              }}
            >
              ↺ {tr('Recommencer', 'Start over')}
            </button>
          </div>
        )}
        {level.type === 'simulation' && passed && <SimulationPanel level={level} code={code} session={session} />}
      </section>
    </div>
  )
}
