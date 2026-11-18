import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { loadNamespace, pyCall, resolveFiles, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { useProfile, useSettings, useStore } from '../store/store'
import { ErrorCard } from '../components/ErrorCard'
import { RunConsole, useInteractiveRun } from '../components/RunConsole'
import { dateSeed, dayKey } from '../lib/dates'
import { sfx } from '../lib/sound'
import { celebrate } from '../lib/confetti'
import { awardBadges } from '../lib/badges'
import { bossFile } from '../content/variants'

type State = { secret: string; guesses: string[]; feedbacks: (string[] | string)[]; max_attempts: number; won: boolean; over: boolean }
type Kind = 'wordle' | 'motus'

const QWERTY = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const AZERTY = ['azertyuiop', 'qsdfghjklm', 'wxcvbn']

/** Maps whatever the student's feedback uses (green/G/+/O…) to a tile colour. */
function tileOf(sym: string | undefined): 'ok' | 'mid' | 'no' | 'empty' {
  if (sym === undefined) return 'empty'
  const s = String(sym).toLowerCase()
  if (['green', 'g', '+', 'o', 'ok'].includes(s)) return 'ok'
  if (['yellow', 'y', '?', 'mid'].includes(s)) return 'mid'
  return 'no'
}

function Tile({ ch, kind, delay, reveal, colorblind }: { ch: string; kind: 'ok' | 'mid' | 'no' | 'empty' | 'typing'; delay: number; reveal: boolean; colorblind: boolean }) {
  const bg =
    kind === 'ok' ? (colorblind ? '#f5793a' : '#3f9a4f') : kind === 'mid' ? (colorblind ? '#85c0f9' : '#c9a227') : kind === 'no' ? '#3b3f5c' : 'transparent'
  return (
    <div
      className={`flex aspect-square w-full max-w-[3.6rem] items-center justify-center rounded-lg border-2 font-display text-2xl font-bold uppercase sm:text-3xl ${reveal ? 'flip' : ''} ${
        kind === 'empty' ? 'border-line' : kind === 'typing' ? 'border-accent2 pop' : 'border-transparent text-white'
      }`}
      style={{ background: bg, animationDelay: `${delay}ms` }}
    >
      {ch}
    </div>
  )
}

export function WordGame({ ns, level, kind }: { ns: string; level: BossLevel; kind: Kind }) {
  const tr = useTr()
  const settings = useSettings()
  const profile = useProfile()
  const [mode, setMode] = useState<'free' | 'daily'>('free')
  const [state, setState] = useState<State | null>(null)
  const [kb, setKb] = useState<Record<string, string>>({})
  const [typed, setTyped] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState<PyError | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  const [lastRow, setLastRow] = useState(-1)
  const [histo, setHisto] = useState<string | null>(null)
  const [hard, setHard] = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const console_ = useInteractiveRun()
  const solverDone = profile.levels['wd-l21']?.completed
  const hardDone = profile.levels['wd-l20']?.completed
  const len = state?.secret.length ?? 5

  const start = useCallback(
    async (m: 'free' | 'daily') => {
      setBusy(true)
      setErr(null)
      setMsg('')
      setTyped('')
      setHisto(null)
      setSuggestion(null)
      const seed = m === 'daily' ? `random.seed(${dateSeed(dayKey())})\n` : ''
      const init =
        kind === 'wordle'
          ? `__W = load_words('words.txt')\n__SEC = load_words('secrets.txt') if __import__('os').path.exists('secrets.txt') else __W\n${seed}__S = create_game_state(choose_secret(__SEC))\n__K = {}`
          : `__W = load_words_by_length('mots.txt')\n${seed}__S = create_game_state(choose_secret(__W))\n__K = {}`
      // bonus functions written by the player in the express track
      const extra = [hardDone ? profile.drafts['wd-l20'] : '', solverDone ? profile.drafts['wd-l21'] : ''].filter(Boolean).join('\n\n')
      const r = await pyCall<{ state: State }>("{'state': __S}", { ns, exec: (extra ? extra + '\n' : '') + init, timeoutMs: 15000 })
      setBusy(false)
      if (!r.ok) return setErr(r.error ?? null)
      setState(r.value!.state)
      setKb({})
      setLastRow(-1)
    },
    [ns, kind, hardDone, solverDone, profile.drafts],
  )

  useEffect(() => {
    void start('free')
  }, [start])

  const submit = async () => {
    if (!state || state.over || busy) return
    setBusy(true)
    setMsg('')
    const guess = JSON.stringify(typed)
    const code =
      kind === 'wordle'
        ? `__g = normalize(${guess})\n__v = is_valid_guess(__g, __W)\nif __v[0] and __g in __S['guesses']:\n    __v = (False, 'Already tried.')\n` +
          (hard ? `if __v[0] and not respects_hints(__g, __S['guesses'], __S['feedbacks']):\n    __v = (False, 'Hard mode: reuse the hints you found.')\n` : '') +
          `if __v[0]:\n    __fb = play_guess(__S, __g)\n    update_keyboard(__K, __g, __fb)`
        : `__g = normalize(${guess})\n__v = is_valid_guess(__g, __S['secret'], __W)\nif __v[0]:\n    __fb = play_guess(__S, __g)\n    for __i, __c in enumerate(__g):\n        __r = {'O': 2, '?': 1}.get(__fb[__i], 0)\n        if __r >= {'O': 2, '?': 1, '.': 0}.get(__K.get(__c, '.'), 0):\n            __K[__c] = __fb[__i]`
    const r = await pyCall<{ valid: [boolean, string]; state: State; kb: Record<string, string> }>("{'valid': __v, 'state': __S, 'kb': __K}", { ns, exec: code, timeoutMs: 5000 })
    setBusy(false)
    if (!r.ok) return setErr(r.error ?? null)
    const v = r.value!
    if (!v.valid[0]) {
      setMsg(v.valid[1] || tr('Proposition refusée', 'Guess rejected'))
      setShake(true)
      sfx.ko()
      setTimeout(() => setShake(false), 450)
      return
    }
    setState(v.state)
    setKb(v.kb)
    setLastRow(v.state.guesses.length - 1)
    setTyped('')
    setSuggestion(null)
    v.state.guesses.length && sfx.flip()
    if (v.state.over) setTimeout(() => finish(v.state), 600 + 150 * len)
  }

  const finish = async (s: State) => {
    const n = s.guesses.length
    if (s.won) {
      sfx.win()
      celebrate(n <= 3)
      if (n === 2) useStore.getState().bump('wordle_in2')
    } else sfx.ko()
    if (kind !== 'wordle') return
    // statistics computed by the player's own update_stats
    const stats = profile.wordle
    const pyStats = `{'played': ${stats.played}, 'wins': ${stats.won}, 'current_streak': ${stats.streak}, 'best_streak': ${stats.best}, 'distribution': {${stats.dist
      .slice(1, s.max_attempts + 1)
      .map((x, i) => `${i + 1}: ${x}`)
      .join(', ')}}}`
    const r = await pyCall<{ played: number; wins: number; current_streak: number; best_streak: number; distribution: Record<string, number> }>(
      `update_stats(${pyStats}, ${s.won ? 'True' : 'False'}, ${n})`,
      { ns },
    )
    if (r.ok && r.value) {
      const st = r.value
      useStore.getState().update((p) => {
        const dist = [0, ...Array.from({ length: 7 }, (_, i) => Number(st.distribution[String(i + 1)] ?? 0))]
        p.wordle = { ...p.wordle, played: st.played, won: st.wins, streak: st.current_streak, best: st.best_streak, dist }
        if (mode === 'daily') p.wordle.daily[dayKey()] = { won: s.won, tries: n }
      })
    }
    awardBadges()
  }

  const histogram = async () => {
    const d = profile.wordle.dist.slice(1, 7)
    const r = await pyCall(
      'None',
      {
        ns,
        media: true,
        exec: `import matplotlib.pyplot as plt\nplt.figure(figsize=(5, 3))\nplt.bar(range(1, 7), ${JSON.stringify(d)}, color="#3f9a4f")\nplt.xlabel("essais")\nplt.ylabel("parties gagnées")\nplt.title("Distribution des essais")`,
        timeoutMs: 30000,
      },
    )
    if (r.images?.[0]) setHisto(r.images[0])
    else if (r.error) setErr(r.error)
  }

  const suggest = async () => {
    const r = await pyCall<string>(`best_guess(filter_all(__W, __S['guesses'], __S['feedbacks']))`, {
      ns,
      exec: `def filter_all(words, guesses, feedbacks):\n    c = words\n    for g, f in zip(guesses, feedbacks):\n        c = filter_candidates(c, g, f)\n    return c`,
      timeoutMs: 15000,
    })
    if (r.ok) setSuggestion(String(r.value))
    else setErr(r.error ?? null)
  }

  // physical keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state || state.over || (e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter') void submit()
      else if (e.key === 'Backspace') setTyped((t) => t.slice(0, -1))
      else if (/^[a-zA-Z]$/.test(e.key)) setTyped((t) => (t.length < len ? t + e.key.toLowerCase() : t))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rows = state?.max_attempts ?? 6
  const layout = kind === 'motus' ? AZERTY : QWERTY
  const firstLetter = kind === 'motus' && state ? state.secret[0] : ''
  const dailyDone = profile.wordle.daily[dayKey()]
  const maxDist = Math.max(1, ...profile.wordle.dist.slice(1, 7))

  const grid = useMemo(() => {
    if (!state) return []
    return Array.from({ length: rows }, (_, r) => {
      if (r < state.guesses.length) {
        const g = state.guesses[r]
        const fb = state.feedbacks[r]
        return g.split('').map((ch, i) => ({ ch, kind: tileOf(Array.isArray(fb) ? fb[i] : fb[i]), reveal: r === lastRow, delay: i * 150 }))
      }
      if (r === state.guesses.length && !state.over) {
        const shown = typed || (firstLetter ? firstLetter : '')
        return Array.from({ length: len }, (_, i) => ({ ch: shown[i] ?? (i === 0 && firstLetter ? firstLetter : ''), kind: (shown[i] ? 'typing' : 'empty') as 'typing' | 'empty', reveal: false, delay: 0 }))
      }
      return Array.from({ length: len }, () => ({ ch: '', kind: 'empty' as const, reveal: false, delay: 0 }))
    })
  }, [state, typed, rows, len, lastRow, firstLetter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button className={`pill ${mode === 'free' ? 'border-accent text-accent' : ''}`} onClick={() => { setMode('free'); void start('free') }}>
          🎲 {tr('Partie libre', 'Free game')}
        </button>
        {kind === 'wordle' && (
          <button className={`pill ${mode === 'daily' ? 'border-gold text-gold' : ''}`} onClick={() => { setMode('daily'); void start('daily') }}>
            📅 {tr('Mot du jour', 'Word of the day')} {dailyDone ? (dailyDone.won ? `✓ ${dailyDone.tries}/6` : '✗') : ''}
          </button>
        )}
        {kind === 'wordle' && hardDone && (
          <label className="pill cursor-pointer">
            <input type="checkbox" checked={hard} onChange={(e) => setHard(e.target.checked)} className="mr-1" />
            {tr('Mode difficile', 'Hard mode')}
          </label>
        )}
        {kind === 'wordle' && solverDone && state && !state.over && (
          <button className="pill" onClick={suggest}>
            🤖 {tr('Suggestion de ton solveur', 'Your solver’s suggestion')}
          </button>
        )}
      </div>
      {suggestion && <div className="text-center text-sm">🤖 {tr('Ton solveur propose', 'Your solver suggests')} : <b className="uppercase">{suggestion}</b></div>}
      {firstLetter && state && (
        <div className="text-center text-sm text-muted">
          {tr('Indices trouvés', 'Known letters')} : <span className="font-mono text-fg">{state.secret[0].toUpperCase()}</span> · {tr(`${len} lettres`, `${len} letters`)}
        </div>
      )}
      {err && <ErrorCard error={err} />}
      <div className="mx-auto grid max-w-[22rem] gap-1.5" role="grid" aria-label="grille">
        {grid.map((row, r) => (
          <div key={r} className={`grid gap-1.5 ${shake && state && r === state.guesses.length ? 'shake' : ''}`} style={{ gridTemplateColumns: `repeat(${len}, minmax(0, 1fr))` }} role="row">
            {row.map((t, i) => (
              <Tile key={i} ch={t.ch} kind={t.kind} delay={t.delay} reveal={t.reveal} colorblind={settings.colorblind} />
            ))}
          </div>
        ))}
      </div>
      <div className="min-h-6 text-center text-sm text-warn" aria-live="polite">
        {msg}
      </div>
      {state?.over && (
        <div className="card mx-auto max-w-md p-4 text-center">
          <div className="font-display text-2xl">{state.won ? '🎉 ' + tr('Trouvé !', 'Found it!') : '💀 ' + tr('Perdu…', 'Lost…')}</div>
          <div className="mt-1">
            {tr('Le mot était', 'The word was')} <b className="uppercase text-accent2">{state.secret}</b>
          </div>
          {kind === 'wordle' && (
            <div className="mt-3 text-left text-sm">
              <div className="flex justify-between text-muted">
                <span>{tr('Parties', 'Played')} {profile.wordle.played}</span>
                <span>
                  {tr('Victoires', 'Wins')} {profile.wordle.played ? Math.round((100 * profile.wordle.won) / profile.wordle.played) : 0} %
                </span>
                <span>{tr('Série', 'Streak')} {profile.wordle.streak}</span>
                <span>Record {profile.wordle.best}</span>
              </div>
              <div className="mt-2 space-y-1">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="w-3 font-mono">{n}</span>
                    <div className="h-4 rounded bg-ok/70 text-right text-xs leading-4 text-white" style={{ width: `${8 + (92 * profile.wordle.dist[n]) / maxDist}%` }}>
                      {profile.wordle.dist[n]}&nbsp;
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-xs text-muted">{tr('Statistiques calculées par ta fonction update_stats.', 'Stats computed by your update_stats function.')}</div>
              <button className="btn mt-2 text-sm" onClick={histogram}>
                📊 {tr('Histogramme matplotlib', 'matplotlib histogram')}
              </button>
              {histo && <img className="mt-2 rounded-lg bg-white" src={`data:image/png;base64,${histo}`} alt="histogramme" />}
            </div>
          )}
          <button className="btn btn-primary mt-3" onClick={() => start(mode)}>
            ↺ {tr('Rejouer', 'Play again')}
          </button>
        </div>
      )}
      {state && !state.over && (
        <div className="mx-auto max-w-lg space-y-1.5" aria-label={tr('clavier', 'keyboard')}>
          {layout.map((row, i) => (
            <div key={row} className="flex justify-center gap-1">
              {i === 2 && (
                <button className="btn px-2 py-3 text-xs" onClick={submit} disabled={busy}>
                  ↵
                </button>
              )}
              {row.split('').map((c) => {
                const k = tileOf(kb[c])
                const bg = kb[c] === undefined ? undefined : k === 'ok' ? (settings.colorblind ? '#f5793a' : '#3f9a4f') : k === 'mid' ? (settings.colorblind ? '#85c0f9' : '#c9a227') : '#2a2d45'
                return (
                  <button
                    key={c}
                    className="h-11 min-w-0 flex-1 rounded-md border border-line font-bold uppercase sm:max-w-[2.6rem]"
                    style={{ background: bg ?? 'var(--panel-2)', color: bg ? '#fff' : undefined, opacity: kb[c] && k === 'no' ? 0.55 : 1 }}
                    onClick={() => setTyped((t) => (t.length < len ? t + c : t))}
                  >
                    {c}
                  </button>
                )
              })}
              {i === 2 && (
                <button className="btn px-2 py-3 text-xs" onClick={() => setTyped((t) => t.slice(0, -1))} aria-label="effacer">
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <details className="card p-3">
        <summary className="cursor-pointer text-sm font-semibold">🖥️ {tr('Version console (rich_lite), comme en Python pur', 'Console version (rich_lite), like plain Python')}</summary>
        <p className="mt-2 text-sm text-muted">
          {tr('Lance ta fonction game_loop() telle quelle : c’est ce que tu obtiendras dans ton terminal avec rich.', 'Runs your game_loop() as is: what you will get in your terminal with rich.')}
        </p>
        <button
          className="btn mt-2"
          onClick={async () => {
            const files = await resolveFiles(level.files)
            const code = useStore.getState().profile().drafts[level.id] ?? bossFile(level, 'solution')
            void console_.start({ code, files })
          }}
        >
          ▶ game_loop()
        </button>
        <div className="mt-2">
          <RunConsole run={console_} />
        </div>
      </details>
    </div>
  )
}

export default function WordleLive({ ns, level }: { ns: string; level: BossLevel }) {
  return <WordGame ns={ns} level={level} kind="wordle" />
}

export function MotusLive({ ns, level }: { ns: string; level: BossLevel }) {
  return <WordGame ns={ns} level={level} kind="motus" />
}

/** Standalone page use (bonus games): load a code string then play. */
export function useLoadedNamespace(code: string | null, files: Record<string, string>, ns: string) {
  const [ok, setOk] = useState<boolean | null>(null)
  const [error, setError] = useState<PyError | null>(null)
  useEffect(() => {
    if (!code) return
    void loadNamespace(code, ns, { files }).then((r) => {
      setOk(r.ok)
      setError(r.error)
    })
  }, [code, files, ns])
  return { ok, error }
}
