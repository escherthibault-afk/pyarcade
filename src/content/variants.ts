import type { BossLevel, Level } from './schema'

/** Replace `{{NAME}}` placeholders everywhere in a level (exam replay variants). */
export function applyVariant<T extends Level>(level: T, vars: Record<string, string | number>): T {
  const json = JSON.stringify(level)
  const replaced = json.replace(/\{\{(\w+)\}\}/g, (m, name: string) =>
    name in vars ? JSON.stringify(String(vars[name])).slice(1, -1) : m,
  )
  return JSON.parse(replaced) as T
}

/** Variant 0 is the default when a boss has variants. */
export function bossVariant(level: BossLevel, index: number): BossLevel {
  if (!level.variants.length) return level
  const v = level.variants[Math.max(0, Math.min(index, level.variants.length - 1))]
  return applyVariant(level, v.vars)
}

/** Full file assembled from the header + every step (starter or solution). */
export function bossFile(level: BossLevel, which: 'starter_code' | 'solution'): string {
  const parts = [level.header_code.trimEnd(), ...level.steps.map((s) => s[which].trimEnd())].filter(Boolean)
  return parts.join('\n\n\n') + '\n'
}

/** Every test of a boss, tagged with the function it belongs to. */
export function bossTests(level: BossLevel) {
  return level.steps.flatMap((s) => [
    ...s.tests.visible.map((t) => ({ ...t, fn: s.fn, hidden: false })),
    ...s.tests.hidden.map((t) => ({ ...t, fn: s.fn, hidden: true })),
  ])
}
