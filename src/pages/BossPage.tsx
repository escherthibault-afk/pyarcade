import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { motion } from 'framer-motion'
import type { BossLevel, BossStep } from '../content/schema'
import { bossFile, bossVariant } from '../content/variants'
import { getWorld, isLevelUnlocked, worldStars } from '../content'
import { resolveFiles, runLevelTests, type TestReport, type TestResult } from '../engine/api'
import { useTr } from '../i18n'
import { MAX_HEARTS, HEART_REGEN_MS, useProfile, useSettings, useStore } from '../store/store'
import { CodeEditor, type EditorThemeName } from '../components/CodeEditor'
import { CodeBlock, Markdown } from '../components/Markdown'
import { TestPanel } from '../components/TestPanel'
import { RunConsole, useInteractiveRun } from '../components/RunConsole'
import { HintPanel } from '../components/HintPanel'
import { SolutionReveal } from '../components/SolutionReveal'
import { examplesBlock, errorTypesOf, firstErrorLine } from '../games/CodeGame'
import { LiveGame } from '../live'
import { sfx } from '../lib/sound'
import { celebrate } from '../lib/confetti'
import { awardBadges } from '../lib/badges'
import { gradeExam, type ExamGrade } from '../lib/grading'

const VARIANT_LABEL = { guided: ['Boss guidé', 'Guided boss', '🛡️'], twin: ['Boss jumeau', 'Twin boss', '👯'], exam: ['Boss examen', 'Exam boss', '🎓'] } as const

