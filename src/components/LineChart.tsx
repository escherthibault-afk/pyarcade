/** Minimal SVG line chart (no chart library needed). */
const COLORS = ['var(--accent-2)', 'var(--ko)', 'var(--ok)', 'var(--accent)', 'var(--gold)']

export function LineChart({ series, height = 180, yLabel }: { series: { name: string; values: number[] }[]; height?: number; yLabel?: string }) {
  const W = 560
  const H = height
  const pad = 30
  const all = series.flatMap((s) => s.values)
  if (!all.length) return null
  const max = Math.max(...all, 1)
  const min = Math.min(...all, 0)
  const n = Math.max(...series.map((s) => s.values.length))
  const x = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - pad - 10)
  const y = (v: number) => H - pad + 10 - ((v - min) / (max - min || 1)) * (H - pad - 10)
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 10}`} className="w-full" role="img" aria-label={series.map((s) => s.name).join(', ')}>
        <line x1={pad} y1={y(min)} x2={W - 10} y2={y(min)} stroke="var(--line)" />
        <line x1={pad} y1={10} x2={pad} y2={y(min)} stroke="var(--line)" />
        <text x={4} y={14} fontSize="10" fill="var(--muted)">{Number(max.toFixed(2))}</text>
        <text x={4} y={y(min)} fontSize="10" fill="var(--muted)">{Number(min.toFixed(2))}</text>
        {yLabel && <text x={pad + 4} y={20} fontSize="10" fill="var(--muted)">{yLabel}</text>}
        {series.map((s, k) => (
          <polyline key={s.name} fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth="2" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        ))}
      </svg>
      {series.length > 1 && (
        <figcaption className="flex flex-wrap gap-3 text-xs">
          {series.map((s, k) => (
            <span key={s.name} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded" style={{ background: COLORS[k % COLORS.length] }} /> {s.name}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  )
}
