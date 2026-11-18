/** Loads every YAML level (pre-parsed at build time), validates it and indexes worlds. */
import { LevelSchema, WorldsFile, type Level, type WorldMeta, type BossLevel } from './schema'
import worldsRaw from '../../content/worlds.yaml'
import type { Profile } from '../store/store'

const raw = import.meta.glob('/content/**/*.yaml', { eager: true, import: 'default' }) as Record<string, unknown>

export const contentErrors: string[] = []
const levels: Level[] = []
for (const [path, data] of Object.entries(raw)) {
  if (path.endsWith('/worlds.yaml')) continue
  const parsed = LevelSchema.safeParse(data)
  if (parsed.success) levels.push(parsed.data)
  else contentErrors.push(`${path}: ${parsed.error.issues.map((i) => i.path.join('.') + ' ' + i.message).join('; ')}`)
}
if (contentErrors.length) console.warn('[PyArcade] invalid levels:', contentErrors)

export const WORLDS: WorldMeta[] = WorldsFile.parse(worldsRaw).worlds
export const LEVELS: Record<string, Level> = Object.fromEntries(levels.map((l) => [l.id, l]))

const sortKey = (l: Level) => (l.order ?? 0) * 1000 + 0
function byOrder(a: Level, b: Level) {
  return sortKey(a) - sortKey(b) || a.id.localeCompare(b.id, 'en', { numeric: true })
}

/** Regular (non-boss) levels of a world, in play order. */
export const WORLD_LEVELS: Record<string, Level[]> = {}
for (const w of WORLDS) {
  WORLD_LEVELS[String(w.id)] = levels.filter((l) => String(l.world) === String(w.id) && l.type !== 'boss').sort(byOrder)
}

export function worldBosses(w: WorldMeta): BossLevel[] {
  return w.bosses.map((id) => LEVELS[id]).filter((l): l is BossLevel => !!l && l.type === 'boss')
}

export function getWorld(id: string | number) {
  return WORLDS.find((w) => String(w.id) === String(id))
}

export function getLevel(id: string): Level | undefined {
  return LEVELS[id]
}

/** Path order: every level then the bosses of the world. */
export function worldPath(w: WorldMeta): Level[] {
  return [...(WORLD_LEVELS[String(w.id)] ?? []), ...worldBosses(w)]
}

export function nextLevelId(id: string): string | null {
  const level = LEVELS[id]
  if (!level) return null
  const w = getWorld(level.world)
  if (!w) return null
  const path = worldPath(w)
  const i = path.findIndex((l) => l.id === id)
  if (i >= 0 && i + 1 < path.length) return path[i + 1].id
  // first level of the next numbered world
  if (typeof w.id === 'number') {
    const next = WORLDS.find((x) => x.id === (w.id as number) + 1)
    if (next) return worldPath(next)[0]?.id ?? null
  }
  return null
}

export function worldStars(p: Profile, w: WorldMeta) {
  const ls = WORLD_LEVELS[String(w.id)] ?? []
  const stars = ls.reduce((a, l) => a + (p.levels[l.id]?.stars ?? 0), 0)
  const done = ls.filter((l) => p.levels[l.id]?.completed).length
  return { stars, max: ls.length * 3, done, total: ls.length }
}

/** A numbered world opens once every regular level of the previous one is done. */
export function isWorldUnlocked(p: Profile, w: WorldMeta, unlockAll = false) {
  if (unlockAll) return true
  if (w.id === 'wordle' || w.id === 0) return true
  if (w.id === 'secret') return p.secret
  if (typeof w.id !== 'number') return true
  const prev = WORLDS.find((x) => x.id === (w.id as number) - 1)
  if (!prev) return true
  const s = worldStars(p, prev)
  return s.total > 0 && s.done >= s.total
}

export function isLevelUnlocked(p: Profile, level: Level, unlockAll = false) {
  if (unlockAll) return true
  const w = getWorld(level.world)
  if (!w || !isWorldUnlocked(p, w)) return false
  if (level.type === 'boss') {
    const s = worldStars(p, w)
    // twins and exams open after the guided boss of the same project
    if (level.variant !== 'guided') {
      const guided = worldBosses(w).find((b) => b.project === projectRoot(level.project) && b.variant === 'guided')
        ?? Object.values(LEVELS).find((b) => b.type === 'boss' && b.variant === 'guided' && b.project === projectRoot(level.project))
      if (guided && !p.bosses[guided.id]?.won) return false
    }
    return s.stars >= level.min_stars
  }
  const ls = WORLD_LEVELS[String(w.id)] ?? []
  const i = ls.findIndex((l) => l.id === level.id)
  return i <= 0 || !!p.levels[ls[i - 1].id]?.completed
}

/** "mastermind" twin belongs to "wordle", etc. */
export function projectRoot(project: string) {
  return project.split(':')[0]
}

export const ALL_LEVELS = levels
