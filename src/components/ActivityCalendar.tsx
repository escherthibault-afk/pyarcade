import { addDays, dayKey } from '../lib/dates'

/** GitHub-like grid of active days. */
export function ActivityCalendar({ days, weeks = 20 }: { days: Record<string, number>; weeks?: number }) {
  const today = new Date()
  const offset = (today.getDay() + 6) % 7 // Monday = 0
  const start = addDays(dayKey(today), -(weeks - 1) * 7 - offset)
  const cols: string[][] = []
  for (let w = 0; w < weeks; w++) cols.push(Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  const todayKey = dayKey(today)
  const shade = (n: number) => (n <= 0 ? 'var(--panel-2)' : n < 2 ? 'color-mix(in srgb, var(--ok) 35%, var(--panel-2))' : n < 5 ? 'color-mix(in srgb, var(--ok) 65%, var(--panel-2))' : 'var(--ok)')
  return (
    <div className="mt-3 flex gap-[3px] overflow-x-auto" aria-label="calendrier d’activité">
      {cols.map((col, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {col.map((k) => (
            <div key={k} title={`${k} : ${days[k] ?? 0}`} className={`h-[11px] w-[11px] rounded-[3px] ${k === todayKey ? 'ring-1 ring-accent2' : ''}`} style={{ background: k > todayKey ? 'transparent' : shade(days[k] ?? 0) }} />
          ))}
        </div>
      ))}
    </div>
  )
}
