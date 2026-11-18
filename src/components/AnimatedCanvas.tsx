import { useEffect, useRef, useState } from 'react'
import { nextFrame, type CanvasCmd, type PyError } from '../engine/api'
import { drawFrame } from './CanvasView'
import { ErrorCard } from './ErrorCard'
import { useTr } from '../i18n'

/** Drives a canvas.on_frame(...) callback living in the Pyodide worker (~30 fps). */
export function AnimatedCanvas({ width, height, first }: { width: number; height: number; first: CanvasCmd[] }) {
  const tr = useTr()
  const ref = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(true)
  const [err, setErr] = useState<PyError | null>(null)
  const [fps, setFps] = useState(0)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx && first.length) drawFrame(ctx, first, width, height)
  }, [first, width, height])
  useEffect(() => {
    if (!running) return
    let alive = true
    let frames = 0
    const t0 = performance.now()
    const loop = async () => {
      while (alive) {
        const start = performance.now()
        const r = await nextFrame(1)
        if (!alive) break
        if (!r.ok) {
          setErr(r.error)
          setRunning(false)
          break
        }
        const ctx = ref.current?.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, width, height)
          drawFrame(ctx, r.frame, width, height)
        }
        frames++
        setFps(Math.round((frames * 1000) / (performance.now() - t0)))
        const wait = 33 - (performance.now() - start)
        if (wait > 0) await new Promise((res) => setTimeout(res, wait))
      }
    }
    void loop()
    return () => {
      alive = false
    }
  }, [running, width, height])
  return (
    <div className="space-y-2">
      <canvas ref={ref} width={width} height={height} className="max-w-full rounded-xl border border-line bg-bg2" />
      <div className="flex items-center gap-2 text-xs text-muted">
        <button className="btn px-2 py-1 text-xs" onClick={() => setRunning(!running)}>
          {running ? '⏸ ' + tr('Pause', 'Pause') : '▶ ' + tr('Reprendre', 'Resume')}
        </button>
        <span>{fps} fps</span>
      </div>
      {err && <ErrorCard error={err} />}
    </div>
  )
}
