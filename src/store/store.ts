/**
 * Global state (Zustand, persisted in localStorage).
 * Several local profiles on the same machine; each profile owns its progression.
 * Export/import goes through a ProgressRepository so a backend (Supabase…) can be plugged later.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { addDays, dayKey, daysBetween, weekKey } from '../lib/dates'
import { HINT_COST } from '../lib/xp'

export type LevelProgress = {
  completed: boolean
  stars: number
  attempts: number
  fails: number
  hintsUsed: number
  bestTimeMs?: number
  bestChars?: number
  firstDoneAt?: string
  lastAt?: string
}

export type BossProgress = {
  validated: string[]
  won: boolean
  bestScore?: number
  examStartedAt?: number
  errors: number
}

export type Review = { levelId: string; concept: string; due: string; stage: number }

export type Profile = {
  id: string
  name: string
  avatar: string
  createdAt: string
  xp: number
  coins: number
  levels: Record<string, LevelProgress>
  drafts: Record<string, string>
  activeDays: Record<string, number>
  streak: { current: number; best: number; lastDay: string | null; freezes: number; freezeWeek: string | null }
  badges: Record<string, string>
  counters: Record<string, number>
  concepts: Record<string, { ok: number; ko: number }>
  reviews: Review[]
  errors: Record<string, number>
  timeSpentMs: number
  lastLevelId?: string
  owned: string[]
  equipped: { editorTheme: string; robotSkin: string; avatar: string; title: string; sound: string }
  chests: Record<string, string>
  quests: { week: string; progress: Record<string, number>; claimed: string[] }
  bosses: Record<string, BossProgress>
  hearts: { count: number; updatedAt: number }
  daily: Record<string, string>
  wordle: { played: number; won: number; streak: number; best: number; dist: number[]; daily: Record<string, { won: boolean; tries: number }> }
  diploma?: { project: string; score: number; date: string }
  examsDone: string[]
  secret: boolean
}

export type Settings = {
  sound: boolean
  volume: number
  motion: 'auto' | 'reduce' | 'full'
  theme: 'dark' | 'light'
  lang: 'fr' | 'en'
  fontSize: number
  colorblind: boolean
  autoNext: boolean
  unlockAll: boolean
}

export const MAX_HEARTS = 3
export const HEART_REGEN_MS = 10 * 60 * 1000

export function newProfile(name: string, avatar = '🐍'): Profile {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name,
    avatar,
    createdAt: new Date().toISOString(),
    xp: 0,
    coins: 30,
    levels: {},
    drafts: {},
    activeDays: {},
    streak: { current: 0, best: 0, lastDay: null, freezes: 0, freezeWeek: null },
    badges: {},
    counters: {},
    concepts: {},
    reviews: [],
    errors: {},
    timeSpentMs: 0,
    owned: ['theme:arcade', 'robot:classic', 'avatar:🐍', 'sound:chip'],
    equipped: { editorTheme: 'arcade', robotSkin: 'classic', avatar: '🐍', title: '', sound: 'chip' },
    chests: {},
    quests: { week: weekKey(), progress: {}, claimed: [] },
    bosses: {},
    hearts: { count: MAX_HEARTS, updatedAt: Date.now() },
    daily: {},
    wordle: { played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0, 0, 0, 0], daily: {} },
    examsDone: [],
    secret: false,
  }
}

export type CompletionInput = {
  levelId: string
  stars: number
  xp: number
  coins: number
  concepts: string[]
  timeMs?: number
  chars?: number
  usedHints: number
  firstTry: boolean
  type: string
  daily?: boolean
  review?: boolean
}

export type CompletionOutcome = { newStars: number; xpGained: number; coinsGained: number; firstTime: boolean; leveledUp: boolean }

type State = {
  profiles: Record<string, Profile>
  currentId: string
  settings: Settings
  sessionStart: number
  /** Events used by the UI (badge toasts...). Not persisted. */
  toasts: { id: number; kind: 'badge' | 'info' | 'coins' | 'chest'; text: string; emoji?: string }[]

  profile(): Profile
  update(fn: (p: Profile) => void): void
  setSettings(patch: Partial<Settings>): void
  addProfile(name: string, avatar: string): void
  switchProfile(id: string): void
  deleteProfile(id: string): void
  saveDraft(levelId: string, code: string): void
  recordAttempt(levelId: string, ok: boolean, concepts: string[], errorTypes: string[]): void
  completeLevel(input: CompletionInput): CompletionOutcome
  buyHint(levelId: string, index: number): boolean
  bump(counter: string, by?: number): void
  toast(kind: State['toasts'][number]['kind'], text: string, emoji?: string): void
  dismissToast(id: number): void
  loseHeart(): void
  refillHearts(n?: number): void
  heartsNow(): number
}

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.5,
  motion: 'auto',
  theme: 'dark',
  lang: 'fr',
  fontSize: 15,
  colorblind: false,
  autoNext: true,
  unlockAll: false,
}

