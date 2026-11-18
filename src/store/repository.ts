import { useStore, newProfile, type Profile } from './store'

/**
 * Where the progression lives. V1 = this browser (localStorage via Zustand persist).
 * A Supabase (or any backend) implementation only needs these methods.
 */
export interface ProgressRepository {
  exportProfile(id?: string): string
  importProfile(json: string): Profile
  /** Future: push/pull to a server. */
  sync?(profile: Profile): Promise<void>
  /** Future: online leaderboard. */
  leaderboard?(): Promise<{ name: string; xp: number }[]>
}

export const localRepository: ProgressRepository = {
  exportProfile(id) {
    const s = useStore.getState()
    const p = s.profiles[id ?? s.currentId]
    return JSON.stringify({ app: 'pyarcade', version: 1, exportedAt: new Date().toISOString(), profile: p }, null, 2)
  },
  importProfile(json) {
    const data = JSON.parse(json)
    if (data?.app !== 'pyarcade' || !data.profile) throw new Error('not a PyArcade save')
    const base = newProfile(String(data.profile.name ?? 'Joueur'))
    const profile: Profile = { ...base, ...data.profile }
    useStore.setState((s) => ({ profiles: { ...s.profiles, [profile.id]: profile }, currentId: profile.id }))
    return profile
  },
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
