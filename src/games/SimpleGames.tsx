import { useEffect, useMemo, useRef, useState } from 'react'
import type { LessonLevel, PredictLevel, QuizLevel, ColorTilesLevel } from '../content/schema'
import { useTr } from '../i18n'
import { useProfile, useSettings, useStore } from '../store/store'
import { CodeEditor, type EditorThemeName } from '../components/CodeEditor'
import { CodeBlock, Markdown } from '../components/Markdown'
import { RunConsole, useInteractiveRun } from '../components/RunConsole'
import { resolveFiles } from '../engine/api'
import { evaluateGuess, type Tile } from '../lib/wordle'
import { sfx } from '../lib/sound'
import type { Session } from '../pages/LevelPage'

const norm = (s: string) =>
  s
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n+$/, '')

/* ------------------------------------------------------------------ lesson */

export function LessonGame({ session }: { session: Session }) {
  const level = session.level as LessonLevel
  const tr = useTr()
  const profile = useProfile()
  const settings = useSettings()
  const [code, setCode] = useState(level.example_code)
  const [ok, setOk] = useState(false)
  const run = useInteractiveRun()

  const go = async () => {
    const files = await resolveFiles(level.files)
    const r = await run.start({ code, files, stdin: level.stdin, packages: level.packages })
    if (!r || r.needs) return
    if (level.expected_output === undefined) {
      if (r.ok) setOk(true)
    } else if (r.ok && norm(r.stdout) === norm(level.expected_output)) {
      setOk(true)
      sfx.ok()
    } else if (r.ok) session.fail(['wrong_output'])
  }

  // when the program needs input, the console replays it; check completion afterwards
  useEffect(() => {
    const r = run.result
    if (!r || r.needs || !r.ok || ok) return
    if (level.expected_output === undefined || norm(r.stdout) === norm(level.expected_output)) setOk(true)
  }, [run.result, level.expected_output, ok])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="card space-y-3 p-4">
        {session.statement}
        {level.task_md && (
          <div className="rounded-xl border border-accent2/40 bg-accent2/10 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent2">🎯 {tr('À toi', 'Your turn')}</div>
            <Markdown src={level.task_md} />
          </div>
        )}
        {level.expected_output !== undefined && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">{tr('Affichage à obtenir', 'Output to obtain')}</div>
            <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-line bg-bg2 p-2 font-mono text-sm">{level.expected_output}</pre>
          </div>
        )}
        {session.hintPanel}
      </section>
      <section className="space-y-3">
        <div className="h-[300px]">
          <CodeEditor value={code} onChange={setCode} onRun={go} theme={profile.equipped.editorTheme as EditorThemeName} fontSize={settings.fontSize} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={go} disabled={run.running}>
            ▶ {tr('Exécuter', 'Run')} <span className="kbd hidden sm:inline">⌘/Ctrl ↵</span>
          </button>
          <button className="btn btn-ghost" onClick={() => setCode(level.example_code)}>
            ↺ {tr('Exemple d’origine', 'Original example')}
          </button>
          {ok && (
            <button className="btn btn-ok pop ml-auto" onClick={() => session.complete({ stars: session.hints ? 2 : 3, code })}>
              ✓ {tr('J’ai compris, continuer', 'Got it, continue')}
            </button>
          )}
        </div>
        <RunConsole run={run} />
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ predict the output / speed read */

