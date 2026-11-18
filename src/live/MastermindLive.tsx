import { useCallback, useEffect, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'
import { sfx } from '../lib/sound'
import { celebrate } from '../lib/confetti'

type State = { secret: string; guesses: string[]; results: [number, number][]; max_attempts: number; won: boolean; over: boolean }
const PALETTE: Record<string, string> = { R: '#e5484d', G: '#30a46c', B: '#3e63dd', Y: '#f5d90a', O: '#f76b15', P: '#8e4ec6' }

function Peg({ c, size = 'h-8 w-8' }: { c?: string; size?: string }) {
  return <span className={`inline-block rounded-full border-2 border-black/30 ${size}`} style={{ background: c ? PALETTE[c] : 'var(--panel-2)' }} aria-label={c ?? 'vide'} />
}

export default function MastermindLive({ ns }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const [state, setState] = useState<State | null>(null)
  const [cur, setCur] = useState('')
  const [err, setErr] = useState<PyError | null>(null)
  const [msg, setMsg] = useState('')

  const start = useCallback(async () => {
    setErr(null)
    setCur('')
    setMsg('')
    const r = await pyCall<State>('__S', { ns, exec: '__S = create_game_state(random_code())' })
    if (r.ok) setState(r.value!)
    else setErr(r.error ?? null)
  }, [ns])

  useEffect(() => {
    void start()
  }, [start])

  const submit = async () => {
    if (!state || state.over) return
    const r = await pyCall<{ v: [boolean, string]; s: State }>("{'v': __v, 's': __S}", {
      ns,
      exec: `__g = normalize_code(${JSON.stringify(cur)})\n__v = is_valid_code(__g)\nif __v[0]:\n    play_guess(__S, __g)`,
    })
    if (!r.ok) return setErr(r.error ?? null)
    if (!r.value!.v[0]) {
      setMsg(r.value!.v[1])
      sfx.ko()
      return
    }
    setMsg('')
    setState(r.value!.s)
    setCur('')
    sfx.flip()
    if (r.value!.s.won) {
      sfx.win()
      celebrate()
    } else if (r.value!.s.over) sfx.ko()
  }

  if (err) return <ErrorCard error={err} />
  if (!state) return <div className="text-center text-muted">…</div>
  return (
    <div className="mx-auto max-w-md space-y-3">
      <div className="space-y-1.5">
        {Array.from({ length: state.max_attempts }, (_, r) => {
          const g = state.guesses[r]
          const res = state.results[r]
          const editing = r === state.guesses.length && !state.over
          const code = g ?? (editing ? cur : '')
          return (
            <div key={r} className={`flex items-center gap-3 rounded-xl px-3 py-1.5 ${editing ? 'bg-accent/10 ring-1 ring-accent' : ''}`}>
              <span className="w-5 text-right font-mono text-xs text-muted">{r + 1}</span>
              <div className="flex gap-1.5">
                {Array.from({ length: 4 }, (_, i) => (
                  <Peg key={i} c={code[i]} />
                ))}
              </div>
              {res && (
                <div className="grid grid-cols-2 gap-0.5" aria-label={`${res[0]} bien placés, ${res[1]} mal placés`}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <span key={i} className={`inline-block h-3 w-3 rounded-full border border-line ${i < res[0] ? 'bg-fg' : i < res[0] + res[1] ? 'bg-transparent ring-2 ring-fg' : 'bg-panel2'}`} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {!state.over ? (
        <div className="space-y-2">
          <div className="flex justify-center gap-2">
            {Object.keys(PALETTE).map((c) => (
              <button key={c} onClick={() => setCur((x) => (x.length < 4 ? x + c : x))} aria-label={c}>
                <Peg c={c} size="h-10 w-10" />
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-2">
            <button className="btn" onClick={() => setCur((x) => x.slice(0, -1))}>
              ⌫
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={cur.length !== 4}>
              ✓ {tr('Proposer', 'Submit')}
            </button>
          </div>
          {msg && <div className="text-center text-sm text-warn">{msg}</div>}
        </div>
      ) : (
        <div className="card p-4 text-center">
          <div className="font-display text-2xl">{state.won ? '🔓 ' + tr('Code cassé !', 'Code broken!') : '🔒 ' + tr('Perdu…', 'Lost…')}</div>
          <div className="mt-2 flex justify-center gap-1.5">
            {state.secret.split('').map((c, i) => (
              <Peg key={i} c={c} />
            ))}
          </div>
          <button className="btn btn-primary mt-3" onClick={start}>
            ↺ {tr('Rejouer', 'Play again')}
          </button>
        </div>
      )}
      <p className="text-center text-xs text-muted">{tr('● bien placé · ○ mal placé — calculés par ta fonction evaluate().', '● right place · ○ wrong place — computed by your evaluate().')}</p>
    </div>
  )
}
