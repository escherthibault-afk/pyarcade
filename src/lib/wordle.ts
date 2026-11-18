export type Tile = 'green' | 'yellow' | 'grey'

/**
 * Reference Wordle evaluation (two passes with a letter counter).
 * Used by the "Devine la couleur" mini-game and by the unit tests.
 * Mirrors the Python solution the student writes in the Wordle boss.
 */
export function evaluateGuess(guess: string, secret: string): Tile[] {
  const g = guess.toLowerCase()
  const s = secret.toLowerCase()
  const result: Tile[] = Array.from({ length: g.length }, () => 'grey')
  const remaining: Record<string, number> = {}
  for (let i = 0; i < s.length; i++) {
    if (g[i] === s[i]) result[i] = 'green'
    else remaining[s[i]] = (remaining[s[i]] ?? 0) + 1
  }
  for (let i = 0; i < g.length; i++) {
    if (result[i] === 'green') continue
    if ((remaining[g[i]] ?? 0) > 0) {
      result[i] = 'yellow'
      remaining[g[i]] -= 1
    }
  }
  return result
}

/** Best known colour per letter for the virtual keyboard. */
export function mergeKeyboard(keyboard: Record<string, Tile>, guess: string, feedback: Tile[]) {
  const rank: Record<Tile, number> = { grey: 0, yellow: 1, green: 2 }
  const out = { ...keyboard }
  for (let i = 0; i < guess.length; i++) {
    const c = guess[i].toLowerCase()
    if (!(c in out) || rank[feedback[i]] > rank[out[c]]) out[c] = feedback[i]
  }
  return out
}

/** Deterministic daily index (same for everyone on the same day). */
export function dailyIndex(date: Date, modulo: number): number {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  let h = key
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = h ^ (h >>> 16)
  return Math.abs(h) % modulo
}
