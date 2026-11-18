import { useEffect, useRef, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'

const W = 40
const H = 28
const S = 14
const PATTERNS: Record<string, [number, number][]> = {
  planeur: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  clignotant: [[0, 0], [1, 0], [2, 0]],
  'R-pentomino': [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
}

/** Conway's life with the student's step / population. Click cells to toggle them. */
export default function LifeLive({ ns }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const ref = useRef<HTMLCanvasElement>(null)
  const [grid, setGrid] = useState<number[][]>(() => Array.from({ length: H }, () => Array(W).fill(0)))
  const [running, setRunning] = useState(false)
  const [gen, setGen] = useState(0)
  const [pop, setPop] = useState(0)
  const [err, setErr] = useState<PyError | null>(null)
  const gridRef = useRef(grid)
  gridRef.current = grid

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#0d1021'
    ctx.fillRect(0, 0, W * S, H * S)
    grid.forEach((row, y) =>
      row.forEach((c, x) => {
        ctx.fillStyle = c ? '#ffd166' : '#161b36'
        ctx.fillRect(x * S, y * S, S - 1, S - 1)
      }),
    )
  }, [grid])

  useEffect(() => {
    if (!running) return
    let alive = true
    const loop = async () => {
      while (alive) {
        const r = await pyCall<{ g: number[][]; p: number }>("{'g': __L, 'p': population(__L)}", { ns, exec: `__L = step(${JSON.stringify(gridRef.current)})` })
        if (!alive) break
        if (!r.ok) {
          setErr(r.error ?? null)
          setRunning(false)
          break
        }
        setGrid(r.value!.g)
        setPop(r.value!.p)
        setGen((g) => g + 1)
        await new Promise((res) => setTimeout(res, 110))
      }
    }
    void loop()
    return () => {
      alive = false
    }
  }, [running, ns])

  const addPattern = (name: string) => {
    const g = grid.map((r) => [...r])
    const ox = Math.floor(W / 2) - 2 + Math.floor(Math.random() * 8) - 4
    const oy = Math.floor(H / 2) - 2 + Math.floor(Math.random() * 6) - 3
    for (const [x, y] of PATTERNS[name]) g[oy + y][ox + x] = 1
    setGrid(g)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {err && <ErrorCard error={err} />}
      <canvas
        ref={ref}
        width={W * S}
        height={H * S}
        className="w-full cursor-pointer rounded-xl border border-line"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const x = Math.floor(((e.clientX - r.left) / r.width) * W)
          const y = Math.floor(((e.clientY - r.top) / r.height) * H)
          setGrid(grid.map((row, yy) => row.map((c, xx) => (xx === x && yy === y ? 1 - c : c))))
        }}
        aria-label="jeu de la vie"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button className="btn btn-primary" onClick={() => setRunning(!running)}>
          {running ? '⏸' : '▶'} {running ? tr('Pause', 'Pause') : tr('Lancer', 'Run')}
        </button>
        <button className="btn" onClick={() => { setGrid(Array.from({ length: H }, () => Array(W).fill(0))); setGen(0) }}>
          🧹 {tr('Effacer', 'Clear')}
        </button>
        {Object.keys(PATTERNS).map((p) => (
          <button key={p} className="pill" onClick={() => addPattern(p)}>
            + {p}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted">
          {tr('génération', 'generation')} {gen} · population {pop}
        </span>
      </div>
      <p className="text-xs text-muted">{tr('Clique sur les cases pour les allumer. Chaque génération est calculée par ta fonction step.', 'Click cells to toggle them. Each generation is computed by your step function.')}</p>
    </div>
  )
}