export function BossPage({ level: base }: { level: BossLevel }) {
  const tr = useTr()
  const profile = useProfile()
  const settings = useSettings()
  const world = getWorld(base.world)
  const [params] = useSearchParams()
  const final = params.get('final') === '1'
  const unlocked = final || isLevelUnlocked(profile, base, settings.unlockAll)
  const [variantIdx, setVariantIdx] = useState(0)
  const level = useMemo(() => {
    const l = bossVariant(base, variantIdx)
    // final exam: any twin project, in exam conditions
    return final ? { ...l, variant: 'exam' as const, time_limit_minutes: 90, title: `🎓 Diplôme PyArcade — ${l.title.replace(/^\S+\s/, '')}` } : l
  }, [base, variantIdx, final])
  const exam = level.variant === 'exam'
  const [phase, setPhase] = useState<'intro' | 'fight' | 'won' | 'graded'>(exam ? 'intro' : 'fight')
  const [copyMode, setCopyMode] = useState(false)

  if (!unlocked) {
    const s = world ? worldStars(profile, world) : { stars: 0 }
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <div className="text-6xl">🔒👾</div>
        <h1 className="mt-2 font-display text-2xl">{level.title}</h1>
        <p className="mt-2">
          {level.variant !== 'guided'
            ? tr('Bats d’abord le boss guidé de ce projet.', 'Beat the guided boss of this project first.')
            : tr(`Il te faut ${level.min_stars} ⭐ dans ce monde pour l’affronter (tu en as ${s.stars}).`, `You need ${level.min_stars} ⭐ in this world (you have ${s.stars}).`)}
        </p>
        <Link className="btn mt-4" to="/map">
          🗺️ {tr('Retour à la carte', 'Back to the map')}
        </Link>
      </div>
    )
  }

  if (phase === 'intro')
    return (
      <div className="mx-auto max-w-2xl p-4">
        <div className="card space-y-4 p-6">
          <div className="text-5xl">🎓</div>
          <h1 className="font-display text-3xl">{level.title}</h1>
          <Markdown src={level.statement_md} />
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>⏱ {tr('Durée', 'Duration')} : {level.time_limit_minutes} min</li>
            <li>🚫 {tr('Aucun indice', 'No hints')}</li>
            <li>📊 {tr('Note sur 20 : correction et cas limites (tests), respect des signatures, lisibilité.', 'Graded /20: correctness & edge cases (tests), signatures, readability.')}</li>
            <li>🙈 {tr('Pendant l’épreuve, seuls les tests visibles sont lancés ; les tests cachés comptent à la remise.', 'During the exam only visible tests run; hidden tests count at hand-in.')}</li>
          </ul>
          {base.variants.length > 1 && (
            <label className="block text-sm">
              {tr('Variante du sujet', 'Exam variant')}
              <select className="ml-2 rounded-lg border border-line bg-bg2 px-2 py-1" value={variantIdx} onChange={(e) => setVariantIdx(Number(e.target.value))}>
                {base.variants.map((v, i) => (
                  <option key={i} value={i}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={copyMode} onChange={(e) => setCopyMode(e.target.checked)} />
            📝 {tr('Mode copie : sans exécution du tout, une seule remise (comme un DS papier)', 'Paper mode: no running at all, one hand-in')}
          </label>
          <button
            className="btn btn-primary"
            onClick={() => {
              useStore.getState().update((p) => {
                p.bosses[level.id] = { ...(p.bosses[level.id] ?? { validated: [], won: false, errors: 0 }), examStartedAt: Date.now() }
              })
              setPhase('fight')
            }}
          >
            ⏱ {tr('Commencer l’épreuve', 'Start the exam')}
          </button>
        </div>
      </div>
    )

  return <BossFight key={`${level.id}-${variantIdx}`} level={level} copyMode={copyMode} onPhase={setPhase} phase={phase} final={final} />
}

function defLine(code: string, fn: string): number | null {
  const lines = code.split('\n')
  const i = lines.findIndex((l) => new RegExp(`^\\s*def\\s+${fn}\\s*\\(`).test(l))
  return i >= 0 ? i + 1 : null
}

function BossFight({ level, copyMode, onPhase, phase, final }: { level: BossLevel; copyMode: boolean; onPhase: (p: 'intro' | 'fight' | 'won' | 'graded') => void; phase: string; final: boolean }) {
  const tr = useTr()
  const profile = useProfile()
  const settings = useSettings()
  const navigate = useNavigate()
  const heartsNow = useStore((s) => s.heartsNow)
  const loseHeart = useStore((s) => s.loseHeart)
  const exam = level.variant === 'exam'
  const draftKey = final ? `${level.id}:final` : `${level.id}`
  const [code, setCode] = useState(() => profile.drafts[draftKey] ?? bossFile(level, 'starter_code'))
  const [stepIdx, setStepIdx] = useState(0)
  const [focusLine, setFocusLine] = useState<number | null>(null)
  const [report, setReport] = useState<TestReport | null>(null)
  const [partial, setPartial] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)
  const [hit, setHit] = useState(false)
  const [hints, setHints] = useState<Record<string, number>>({})
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [grade, setGrade] = useState<ExamGrade | null>(null)
  const [now, setNow] = useState(Date.now())
  const files = useRef<Record<string, string>>({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const run = useInteractiveRun()
  const bp = profile.bosses[level.id]
  const validated = useMemo(() => new Set(bp?.validated ?? []), [bp])
  const hearts = heartsNow()
  const step: BossStep = level.steps[stepIdx]

  useEffect(() => {
    void resolveFiles(level.files).then((f) => (files.current = f))
  }, [level.files])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const deadline = exam && bp?.examStartedAt ? bp.examStartedAt + (level.time_limit_minutes ?? 90) * 60_000 : null
  const remaining = deadline ? Math.max(0, deadline - now) : null

  const allTests = useMemo(
    () =>
      level.steps.flatMap((s) => [
        ...s.tests.visible.map((t) => ({ ...t, fn: s.fn, hidden: false })),
        ...(exam && phase !== 'graded' ? [] : s.tests.hidden.map((t) => ({ ...t, fn: s.fn, hidden: true }))),
      ]),
    [level, exam, phase],
  )
  const allStats = useMemo(() => level.steps.flatMap((s) => s.tests.statistical.map((t) => ({ ...t, fn: s.fn }))), [level])
  const seed = level.steps.find((s) => s.tests.random_seed !== undefined)?.tests.random_seed

  const hp = Math.round((1 - validated.size / level.steps.length) * 100)

  const onChange = (c: string) => {
    setCode(c)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => useStore.getState().saveDraft(draftKey, c), 600)
  }

  const attack = async (opts: { final?: boolean } = {}) => {
    if (running) return
    if (!exam && hearts <= 0) return
    setRunning(true)
    setPartial([])
    const tests = opts.final ? level.steps.flatMap((s) => [...s.tests.visible.map((t) => ({ ...t, fn: s.fn })), ...s.tests.hidden.map((t) => ({ ...t, fn: s.fn, hidden: true }))]) : allTests
    const acc: TestResult[] = []
    const rep = await runLevelTests({
      code,
      tests,
      statistical: allStats,
      seed,
      files: files.current,
      constraints: level.steps.map((s) => (s.constraints ? { ...s.constraints, scope: s.constraints.scope ?? s.fn } : undefined)),
      packages: level.packages,
      perTestMs: 10_000,
      onResult: (r, i) => {
        acc[i] = r
        setPartial([...acc])
      },
    })
    setRunning(false)
    setReport(rep)
    if (opts.final) {
      const g = gradeExam(level, code, rep)
      setGrade(g)
      useStore.getState().update((p) => {
        const b = (p.bosses[level.id] ??= { validated: [], won: false, errors: 0 })
        b.bestScore = Math.max(b.bestScore ?? 0, g.total)
        b.won = b.won || g.total >= 10
        b.examStartedAt = undefined
        if (g.total >= 14 && level.project.startsWith('wordle')) p.examsDone.push(`${level.id}:14`)
        if (final && g.total >= 10) {
          p.diploma = { project: level.title, score: g.total, date: new Date().toISOString() }
          p.secret = true
        }
        p.xp += Math.round(g.total * 15)
        p.coins += Math.round(g.total * 2)
      })
      useStore.getState().saveDraft(draftKey, bossFile(level, 'starter_code'))
      if (g.total >= 10) celebrate(true)
      awardBadges()
      onPhase('graded')
      return
    }
    // which functions pass all their tests now?
    const byFn = new Map<string, boolean>()
    rep.results.forEach((r) => {
      const fn = r.fn ?? ''
      byFn.set(fn, (byFn.get(fn) ?? true) && r.passed)
    })
    const badScopes = new Set(rep.violations.map((v) => v.scope))
    const nowOk = level.steps.filter((s) => byFn.get(s.fn) && !rep.loadError && !badScopes.has(s.fn))
    const fresh = nowOk.filter((s) => !validated.has(s.fn))
    const attempted = level.steps.filter((s) => !rep.stubs.includes(s.fn))
    const brokenAttempt = attempted.some((s) => byFn.get(s.fn) === false) || !!rep.loadError
    useStore.getState().update((p) => {
      const b = (p.bosses[level.id] ??= { validated: [], won: false, errors: 0 })
      b.validated = Array.from(new Set([...b.validated, ...nowOk.map((s) => s.fn)]))
      if (brokenAttempt) b.errors += 1
    })
    if (fresh.length) {
      sfx.hit()
      setHit(true)
      setTimeout(() => setHit(false), 600)
    }
    if (brokenAttempt) {
      if (!exam) loseHeart()
      useStore.getState().recordAttempt(level.id, false, level.concepts, errorTypesOf(rep))
      sfx.ko()
    }
    const total = new Set([...validated, ...nowOk.map((s) => s.fn)])
    if (!exam && total.size === level.steps.length && !bp?.won) {
      useStore.getState().update((p) => {
        p.bosses[level.id].won = true
        p.xp += level.xp
        p.coins += 50
      })
      const sawSolution = Object.values(revealed).some(Boolean)
      const bossStars = sawSolution ? 1 : (bp?.errors ?? 0) === 0 && !brokenAttempt ? 3 : 2
      useStore.getState().completeLevel({ levelId: level.id, stars: bossStars, xp: 0, coins: 0, concepts: level.concepts, usedHints: 0, firstTry: false, type: 'boss' })
      sfx.win()
      celebrate(true)
      awardBadges()
      onPhase('won')
    } else if (!exam && total.size === level.steps.length) onPhase('won')
  }

  const goTo = (i: number) => {
    setStepIdx(i)
    setFocusLine(null)
    setTimeout(() => setFocusLine(defLine(code, level.steps[i].fn)), 0)
  }

  if (phase === 'graded' && grade) return <GradeView level={level} grade={grade} report={report} final={final} />

  const won = !exam && level.steps.every((s) => validated.has(s.fn))
  const variantMeta = VARIANT_LABEL[level.variant]

  return (
    <div className="mx-auto max-w-[1500px] px-3 pb-16 pt-3 sm:px-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link to="/map" className="btn btn-ghost px-2 py-1 text-sm">
          ← {tr('Carte', 'Map')}
        </Link>
        <span className="pill">
          {variantMeta[2]} {tr(variantMeta[0], variantMeta[1])}
        </span>
        {!exam && (
          <span className="pill" aria-label={tr('cœurs', 'hearts')}>
            {'❤️'.repeat(hearts)}
            <span className="opacity-25 grayscale">{'❤️'.repeat(MAX_HEARTS - hearts)}</span>
          </span>
        )}
        {remaining !== null && (
          <span className={`pill font-mono ${remaining < 5 * 60_000 ? 'border-ko text-ko' : ''}`}>
            ⏱ {Math.floor(remaining / 60000)}:{String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <motion.div animate={hit ? { x: [0, -8, 8, -4, 0], scale: [1, 0.92, 1] } : {}} className="text-5xl sm:text-6xl" aria-hidden>
          {won ? '💥' : level.project.includes('wordle') ? '🟩' : '👾'}
        </motion.div>
        <div className="min-w-[240px] flex-1">
          <h1 className="font-display text-2xl sm:text-3xl">{level.title}</h1>
          {!exam && (
            <div className="mt-1">
              <div className="flex justify-between text-xs text-muted">
                <span>{tr('PV du boss', 'Boss HP')}</span>
                <span>
                  {validated.size} / {level.steps.length} {tr('fonctions', 'functions')}
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full border border-line bg-panel2">
                <motion.div className="h-full bg-gradient-to-r from-ko to-warn" animate={{ width: `${hp}%` }} transition={{ type: 'spring', stiffness: 120 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {won && phase === 'won' && <LiveGame level={level} code={code} />}

      {!exam && hearts <= 0 && !won && (
        <div className="card mb-4 border-ko p-4 text-sm">
          💔 {tr('Plus de cœurs ! Ils reviennent seuls (1 toutes les', 'No hearts left! They come back (1 every')} {HEART_REGEN_MS / 60000} min){' '}
          {tr('ou tout de suite en réussissant un niveau de révision.', 'or right now by clearing a review level.')}{' '}
          <button className="btn ml-2" onClick={() => navigate(`/reviews?heal=1`)}>
            🔁 {tr('Niveau de révision', 'Review level')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="min-w-0 space-y-3">
          {level.intro_md && (
            <details className="card p-4" open={!bp?.validated?.length}>
              <summary className="cursor-pointer font-semibold">📜 {tr('Le sujet', 'The brief')}</summary>
              <Markdown src={level.intro_md} className="mt-2" />
            </details>
          )}
          <div className="card p-2">
            <ol className="space-y-1">
              {level.steps.map((s, i) => (
                <li key={s.fn}>
                  <button onClick={() => goTo(i)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${i === stepIdx ? 'bg-accent/15 ring-1 ring-accent' : 'hover:bg-panel2'}`}>
                    <span className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${validated.has(s.fn) ? 'border-ok bg-ok text-[var(--ok-text)]' : 'border-line'}`}>{validated.has(s.fn) ? '✓' : i + 1}</span>
                    <code className="font-mono">{s.fn}</code>
                    <span className="truncate text-muted">— {s.title}</span>
                    {exam && <span className="ml-auto text-xs text-muted">{s.points} pt</span>}
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="card space-y-3 p-4">
            <div className="font-display text-lg">
              {stepIdx + 1}. <code className="font-mono">{step.fn}</code> — {step.title}
            </div>
            <Markdown src={step.statement_md} />
            {step.tests.visible.length > 0 && <CodeBlock code={examplesBlock(step.tests.visible, tr)} />}
            {level.variant === 'guided' && (
              <HintPanel
                levelId={`${level.id}:${step.fn}`}
                hints={step.hints}
                revealed={hints[step.fn] ?? 0}
                onReveal={(n) => setHints({ ...hints, [step.fn]: n })}
              />
            )}
            {level.variant === 'guided' && (
              <SolutionReveal
                key={step.fn}
                reference={{ code: step.solution }}
                unlocked={(hints[step.fn] ?? 0) >= step.hints.length || validated.has(step.fn) || (bp?.errors ?? 0) >= 3}
                shown={!!revealed[step.fn]}
                onShow={() => setRevealed({ ...revealed, [step.fn]: true })}
                label={tr(`Voir la solution de ${step.fn}`, `Show the solution of ${step.fn}`)}
                lockedText={tr('Bloqué sur cette fonction ? Sa solution se débloque après ses 3 indices ou 3 attaques ratées.', 'Stuck on this function? Its solution unlocks after its 3 hints or 3 failed attacks.')}
                warning={tr(
                  'Le boss sera quand même battu, mais avec 1 étoile seulement. Les autres fonctions restent à écrire toi-même.',
                  'You can still beat the boss, but with one star only. The other functions are still yours to write.',
                )}
              />
            )}
            <div className="flex justify-between">
              <button className="btn btn-ghost text-sm" disabled={stepIdx === 0} onClick={() => goTo(stepIdx - 1)}>
                ← {tr('Précédente', 'Previous')}
              </button>
              <button className="btn btn-ghost text-sm" disabled={stepIdx === level.steps.length - 1} onClick={() => goTo(stepIdx + 1)}>
                {tr('Suivante', 'Next')} →
              </button>
            </div>
          </div>
        </section>
        <section className="min-w-0 space-y-3">
          <div className="h-[520px]">
            <CodeEditor
              value={code}
              onChange={onChange}
              onRun={() => (copyMode ? undefined : attack())}
              errorLine={firstErrorLine(report)}
              theme={profile.equipped.editorTheme as EditorThemeName}
              fontSize={settings.fontSize}
              focusLine={focusLine}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {!copyMode && (
              <button className="btn btn-primary" onClick={() => attack()} disabled={running || (!exam && hearts <= 0)}>
                ⚔️ {exam ? tr('Tester (tests visibles)', 'Test (visible tests)') : tr('Attaquer : lancer les tests', 'Attack: run the tests')} <span className="kbd hidden sm:inline">⌘/Ctrl ↵</span>
              </button>
            )}
            {!copyMode && (
              <button className="btn" onClick={() => run.start({ code, files: files.current, packages: level.packages })}>
                ▶ {tr('Exécuter', 'Run')}
              </button>
            )}
            {exam && (
              <button
                className="btn btn-ok"
                disabled={running}
                onClick={() => {
                  if (confirm(tr('Rendre ta copie maintenant ? Tous les tests (cachés compris) vont être lancés et notés.', 'Hand in now? Every test (hidden included) will be run and graded.'))) void attack({ final: true })
                }}
              >
                📤 {tr('Rendre ma copie', 'Hand in')}
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={() => {
                if (confirm(tr('Repartir du fichier de départ ?', 'Restart from the starting file?'))) onChange(bossFile(level, 'starter_code'))
              }}
            >
              ↺
            </button>
          </div>
          {remaining === 0 && exam && (
            <div className="card border-ko p-3 text-sm">
              ⏰ {tr('Temps écoulé ! Rends ta copie.', 'Time is up! Hand in your work.')}
            </div>
          )}
          {!copyMode && <RunConsole run={run} />}
          {!copyMode && <TestPanel report={report} running={running} total={allTests.length + allStats.length} partial={partial} />}
        </section>
      </div>
    </div>
  )
}

function GradeView({ level, grade, report, final }: { level: BossLevel; grade: ExamGrade; report: TestReport | null; final: boolean }) {
  const tr = useTr()
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="card p-6 text-center">
        <div className="text-5xl">{grade.total >= 16 ? '🏆' : grade.total >= 10 ? '🎓' : '📚'}</div>
        <h1 className="font-display text-3xl">{level.title}</h1>
        <div className="mt-2 font-display text-6xl">
          {grade.total.toFixed(1)}
          <span className="text-2xl text-muted"> / 20</span>
        </div>
      </div>
      <div className="card overflow-x-auto p-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="p-1">{tr('Fonction', 'Function')}</th>
              <th className="p-1">{tr('Tests', 'Tests')}</th>
              <th className="p-1">{tr('Signature', 'Signature')}</th>
              <th className="p-1">{tr('Lisibilité', 'Readability')}</th>
              <th className="p-1 text-right">{tr('Points', 'Points')}</th>
            </tr>
          </thead>
          <tbody>
            {grade.rows.map((r) => (
              <tr key={r.fn} className="border-t border-line">
                <td className="p-1 font-mono">{r.fn}</td>
                <td className="p-1">
                  {r.passed}/{r.total}
                </td>
                <td className="p-1">{r.signature ? '✓' : '✗'}</td>
                <td className="p-1" title={r.notes.join(' · ')}>
                  {r.readability ? '✓' : '~'} {r.notes.length > 0 && <span className="text-xs text-muted">{r.notes.join(' · ')}</span>}
                </td>
                <td className="p-1 text-right font-semibold">
                  {r.score.toFixed(1)} / {r.max}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {report && <TestPanel report={report} running={false} total={report.results.length} partial={[]} />}
      {final && grade.total >= 10 && (
        <div className="card border-gold p-4 text-center">
          <div className="font-display text-2xl text-gold">🎓 {tr('Diplôme PyArcade obtenu !', 'PyArcade diploma earned!')}</div>
          <p className="text-sm">{tr('Le monde secret est débloqué sur la carte.', 'The secret world is now unlocked on the map.')}</p>
          <Link className="btn btn-primary mt-2" to="/certificate">
            📜 {tr('Voir le certificat', 'See the certificate')}
          </Link>
        </div>
      )}
      <div className="flex justify-center gap-2">
        <Link className="btn" to="/map">
          🗺️ {tr('Carte', 'Map')}
        </Link>
        <button className="btn btn-primary" onClick={() => location.reload()}>
          ↺ {tr('Repasser l’épreuve', 'Retake')}
        </button>
      </div>
    </div>
  )
}
