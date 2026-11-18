import { ALL_LEVELS, LEVELS, WORLDS, WORLD_LEVELS, getWorld, isLevelUnlocked, worldPath } from '../content'
import type { Level } from '../content/schema'
import type { Profile } from '../store/store'
import { dateSeed, dayKey, seededRandom, weekKey } from './dates'

/** Where "Play" takes you: the last opened level if unfinished, else the first unlocked unfinished level. */
export function continueTarget(p: Profile, unlockAll = false): Level | null {
  if (p.lastLevelId && LEVELS[p.lastLevelId] && !p.levels[p.lastLevelId]?.completed) return LEVELS[p.lastLevelId]
  for (const w of WORLDS) {
    if (w.id === 'wordle' || w.secret) continue
    for (const l of worldPath(w)) {
      if (l.type === 'boss') continue
      if (!p.levels[l.id]?.completed && isLevelUnlocked(p, l, unlockAll)) return l
    }
  }
  return null
}

const DAILY_TYPES = new Set(['code_fill', 'bug_hunt', 'predict_output', 'parsons', 'quiz', 'trace', 'truth_table', 'golf', 'refactor'])

/** Same level for everyone on a given day (seed = date). */
export function dailyLevel(key: string = dayKey()): Level | null {
  const pool = ALL_LEVELS.filter((l) => typeof l.world === 'number' && DAILY_TYPES.has(l.type) && l.difficulty >= 2).sort((a, b) => a.id.localeCompare(b.id))
  if (!pool.length) return null
  const rnd = seededRandom(dateSeed(key))
  return pool[Math.floor(rnd() * pool.length)]
}

export function dueReviews(p: Profile) {
  const today = dayKey()
  return p.reviews.filter((r) => r.due <= today && LEVELS[r.levelId])
}

/** "Ready for the Wordle assessment": express track + guided boss + exam. */
export function wordleReadiness(p: Profile): number {
  const track = WORLD_LEVELS['wordle'] ?? []
  const done = track.filter((l) => p.levels[l.id]?.completed).length
  const guided = LEVELS['boss-wordle-guided']
  const steps = guided && guided.type === 'boss' ? guided.steps.length : 1
  const validated = p.bosses['boss-wordle-guided']?.validated.length ?? 0
  const exam = Math.max(p.bosses['boss-wordle-exam']?.bestScore ?? 0, 0)
  const score = 0.55 * (track.length ? done / track.length : 0) + 0.3 * Math.min(1, validated / steps) + 0.15 * Math.min(1, exam / 14)
  return Math.round(score * 100)
}

export type Quest = { id: string; fr: string; en: string; key: string; target: number; reward: number }
const QUESTS: Quest[] = [
  { id: 'bugs5', fr: 'Résous 5 Chasses au bug', en: 'Solve 5 bug hunts', key: 'type:bug_hunt', target: 5, reward: 60 },
  { id: 'copy3', fr: 'Réussis 3 niveaux en mode copie', en: 'Clear 3 paper-mode levels', key: 'type:copy', target: 3, reward: 80 },
  { id: 'speed', fr: 'Bats ton propre record en Speed Read', en: 'Beat your Speed Read record', key: 'speed_record', target: 1, reward: 40 },
  { id: 'lv10', fr: 'Réussis 10 niveaux', en: 'Clear 10 levels', key: 'levels', target: 10, reward: 50 },
  { id: 'stars5', fr: 'Obtiens 5 fois 3 étoiles', en: 'Get 3 stars 5 times', key: 'three_stars', target: 5, reward: 60 },
  { id: 'parsons4', fr: 'Termine 4 puzzles de Parsons', en: 'Finish 4 Parsons puzzles', key: 'type:parsons', target: 4, reward: 40 },
  { id: 'quiz3', fr: 'Termine 3 QCM éclair', en: 'Finish 3 flash quizzes', key: 'type:quiz', target: 3, reward: 40 },
  { id: 'predict5', fr: 'Devine 5 sorties de programme', en: 'Predict 5 outputs', key: 'type:predict_output', target: 5, reward: 50 },
  { id: 'code8', fr: 'Écris 8 fonctions en Code Fill', en: 'Write 8 Code Fill functions', key: 'type:code_fill', target: 8, reward: 70 },
]

export function weeklyQuests(week: string = weekKey()): Quest[] {
  const rnd = seededRandom(Number(week.replace(/\D/g, '')))
  const pool = [...QUESTS]
  const out: Quest[] = []
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0])
  return out
}

export function levelWorldTitle(l: Level) {
  const w = getWorld(l.world)
  return w ? `${w.emoji} ${w.title}` : ''
}

/** Mastery per radar branch, 0..1, from concept success/failure counts and completed levels. */
export const RADAR_BRANCHES = ['conditions', 'boucles', 'listes', 'dicts', 'grilles', 'fichiers', 'fonctions', 'hasard', 'débogage'] as const
export type Branch = (typeof RADAR_BRANCHES)[number]

export function branchOf(l: Level): Branch[] {
  const out = new Set<Branch>()
  const w = getWorld(l.world)
  const map: Record<string, Branch> = { conditions: 'conditions', boucles: 'boucles', listes: 'listes', dicts: 'dicts', grilles: 'grilles', fichiers: 'fichiers', fonctions: 'fonctions', hasard: 'hasard', bases: 'conditions' }
  if (w?.radar && map[w.radar]) out.add(map[w.radar])
  if (l.type === 'bug_hunt' || l.type === 'write_test') out.add('débogage')
  return [...out]
}

export function mastery(p: Profile): Record<Branch, number> {
  const res = Object.fromEntries(RADAR_BRANCHES.map((b) => [b, 0])) as Record<Branch, number>
  const tot = Object.fromEntries(RADAR_BRANCHES.map((b) => [b, 0])) as Record<Branch, number>
  for (const l of ALL_LEVELS) {
    if (l.type === 'boss' || l.world === 'secret') continue
    for (const b of branchOf(l)) {
      tot[b] += 3
      res[b] += p.levels[l.id]?.stars ?? 0
    }
  }
  for (const b of RADAR_BRANCHES) res[b] = tot[b] ? res[b] / tot[b] : 0
  return res
}

/** A training level for a weak branch: first unfinished (or lowest-star) level of that branch. */
export function trainingLevel(p: Profile, b: Branch): Level | null {
  const cands = ALL_LEVELS.filter((l) => l.type !== 'boss' && branchOf(l).includes(b))
  return cands.find((l) => !p.levels[l.id]?.completed) ?? cands.sort((x, y) => (p.levels[x.id]?.stars ?? 0) - (p.levels[y.id]?.stars ?? 0))[0] ?? null
}
