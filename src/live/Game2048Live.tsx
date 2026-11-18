import { useCallback, useEffect, useRef, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, resolveFiles, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'
import { RunConsole, useInteractiveRun } from '../components/RunConsole'
import { useStore } from '../store/store'
import { sfx } from '../lib/sound'
import { celebrate } from '../lib/confetti'
import { bossFile } from '../content/variants'

type State = { grid: number[][]; score: number; game_over: boolean; size: number }
const KEYS: Record<string, string> = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  q: 'left', d: 'right', z: 'up', s: 'down', a: 'left', w: 'up',
}
const COLORS: Record<number, [string, string]> = {
  0: ['#1d2346', '#1d2346'], 2: ['#eee4da', '#3c3a32'], 4: ['#ede0c8', '#3c3a32'], 8: ['#f2b179', '#fff'], 16: ['#f59563', '#fff'],
  32: ['#f67c5f', '#fff'], 64: ['#f65e3b', '#fff'], 128: ['#edcf72', '#fff'], 256: ['#edcc61', '#fff'], 512: ['#edc850', '#fff'],
  1024: ['#edc53f', '#fff'], 2048: ['#edc22e', '#fff'],
}

/** 2048 powered by the student's create_game_state / add_random_tile / play_move. */
export default function Game2048Live({ ns, level }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const [state, setState] = useState<State | null>(null)
  const [best, setBest] = useState(0)
  const [err, setErr] = useState<PyError | null>(null)
  const busy = useRef(false)
  const touch = useRef<[number, number] | null>(null)
  const consoleRun = useInteractiveRun()

  const start = useCallback(async () => {
    const r = await pyCall<State>('__S', { ns, exec: '__S = add_random_tile(add_random_tile(create_game_state(4)))' })
    if (r.ok) setState(r.value!)
    else setErr(r.error ?? null)
  }, [ns])

  useEffect(() => {
    void start()
  }, [start])

  const play = useCallback(
    async (dir: string) => {
      if (busy.current || !state || state.game_over) return
      busy.current = true
      const r = await pyCall<State>('__S', { ns, exec: `__S = play_move(__S, ${JSON.stringify(dir)})` })
      busy.current = false
      if (!r.ok) return setErr(r.error ?? null)
      const s = r.value!
      if (s.score > state.score) sfx.combo(Math.log2(Math.max(2, s.score - state.score)))
      else sfx.tick()
      setState(s)
      setBest((b) => Math.max(b, s.score))
      const top = Math.max(...s.grid.flat())
      if (top >= 2048 && Math.max(...state.grid.flat()) < 2048) {
        celebrate(true)
        useStore.getState().bump('reached_2048')
      }
    },
    [ns, state],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.closest?.('.cm-editor')) return
      const dir = KEYS[e.key]
      if (dir) {
        e.preventDefault()
        void play(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [play])

  if (err) return <ErrorCard error={err} />
  if (!state) return <div className="text-center text-muted">…</div>
  const n = state.grid.length
  return (
    <div className="mx-auto max-w-md space-y-3">
      <div className="flex items-center justify-between">
        <div className="pill text-lg">Score {state.score}</div>
        <div className="pill">Record {best}</div>
        <button className="btn text-sm" onClick={start}>
          ↺ {tr('Nouvelle partie', 'New game')}
        </button>
      </div>
      <div
        className="relative grid touch-none gap-2 rounded-2xl bg-[#2a2f55] p-2"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        onTouchStart={(e) => (touch.current = [e.touches[0].clientX, e.touches[0].clientY])}
        onTouchEnd={(e) => {
          if (!touch.current) return
          const dx = e.changedTouches[0].clientX - touch.current[0]
          const dy = e.changedTouches[0].clientY - touch.current[1]
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 30) void play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
          touch.current = null
        }}
        role="grid"
        aria-label="2048"
      >
        {state.grid.flat().map((v, i) => {
          const [bg, fg] = COLORS[v] ?? ['#3c3a32', '#fff']
          return (
            <div key={i} className={`flex aspect-square items-center justify-center rounded-lg font-display font-bold ${v ? 'pop' : ''}`} style={{ background: bg, color: fg, fontSize: v >= 1024 ? '1.3rem' : v >= 128 ? '1.6rem' : '2rem' }}>
              {v || ''}
            </div>
          )
        })}
        {state.game_over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/60 text-white">
            <div className="font-display text-3xl">Game over</div>
            <button className="btn btn-primary mt-3" onClick={start}>
              ↺ {tr('Rejouer', 'Play again')}
            </button>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-muted">{tr('Flèches, ZQSD ou WASD (ou glisse sur mobile). Chaque coup appelle ta fonction play_move.', 'Arrows, ZQSD or WASD (or swipe). Each move calls your play_move.')}</p>
      <details className="card p-3">
        <summary className="cursor-pointer text-sm font-semibold">🖥️ {tr('Version console : ton game_loop avec readchar_lite et rich_lite', 'Console version: your game_loop with readchar_lite and rich_lite')}</summary>
        <button
          className="btn mt-2"
          onClick={async () => {
            const code = useStore.getState().profile().drafts[level.id] ?? bossFile(level, 'solution')
            void consoleRun.start({ code, files: await resolveFiles(level.files) })
          }}
        >
          ▶ game_loop()
        </button>
        <div className="mt-2">
          <RunConsole run={consoleRun} />
        </div>
      </details>
    </div>
  )
}
