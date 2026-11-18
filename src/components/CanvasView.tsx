import { useEffect, useRef } from 'react'
import type { CanvasCmd } from '../engine/api'

export function drawFrame(ctx: CanvasRenderingContext2D, frame: CanvasCmd[], width: number, height: number) {
  for (const c of frame) {
    const kind = c[0]
    if (kind === 'clear') {
      ctx.fillStyle = c[1] as string
      ctx.fillRect(0, 0, width, height)
    } else if (kind === 'circle') {
      const [, x, y, r, color, fill] = c as [string, number, number, number, string, boolean]
      ctx.beginPath()
      ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2)
      if (fill) {
        ctx.fillStyle = color
        ctx.fill()
      } else {
        ctx.strokeStyle = color
        ctx.stroke()
      }
    } else if (kind === 'line') {
      const [, x1, y1, x2, y2, color, w] = c as [string, number, number, number, number, string, number]
      ctx.strokeStyle = color
      ctx.lineWidth = w
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.lineWidth = 1
    } else if (kind === 'polygon') {
      const [, pts, color, fill] = c as [string, number[][], string, boolean]
      if (!pts.length) continue
      ctx.beginPath()
      ctx.moveTo(pts[0][0], pts[0][1])
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1])
      ctx.closePath()
      if (fill) {
        ctx.fillStyle = color
        ctx.fill()
      } else {
        ctx.strokeStyle = color
        ctx.stroke()
      }
    } else if (kind === 'rect') {
      const [, x, y, w, h, color, fill] = c as [string, number, number, number, number, string, boolean]
      if (fill) {
        ctx.fillStyle = color
        ctx.fillRect(x, y, w, h)
      } else {
        ctx.strokeStyle = color
        ctx.strokeRect(x, y, w, h)
      }
    } else if (kind === 'text') {
      const [, x, y, s, color, size] = c as [string, number, number, string, string, number]
      ctx.fillStyle = color
      ctx.font = `${size}px "JetBrains Mono", monospace`
      ctx.fillText(s, x, y)
    }
  }
}

export function CanvasView({ width, height, frame, className = '' }: { width: number; height: number; frame: CanvasCmd[]; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    drawFrame(ctx, frame, width, height)
  }, [frame, width, height])
  return <canvas ref={ref} width={width} height={height} className={`max-w-full rounded-xl border border-line bg-bg2 ${className}`} />
}
