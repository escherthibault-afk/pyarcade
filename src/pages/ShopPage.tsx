import { useProfile, useStore } from '../store/store'
import { useTr } from '../i18n'
import { COSMETICS, type Cosmetic } from '../lib/cosmetics'
import { EDITOR_THEMES, type EditorThemeName } from '../components/CodeEditor'
import { sfx } from '../lib/sound'
import { highlightPython } from '../lib/highlight'

export default function ShopPage() {
  const tr = useTr()
  const p = useProfile()
  const update = useStore((s) => s.update)
  const owned = (c: Cosmetic) => c.price === 0 || p.owned.includes(c.id)
  const equipped = (c: Cosmetic) =>
    (c.kind === 'theme' && p.equipped.editorTheme === c.value) ||
    (c.kind === 'robot' && p.equipped.robotSkin === c.value) ||
    (c.kind === 'avatar' && p.equipped.avatar === c.value) ||
    (c.kind === 'title' && p.equipped.title === c.value)
  const act = (c: Cosmetic) => {
    if (!owned(c)) {
      if (p.coins < c.price) return
      sfx.coin()
      update((q) => {
        q.coins -= c.price
        q.owned.push(c.id)
      })
      return
    }
    update((q) => {
      if (c.kind === 'theme') q.equipped.editorTheme = c.value
      if (c.kind === 'robot') q.equipped.robotSkin = c.value
      if (c.kind === 'avatar') q.equipped.avatar = c.value
      if (c.kind === 'title') q.equipped.title = c.value
    })
  }
  const sections: [Cosmetic['kind'], string][] = [
    ['theme', tr('Thèmes d’éditeur', 'Editor themes')],
    ['avatar', tr('Avatars', 'Avatars')],
    ['robot', tr('Skins de robot', 'Robot skins')],
    ['title', tr('Titres', 'Titles')],
  ]
  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">🛍️ {tr('Boutique', 'Shop')}</h1>
        <span className="pill text-lg text-gold">🪙 {p.coins}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{tr('Les pièces se gagnent en jouant (jamais d’argent réel). Les coffres de fin de monde donnent aussi des cosmétiques.', 'Coins are earned by playing (never real money). End-of-world chests also give cosmetics.')}</p>
      {sections.map(([kind, title]) => (
        <section key={kind} className="mt-6">
          <h2 className="font-display text-xl">{title}</h2>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {COSMETICS.filter((c) => c.kind === kind).map((c) => (
              <div key={c.id} className={`card p-3 text-center ${equipped(c) ? 'border-accent' : ''}`}>
                {kind === 'theme' ? (
                  <pre
                    className="h-16 overflow-hidden rounded-lg p-2 text-left font-mono text-[10px] leading-tight"
                    style={{ background: EDITOR_THEMES[c.value as EditorThemeName].bg, color: EDITOR_THEMES[c.value as EditorThemeName].fg }}
                    dangerouslySetInnerHTML={{ __html: highlightPython('def f(n):\n    return n * 2  # ok') }}
                  />
                ) : (
                  <div className="text-4xl">{c.icon}</div>
                )}
                <div className="mt-1 text-sm font-semibold">{tr(c.fr, c.en)}</div>
                <button className={`btn mt-2 w-full text-sm ${!owned(c) && p.coins >= c.price ? 'btn-primary' : ''}`} disabled={equipped(c) || (!owned(c) && p.coins < c.price)} onClick={() => act(c)}>
                  {equipped(c) ? '✓ ' + tr('Équipé', 'Equipped') : owned(c) ? tr('Équiper', 'Equip') : `🪙 ${c.price}`}
                </button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
