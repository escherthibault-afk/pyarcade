export type Cosmetic = { id: string; kind: 'theme' | 'robot' | 'avatar' | 'title' | 'sound'; value: string; fr: string; en: string; price: number; icon: string }

export const COSMETICS: Cosmetic[] = [
  { id: 'theme:arcade', kind: 'theme', value: 'arcade', fr: 'Arcade (défaut)', en: 'Arcade (default)', price: 0, icon: '🕹️' },
  { id: 'theme:paper', kind: 'theme', value: 'paper', fr: 'Papier (clair)', en: 'Paper (light)', price: 0, icon: '📄' },
  { id: 'theme:dracula', kind: 'theme', value: 'dracula', fr: 'Dracula', en: 'Dracula', price: 80, icon: '🧛' },
  { id: 'theme:matrix', kind: 'theme', value: 'matrix', fr: 'Matrix', en: 'Matrix', price: 120, icon: '🟢' },
  { id: 'theme:retro', kind: 'theme', value: 'retro', fr: 'Terminal rétro', en: 'Retro terminal', price: 120, icon: '📟' },
  { id: 'theme:synthwave', kind: 'theme', value: 'synthwave', fr: 'Synthwave', en: 'Synthwave', price: 200, icon: '🌆' },
  { id: 'robot:classic', kind: 'robot', value: 'classic', fr: 'Robot classique', en: 'Classic robot', price: 0, icon: '🤖' },
  { id: 'robot:cat', kind: 'robot', value: 'cat', fr: 'Chat', en: 'Cat', price: 40, icon: '🐱' },
  { id: 'robot:snake', kind: 'robot', value: 'snake', fr: 'Serpent', en: 'Snake', price: 60, icon: '🐍' },
  { id: 'robot:ghost', kind: 'robot', value: 'ghost', fr: 'Fantôme', en: 'Ghost', price: 60, icon: '👻' },
  { id: 'robot:alien', kind: 'robot', value: 'alien', fr: 'Alien', en: 'Alien', price: 90, icon: '👾' },
  { id: 'robot:rocket', kind: 'robot', value: 'rocket', fr: 'Fusée', en: 'Rocket', price: 120, icon: '🚀' },
  ...['🐍', '🦊', '🐼', '🐸', '🦉', '🐙', '🦄', '🐲', '🤖', '🧙', '🥷', '👩‍💻', '🧑‍🚀', '🐧', '🦖'].map((e, i) => ({
    id: `avatar:${e}`, kind: 'avatar' as const, value: e, fr: `Avatar ${e}`, en: `Avatar ${e}`, price: i < 4 ? 0 : 30 + i * 5, icon: e,
  })),
  { id: 'title:pythonista', kind: 'title', value: 'Pythonista en herbe', fr: 'Titre « Pythonista en herbe »', en: 'Title “Budding Pythonista”', price: 50, icon: '🏷️' },
  { id: 'title:bughunter', kind: 'title', value: 'Chasseur de bugs', fr: 'Titre « Chasseur de bugs »', en: 'Title “Bug hunter”', price: 80, icon: '🏷️' },
  { id: 'title:ninja', kind: 'title', value: 'Ninja de l’indentation', fr: 'Titre « Ninja de l’indentation »', en: 'Title “Indentation ninja”', price: 120, icon: '🏷️' },
  { id: 'sound:chip', kind: 'sound', value: 'chip', fr: 'Sons 8-bit', en: '8-bit sounds', price: 0, icon: '🔊' },
]

/** Mystery chest at the end of each world: a random cosmetic not owned yet, or coins. */
export function chestReward(owned: string[], rnd: () => number): { cosmetic?: Cosmetic; coins: number } {
  const pool = COSMETICS.filter((c) => c.price > 0 && !owned.includes(c.id))
  if (pool.length && rnd() < 0.75) return { cosmetic: pool[Math.floor(rnd() * pool.length)], coins: 20 }
  return { coins: 60 + Math.floor(rnd() * 60) }
}