export function PredictGame({ session }: { session: Session }) {
  const level = session.level as PredictLevel
  const tr = useTr()
  const profile = useProfile()
  const [answer, setAnswer] = useState('')
  const [wrong, setWrong] = useState<string | null>(null)
  const [started, setStarted] = useState(!level.timed_seconds)
  const [elapsed, setElapsed] = useState(0)
  const t0 = useRef(0)
  const best = profile.levels[level.id]?.bestTimeMs
  const limit = (level.timed_seconds ?? 0) * 1000

  useEffect(() => {
    if (!started || !level.timed_seconds) return
    t0.current = Date.now()
    const t = setInterval(() => setElapsed(Date.now() - t0.current), 100)
    return () => clearInterval(t)
  }, [started, level.timed_seconds])

  const timeUp = !!level.timed_seconds && elapsed > limit

  const submit = () => {
    if (norm(answer) === norm(level.answer)) {
      const timeMs = level.timed_seconds ? Date.now() - t0.current : undefined
      session.complete({ timeMs, bonus3: level.timed_seconds ? session.mistakes === 0 && (timeMs ?? 0) <= limit : undefined })
    } else {
      session.fail(['wrong_output'])
      const exp = norm(level.answer).split('\n')
      const got = norm(answer).split('\n')
      const firstDiff = exp.findIndex((l, i) => got[i] !== l)
      setWrong(
        got.length !== exp.length && firstDiff === -1
          ? tr(`Pas le bon nombre de lignes : la sortie en a ${exp.length}.`, `Wrong number of lines: the output has ${exp.length}.`)
          : tr(`Ligne ${firstDiff + 1} incorrecte. La sortie a ${exp.length} ligne(s).`, `Line ${firstDiff + 1} is wrong. The output has ${exp.length} line(s).`),
      )
    }
  }

  if (!started)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card p-5 text-center">
          {session.statement}
          <div className="mt-3 text-5xl">⚡</div>
          <p className="mt-2">
            {tr(`Speed Read : lis le code et tape sa sortie en moins de ${level.timed_seconds} s.`, `Speed Read: read the code and type its output in under ${level.timed_seconds} s.`)}
          </p>
          {best !== undefined && <p className="text-sm text-muted">👻 {tr('Ton fantôme', 'Your ghost')} : {(best / 1000).toFixed(1)} s</p>}
          <button className="btn btn-primary mt-3" onClick={() => setStarted(true)} autoFocus>
            {tr('Go !', 'Go!')}
          </button>
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card space-y-3 p-4">
        {!level.timed_seconds && session.statement}
        <CodeBlock code={level.code} />
        {level.stdin.length > 0 && (
          <div className="text-sm text-muted">
            ⌨️ {tr('Saisies tapées au clavier', 'Keyboard inputs')} : {level.stdin.map((s) => <code key={s} className="kbd mx-1">{s}</code>)}
          </div>
        )}
        {level.timed_seconds && (
          <div className="relative h-3 overflow-hidden rounded-full bg-panel2" aria-label="timer">
            <div className={`h-full ${timeUp ? 'bg-ko' : 'bg-accent2'}`} style={{ width: `${Math.min(100, (elapsed / limit) * 100)}%` }} />
            {best !== undefined && <div title={tr('fantôme', 'ghost')} className="absolute top-0 h-full w-1 bg-gold" style={{ left: `${Math.min(100, (best / limit) * 100)}%` }} />}
          </div>
        )}
        <label className="block text-sm font-semibold" htmlFor="predict-answer">
          {tr('Qu’affiche ce programme ? (exactement, une ligne par print)', 'What does this program print? (exactly, one line per print)')}
        </label>
        <textarea
          id="predict-answer"
          className="h-28 w-full rounded-xl border border-line bg-bg2 p-3 font-mono text-sm"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
          spellCheck={false}
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={submit} disabled={!answer.trim()}>
            ✓ {tr('Valider', 'Check')} <span className="kbd hidden sm:inline">⌘/Ctrl ↵</span>
          </button>
          {timeUp && <span className="text-sm text-ko">⏰ {tr('Temps dépassé : tu peux finir, mais sans la 3e étoile.', 'Time is up: you can finish, without the 3rd star.')}</span>}
        </div>
        {wrong && <div className="shake rounded-xl border border-ko/50 bg-ko/10 p-2 text-sm">✗ {wrong}</div>}
      </div>
      <div className="card p-4">{session.hintPanel}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ flash quiz */

function shuffle<T>(a: T[]): T[] {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

export function QuizGame({ session }: { session: Session }) {
  const level = session.level as QuizLevel
  const tr = useTr()
  const bumpMax = (n: number) =>
    useStore.getState().update((p) => {
      p.counters.max_combo = Math.max(p.counters.max_combo ?? 0, n)
    })
  const questions = useMemo(() => shuffle(level.questions), [level])
  const [started, setStarted] = useState(false)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [points, setPoints] = useState(0)
  const [combo, setCombo] = useState(0)
  const [left, setLeft] = useState(level.time_limit)
  const [over, setOver] = useState(false)

  useEffect(() => {
    if (!started || over) return
    const t = setInterval(() => setLeft((l) => (l <= 1 ? (clearInterval(t), setOver(true), 0) : l - 1)), 1000)
    return () => clearInterval(t)
  }, [started, over])

  const q = questions[i]
  const choose = (k: number) => {
    if (picked !== null || over) return
    setPicked(k)
    if (k === q.answer) {
      const c = combo + 1
      setCombo(c)
      bumpMax(c)
      setScore((s) => s + 1)
      setPoints((p) => p + 10 * Math.min(c, 5))
      sfx.combo(c)
      setTimeout(next, 650)
    } else {
      setCombo(0)
      sfx.ko()
    }
  }
  const next = () => {
    setPicked(null)
    if (i + 1 >= questions.length) setOver(true)
    else setI((x) => x + 1)
  }

  const ratio = score / questions.length
  useEffect(() => {
    if (!over) return
    if (ratio >= 0.6) session.complete({ stars: ratio === 1 ? 3 : ratio >= 0.8 ? 2 : 1, extra: `${score}/${questions.length} · ${points} pts` })
    else session.fail(['quiz'])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over])

  if (!started)
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-6 text-center">
          {session.statement}
          <div className="mt-2 text-5xl">⚡</div>
          <p className="mt-2">
            {tr(`${questions.length} questions, ${level.time_limit} secondes. Enchaîne les bonnes réponses pour un combo ×2, ×3…`, `${questions.length} questions, ${level.time_limit} seconds. Chain right answers for a ×2, ×3… combo.`)}
          </p>
          <button className="btn btn-primary mt-4" onClick={() => setStarted(true)} autoFocus>
            {tr('C’est parti !', 'Let’s go!')}
          </button>
        </div>
      </div>
    )

  if (over)
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-6 text-center">
          <div className="text-5xl">{ratio >= 0.6 ? '🏁' : '💥'}</div>
          <div className="mt-2 font-display text-3xl">
            {score} / {questions.length}
          </div>
          <div className="text-muted">{points} pts</div>
          {ratio < 0.6 && (
            <>
              <p className="mt-2">{tr('Il faut au moins 60 % de bonnes réponses. Retente ta chance !', 'You need at least 60% right answers. Try again!')}</p>
              <button className="btn btn-primary mt-3" onClick={() => location.reload()}>
                ↺ {tr('Rejouer', 'Replay')}
              </button>
            </>
          )}
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel2">
          <div className="h-full bg-accent2 transition-all" style={{ width: `${(left / level.time_limit) * 100}%` }} />
        </div>
        <span className={`font-mono ${left <= 10 ? 'text-ko' : ''}`}>{left}s</span>
        <span className={`pill ${combo >= 2 ? 'pop border-gold text-gold' : ''}`}>combo ×{Math.max(1, Math.min(combo, 5))}</span>
        <span className="pill">{points} pts</span>
      </div>
      <div className="card p-5">
        <div className="mb-2 text-xs text-muted">
          {tr('Question', 'Question')} {i + 1} / {questions.length}
        </div>
        <Markdown src={q.q} className="text-lg" />
        {q.code && <CodeBlock code={q.code} className="mt-2" />}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {q.choices.map((c, k) => (
            <button
              key={k}
              onClick={() => choose(k)}
              className={`btn justify-start text-left font-mono text-sm ${
                picked !== null && k === q.answer ? 'border-ok bg-ok/20' : picked === k ? 'border-ko bg-ko/20' : ''
              }`}
            >
              <span className="kbd">{'ABCDEF'[k]}</span> {c}
            </button>
          ))}
        </div>
        {picked !== null && picked !== q.answer && (
          <div className="mt-3 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
            {q.explain ? <Markdown src={q.explain} /> : tr('Bonne réponse en vert.', 'Right answer in green.')}
            <button className="btn btn-primary mt-2" onClick={next} autoFocus>
              {tr('Suivant', 'Next')} ▶
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Wordle: guess the colours */

const NEXT: Record<Tile, Tile> = { grey: 'yellow', yellow: 'green', green: 'grey' }
export const TILE_BG: Record<Tile, string> = { green: 'var(--tile-green, #538d4e)', yellow: 'var(--tile-yellow, #c9b458)', grey: 'var(--tile-grey, #3a3a3c)' }

export function ColorTilesGame({ session }: { session: Session }) {
  const level = session.level as ColorTilesLevel
  const tr = useTr()
  const settings = useSettings()
  const bump = useStore((s) => s.bump)
  const [round, setRound] = useState(0)
  const r = level.rounds[round]
  const [tiles, setTiles] = useState<Tile[]>(() => Array.from({ length: r.guess.length }, () => 'grey'))
  const [checked, setChecked] = useState<boolean[] | null>(null)
  const truth = useMemo(() => evaluateGuess(r.guess, r.secret), [r])
  const hasDup = (w: string) => new Set(w).size < w.length
  const bg = (t: Tile) => (settings.colorblind ? { green: '#f5793a', yellow: '#85c0f9', grey: '#3a3a3c' }[t] : TILE_BG[t])

  const validate = () => {
    const ok = tiles.map((t, i) => t === truth[i])
    setChecked(ok)
    if (ok.every(Boolean)) {
      sfx.ok()
      if (hasDup(r.guess) || hasDup(r.secret)) bump('dup_letters')
      setTimeout(() => {
        if (round + 1 >= level.rounds.length) session.complete()
        else {
          const nr = level.rounds[round + 1]
          setRound(round + 1)
          setTiles(Array.from({ length: nr.guess.length }, () => 'grey'))
          setChecked(null)
        }
      }, 900)
    } else session.fail(['wordle_colors'])
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card p-4">{session.statement}</div>
      <div className="card p-5 text-center">
        <div className="text-xs text-muted">
          {tr('Manche', 'Round')} {round + 1} / {level.rounds.length}
        </div>
        <div className="mt-2 font-mono text-lg">
          secret = <b className="text-accent2">"{r.secret}"</b> · guess = <b className="text-gold">"{r.guess}"</b>
        </div>
        {r.note && <div className="mt-1 text-sm text-muted">{r.note}</div>}
        <div className="mt-4 flex justify-center gap-2">
          {r.guess.split('').map((ch, i) => (
            <button
              key={i}
              onClick={() => {
                setChecked(null)
                setTiles(tiles.map((t, k) => (k === i ? NEXT[t] : t)))
                sfx.flip()
              }}
              className={`flex h-14 w-14 items-center justify-center rounded-lg border-2 font-display text-2xl font-bold uppercase text-white transition sm:h-16 sm:w-16 ${checked && !checked[i] ? 'shake border-ko' : 'border-transparent'}`}
              style={{ background: bg(tiles[i]) }}
              aria-label={`${ch} : ${tiles[i]}`}
            >
              {ch}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted">{tr('Clique sur une case pour changer sa couleur : gris → jaune → vert.', 'Click a tile to change its colour: grey → yellow → green.')}</div>
        <button className="btn btn-primary mt-4" onClick={validate}>
          ✓ {tr('Valider les couleurs', 'Check colours')}
        </button>
        {checked && !checked.every(Boolean) && (
          <div className="mt-3 text-sm text-ko">
            {tr('Les cases entourées de rouge sont fausses. Pense à compter les lettres disponibles !', 'Red-framed tiles are wrong. Count the available letters!')}
          </div>
        )}
      </div>
      <div className="card p-4">{session.hintPanel}</div>
    </div>
  )
}
