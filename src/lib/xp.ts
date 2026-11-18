export const TITLES = [
  { xp: 0, fr: 'Script Kiddie', en: 'Script Kiddie' },
  { xp: 300, fr: 'Débogueur', en: 'Debugger' },
  { xp: 1000, fr: 'Pythonista', en: 'Pythonista' },
  { xp: 2500, fr: 'Algorithmicien', en: 'Algorithmist' },
  { xp: 5000, fr: 'Architecte', en: 'Architect' },
  { xp: 9000, fr: 'Grand Maître du `pass`', en: 'Grand Master of `pass`' },
]

/** Player level: 100 XP for level 2, then a bit more each level. */
export function playerLevel(xp: number) {
  let level = 1
  let need = 100
  let floor = 0
  while (xp >= floor + need) {
    floor += need
    level++
    need = Math.round(need * 1.15)
  }
  return { level, into: xp - floor, need }
}

export function titleFor(xp: number, lang: 'fr' | 'en' = 'fr') {
  let t = TITLES[0]
  for (const x of TITLES) if (xp >= x.xp) t = x
  return t[lang]
}

export function nextTitle(xp: number) {
  return TITLES.find((t) => t.xp > xp)
}

/** XP for a run: the level's XP scaled by stars, doubled in copy mode or daily challenge. */
export function xpFor(base: number, stars: number, opts: { copy?: boolean; daily?: boolean } = {}) {
  let xp = Math.round(base * (0.6 + 0.2 * stars))
  if (opts.copy) xp *= 2
  if (opts.daily) xp *= 2
  return xp
}

export const HINT_COST = [5, 15, 40]
