import { useEffect, useRef, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { pyCall, type PyError } from '../engine/api'
import { useTr } from '../i18n'
import { ErrorCard } from '../components/ErrorCard'

const W = 640
const H = 400
type Bird = [number, number, number, number]

/** The flock flies with the student's update / flee_hunter, frame after frame. */
export default function BoidsLive({ ns }: { ns: string; level: BossLevel }) {
  const tr = useTr()
  const ref = useRef<HTMLCanvasElement>(null)
  const hunter = useRef<[number, number] | null>(null)
  const [params, setParams] = useState({ w_sep: 0.05, w_ali: 0.08, w_coh: 0.005, radius: 60, min_dist: 20, max_speed: 3 })
  const [predator, setPredator] = useState(true)
  const [running, setRunning] = useState(true)
  const [err, setErr] = useState<PyError | null>(null)
  const [count, setCount] = useState(40)
  const [fps, setFps] = useState(0)
  const ready = useRef(false)

  const reset = async () => {
    ready.current = false
    const p = JSON.stringify(params).replace(/true/g, 'True')
    const r = await pyCall('len(__B)', {
      ns,
      exec: `import random as __r\n__P = ${p}\n__B = [create_boid(__r.uniform(0, ${W}), __r.uniform(0, ${H}), __r.uniform(-2, 2), __r.uniform(-2, 2)) for _ in range(${count})]`,
    })
    if (!r.ok) setErr(r.error ?? null)
    else ready.current = true
  }

  useEffect(() => {
    void reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  useEffect(() => {
    if (!ready.current) return
    void pyCall('None', { ns, exec: `__P.update(${JSON.stringify(params)})` })
  }, [params, ns])

  useEffect(() => {
    if (!running) return
    let alive = true
    let frames = 0
    const t0 = performance.now()
    const loop = async () => {
      while (alive) {
        if (!ready.current) {
          await new Promise((r) => setTimeout(r, 100))
          continue
        }
        const h = predator && hunter.current ? `(${hunter.current[0]}, ${hunter.current[1]})` : 'None'
        const r = await pyCall<Bird[]>("[(b['pos'][0], b['pos'][1], b['vel'][0], b['vel'][1]) for b in __B]", {
          ns,
          exec: `__B = [update(b, __B, __P, ${W}, ${H}) for b in __B]\n__h = ${h}\nif __h is not None:\n    __B = [{'pos': b['pos'], 'vel': v_limit(v_add(b['vel'], v_mul(flee_hunter(b, __h, 90), 0.08)), __P['max_speed'] * 1.6)} for b in __B]`,
          timeoutMs: 3000,
        })
        if (!alive) break
        if (!r.ok) {
          setErr(r.error ?? null)
          setRunning(false)
          break
        }
        const ctx = ref.current?.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#0d1021'
          ctx.fillRect(0, 0, W, H)
          for (const [x, y, vx, vy] of r.value!) {
            const a = Math.atan2(vy, vx)
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(a)
            ctx.fillStyle = '#39d0d8'
            ctx.beginPath()
            ctx.moveTo(8, 0)
            ctx.lineTo(-5, 4)
            ctx.lineTo(-5, -4)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
          }
          if (predator && hunter.current) {
            ctx.fillStyle = '#ff5d73'
            ctx.font = '22px sans-serif'
            ctx.fillText('🦅', hunter.current[0] - 11, hunter.current[1] + 8)
          }
        }
        frames++
        setFps(Math.round((frames * 1000) / (performance.now() - t0)))
        await new Promise((res) => setTimeout(res, 16))
      }
    }
    void loop()
    return () => {
      alive = false
    }
  }, [running, predator, ns])

  const slider = (key: keyof typeof params, label: string, min: number, max: number, step: number) => (
    <label key={key} className="text-xs">
      <span className="flex justify-between">
        <span>{label}</span>
        <span className="font-mono text-accent2">{params[key]}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={params[key]} onChange={(e) => setParams({ ...params, [key]: Number(e.target.value) })} className="w-full accent-[var(--accent)]" />
    </label>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {err && <ErrorCard error={err} />}
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="w-full cursor-crosshair rounded-xl border border-line"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          hunter.current = [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]
        }}
        onMouseLeave={() => (hunter.current = null)}
        aria-label="nuée"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {slider('w_sep', tr('séparation', 'separation'), 0, 0.3, 0.01)}
        {slider('w_ali', tr('alignement', 'alignment'), 0, 0.3, 0.01)}
        {slider('w_coh', tr('cohésion', 'cohesion'), 0, 0.03, 0.001)}
        {slider('radius', tr('rayon de vision', 'vision radius'), 10, 150, 5)}
        {slider('min_dist', tr('distance minimale', 'minimal distance'), 5, 60, 1)}
        {slider('max_speed', tr('vitesse max', 'max speed'), 1, 8, 0.5)}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button className="btn" onClick={() => setRunning(!running)}>
          {running ? '⏸' : '▶'}
        </button>
        <button className="btn" onClick={reset}>
          ↺ {tr('Nouvelle nuée', 'New flock')}
        </button>
        <label className="pill">
          <input type="checkbox" checked={predator} onChange={(e) => setPredator(e.target.checked)} className="mr-1" />
          🦅 {tr('prédateur = ta souris', 'predator = your mouse')}
        </label>
        <select className="rounded-lg border border-line bg-bg2 px-2 py-1" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[20, 40, 60].map((n) => (
            <option key={n} value={n}>
              {n} {tr('oiseaux', 'birds')}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted">{fps} fps</span>
      </div>
      <p className="text-xs text-muted">{tr('Chaque image appelle ta fonction update sur chaque oiseau. Mets la cohésion à 0 : la nuée se disperse. Mets la séparation à 0 : les oiseaux s’empilent.', 'Each frame calls your update on every bird. Set cohesion to 0: the flock scatters. Set separation to 0: birds pile up.')}</p>
    </div>
  )
}
