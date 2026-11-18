import { useCallback, useEffect, useRef, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'
import { sfx } from '../lib/sound'

type State = { snake: [number, number][]; direction: string; food: [number, number] | null; score: number; over: boolean; width: number; height: number }
const W = 20
const H = 14
const S = 24
const KEYS: Record<string, string> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', q: 'left', d: 'right', z: 'up', s: 'down', a: 'left', w: 'up' }

/** Snake driven by the student's move_snake / change_direction / place_food. */
export default function SnakeLive({ ns }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const ref = useRef<HTMLCanvasElement>(null)
  const [state, setState] = useState<State | null>(null)
  const [running, setRunning] = useState(false)
  const [err, setErr] = useState<PyError | null>(null)
  const pending = useRef<string | null>(null)

  const start = useCallback(async () => {
    const r = await pyCall<State>('__Z', { ns, exec: `__Z = place_food(create_snake_state(${W}, ${H}))` })
    if (!r.ok) return setErr(r.error ?? null)
    setState(r.value!)
    setRunning(true)
  }, [ns])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = KEYS[e.key]
      if (d && running) {
        e.preventDefault()
        pending.current = d
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [running])

  useEffect(() => {
    if (!running) return
    let alive = true
    const loop = async () => {
      while (alive) {
        const d = pending.current
        pending.current = null
        const exec = (d ? `__Z = change_direction(__Z, ${JSON.stringify(d)})\n` : '') + '__Z = move_snake(__Z)'
        const r = await pyCall<State>('__Z', { ns, exec })
        if (!alive) break
        if (!r.ok) {
          setErr(r.error ?? null)
          setRunning(false)
          break
        }
        setState((old) => {
          if (old && r.value!.score > old.score) sfx.coin()
          return r.value!
        })
        if (r.value!.over) {
          sfx.ko()
          setRunning(false)
          break
        }
        await new Promise((res) => setTimeout(res, 140))
      }
    }
    void loop()
    return () => {
      alive = false
    }
  }, [running, ns])

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx || !state) return
    ctx.fillStyle = '#0d1021'
    ctx.fillRect(0, 0, W * S, H * S)
    if (state.food) {
      ctx.fillStyle = '#ff5d73'
      ctx.beginPath()
      ctx.arc(state.food[0] * S + S / 2, state.food[1] * S + S / 2, S / 2.6, 0, Math.PI * 2)
      ctx.fill()
    }
    state.snake.forEach(([x, y], i) => {
      ctx.fillStyle = i === 0 ? '#3ddc84' : '#2a9d5c'
      ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2)
    })
  }, [state])

  return (
    <div className="mx-auto max-w-xl space-y-3 text-center">
      {err && <ErrorCard error={err} />}
      <div className="flex items-center justify-between">
        <span className="pill text-lg">🍎 {state?.score ?? 0}</span>
        <button className="btn btn-primary" onClick={start} disabled={running}>
          ▶ {state?.over ? tr('Rejouer', 'Play again') : tr('Jouer', 'Play')}
        </button>
      </div>
      <canvas ref={ref} width={W * S} height={H * S} className="w-full rounded-xl border border-line" aria-label="snake" />
      {state?.over && <div className="font-display text-2xl">💀 Game over</div>}
      <p className="text-xs text-muted">{tr('Flèches, ZQSD ou WASD. Chaque tick appelle ta fonction move_snake.', 'Arrows, ZQSD or WASD. Each tick calls your move_snake.')}</p>
    </div>
  )
}