const first = newProfile('Joueur')
let toastId = 1

export const REVIEW_INTERVALS = [1, 3, 7, 14]

function touchStreak(p: Profile) {
  const today = dayKey()
  p.activeDays[today] = (p.activeDays[today] ?? 0) + 1
  const s = p.streak
  if (s.lastDay === today) return
  if (s.lastDay) {
    const gap = daysBetween(s.lastDay, today)
    if (gap === 1) s.current += 1
    else if (gap >= 2 && gap - 1 <= s.freezes) {
      s.freezes -= gap - 1
      s.current += 1
    } else s.current = 1
  } else s.current = 1
  s.lastDay = today
  s.best = Math.max(s.best, s.current)
  // one streak freeze per week, earned by playing 5 days in that week
  const wk = weekKey()
  const daysThisWeek = Object.keys(p.activeDays).filter((d) => weekKey(new Date(d + 'T12:00:00')) === wk).length
  if (daysThisWeek >= 5 && s.freezeWeek !== wk && s.freezes < 2) {
    s.freezes += 1
    s.freezeWeek = wk
  }
}

function questTick(p: Profile, key: string, by = 1) {
  const wk = weekKey()
  if (p.quests.week !== wk) p.quests = { week: wk, progress: {}, claimed: [] }
  p.quests.progress[key] = (p.quests.progress[key] ?? 0) + by
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profiles: { [first.id]: first },
      currentId: first.id,
      settings: DEFAULT_SETTINGS,
      sessionStart: Date.now(),
      toasts: [],

      profile() {
        const s = get()
        return s.profiles[s.currentId] ?? Object.values(s.profiles)[0]
      },

      update(fn) {
        set((s) => {
          const p = structuredClone(s.profiles[s.currentId])
          fn(p)
          return { profiles: { ...s.profiles, [p.id]: p } }
        })
      },

      setSettings(patch) {
        set((s) => ({ settings: { ...s.settings, ...patch } }))
      },

      addProfile(name, avatar) {
        const p = newProfile(name, avatar)
        p.equipped.avatar = avatar
        set((s) => ({ profiles: { ...s.profiles, [p.id]: p }, currentId: p.id }))
      },

      switchProfile(id) {
        if (get().profiles[id]) set({ currentId: id })
      },

      deleteProfile(id) {
        set((s) => {
          const profiles = { ...s.profiles }
          delete profiles[id]
          if (!Object.keys(profiles).length) {
            const p = newProfile('Joueur')
            profiles[p.id] = p
          }
          const currentId = profiles[s.currentId] ? s.currentId : Object.keys(profiles)[0]
          return { profiles, currentId }
        })
      },

      saveDraft(levelId, code) {
        get().update((p) => {
          p.drafts[levelId] = code
        })
      },

      recordAttempt(levelId, ok, concepts, errorTypes) {
        get().update((p) => {
          const lp = (p.levels[levelId] ??= { completed: false, stars: 0, attempts: 0, fails: 0, hintsUsed: 0 })
          lp.attempts += 1
          lp.lastAt = new Date().toISOString()
          p.lastLevelId = levelId
          if (!ok) {
            lp.fails += 1
            for (const c of concepts) {
              p.concepts[c] ??= { ok: 0, ko: 0 }
              p.concepts[c].ko += 1
            }
            for (const e of errorTypes) p.errors[e] = (p.errors[e] ?? 0) + 1
            // a concept you fail on comes back 1, 3, 7 and 14 days later
            if (lp.fails === 2 && concepts.length && !p.reviews.some((r) => r.levelId === levelId)) {
              p.reviews.push({ levelId, concept: concepts[0], due: addDays(dayKey(), 1), stage: 0 })
            }
          }
        })
      },

      completeLevel(input) {
        let outcome: CompletionOutcome = { newStars: 0, xpGained: 0, coinsGained: 0, firstTime: false, leveledUp: false }
        get().update((p) => {
          const lp = (p.levels[input.levelId] ??= { completed: false, stars: 0, attempts: 0, fails: 0, hintsUsed: 0 })
          const firstTime = !lp.completed
          const newStars = Math.max(0, input.stars - lp.stars)
          // XP: full on first completion, then only for newly won stars (replays give a small bonus)
          const xpGained = firstTime ? input.xp : newStars > 0 ? Math.round((input.xp * newStars) / 3) : Math.round(input.xp * 0.1)
          const coinsGained = firstTime ? input.coins : newStars * 3
          lp.completed = true
          lp.stars = Math.max(lp.stars, input.stars)
          lp.hintsUsed = Math.max(lp.hintsUsed, input.usedHints)
          if (input.timeMs !== undefined) lp.bestTimeMs = Math.min(lp.bestTimeMs ?? Infinity, input.timeMs)
          if (input.chars !== undefined) lp.bestChars = Math.min(lp.bestChars ?? Infinity, input.chars)
          lp.firstDoneAt ??= new Date().toISOString()
          lp.lastAt = new Date().toISOString()
          p.xp += xpGained
          p.coins += coinsGained
          p.lastLevelId = input.levelId
          for (const c of input.concepts) {
            p.concepts[c] ??= { ok: 0, ko: 0 }
            p.concepts[c].ok += 1
          }
          touchStreak(p)
          if (input.daily) p.daily[dayKey()] = input.levelId
          // spaced repetition: success on a due review moves it to the next interval
          const today = dayKey()
          p.reviews = p.reviews.flatMap((r) => {
            if (r.levelId !== input.levelId || r.due > today) return [r]
            const stage = r.stage + 1
            if (stage >= REVIEW_INTERVALS.length) return []
            return [{ ...r, stage, due: addDays(today, REVIEW_INTERVALS[stage]) }]
          })
          // quests & counters
          questTick(p, 'levels')
          questTick(p, `type:${input.type}`)
          if (input.stars === 3) questTick(p, 'three_stars')
          p.counters[`type:${input.type}`] = (p.counters[`type:${input.type}`] ?? 0) + (firstTime ? 1 : 0)
          if (input.firstTry && firstTime) p.counters.first_try = (p.counters.first_try ?? 0) + 1
          const h = new Date().getHours()
          if (h >= 23 || h < 5) p.counters.night = (p.counters.night ?? 0) + 1
          if (input.usedHints === 0 && firstTime) p.counters.no_hint = (p.counters.no_hint ?? 0) + 1
          outcome = { newStars, xpGained, coinsGained, firstTime, leveledUp: false }
        })
        return outcome
      },

      buyHint(levelId, index) {
        const cost = HINT_COST[index] ?? 40
        const p = get().profile()
        if (p.coins < cost) return false
        get().update((q) => {
          q.coins -= cost
          const lp = (q.levels[levelId] ??= { completed: false, stars: 0, attempts: 0, fails: 0, hintsUsed: 0 })
          lp.hintsUsed = Math.max(lp.hintsUsed, index + 1)
          q.counters.hints = (q.counters.hints ?? 0) + 1
        })
        return true
      },

      bump(counter, by = 1) {
        get().update((p) => {
          p.counters[counter] = (p.counters[counter] ?? 0) + by
          questTick(p, counter, by)
        })
      },

      toast(kind, text, emoji) {
        const id = toastId++
        set((s) => ({ toasts: [...s.toasts, { id, kind, text, emoji }] }))
        setTimeout(() => get().dismissToast(id), 4500)
      },

      dismissToast(id) {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      },

      heartsNow() {
        const h = get().profile().hearts
        if (h.count >= MAX_HEARTS) return MAX_HEARTS
        const regen = Math.floor((Date.now() - h.updatedAt) / HEART_REGEN_MS)
        return Math.min(MAX_HEARTS, h.count + regen)
      },

      loseHeart() {
        const now = get().heartsNow()
        get().update((p) => {
          p.hearts = { count: Math.max(0, now - 1), updatedAt: Date.now() }
        })
      },

      refillHearts(n = MAX_HEARTS) {
        const now = get().heartsNow()
        get().update((p) => {
          p.hearts = { count: Math.min(MAX_HEARTS, now + n), updatedAt: Date.now() }
        })
      },
    }),
    {
      name: 'pyarcade-v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profiles: s.profiles, currentId: s.currentId, settings: s.settings }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>
        const profiles: Record<string, Profile> = {}
        for (const [id, prof] of Object.entries(p.profiles ?? current.profiles)) {
          // forward-compatible: fill fields added in newer versions
          profiles[id] = { ...newProfile(prof.name), ...prof, id }
        }
        return { ...current, ...p, profiles, settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) } }
      },
    },
  ),
)

export const useProfile = () => useStore((s) => s.profiles[s.currentId] ?? Object.values(s.profiles)[0])
export const useSettings = () => useStore((s) => s.settings)
