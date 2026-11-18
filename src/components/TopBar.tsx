import { NavLink, Link } from 'react-router'
import { useProfile, useStore } from '../store/store'
import { playerLevel, titleFor } from '../lib/xp'
import { useLang, useTr } from '../i18n'
import { dayKey } from '../lib/dates'

export function TopBar() {
  const tr = useTr()
  const lang = useLang()
  const p = useProfile()
  const setSettings = useStore((s) => s.setSettings)
  const lvl = playerLevel(p.xp)
  const today = dayKey()
  const streakAlive = p.streak.lastDay === today
  const links: [string, string, string][] = [
    ['/map', '🗺️', tr('Carte', 'Map')],
    ['/wordle', '🟩', tr('Wordle express', 'Wordle track')],
    ['/notebook', '📒', tr('Carnet', 'Notebook')],
    ['/revision', '🧾', tr('Révision DS', 'Mock exam')],
    ['/sandbox', '🏖️', tr('Bac à sable', 'Sandbox')],
    ['/bonus', '🕹️', tr('Jeux bonus', 'Bonus games')],
  ]
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <a href="#main" className="sr-only focus:not-sr-only">
        {tr('Aller au contenu', 'Skip to content')}
      </a>
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-3 py-2 sm:px-5">
        <Link to="/" className="flex items-center gap-2 font-display text-xl tracking-wide">
          <span className="text-2xl">🐍</span>
          <span className="hidden sm:inline">
            Py<span className="text-accent2">Arcade</span>
          </span>
        </Link>
        <nav className="no-scrollbar flex flex-1 gap-1 overflow-x-auto" aria-label="navigation">
          {links.map(([to, icon, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `whitespace-nowrap rounded-lg px-2 py-1 text-sm ${isActive ? 'bg-panel2 text-fg' : 'text-muted hover:text-fg'}`}>
              <span aria-hidden>{icon}</span> <span className="hidden md:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          <span className={`pill ${streakAlive ? 'border-warn text-warn' : ''}`} title={tr('Série de jours', 'Day streak')}>
            🔥 {p.streak.current}
          </span>
          <Link to="/shop" className="pill text-gold" title={tr('Pièces', 'Coins')}>
            🪙 {p.coins}
          </Link>
          <Link to="/profile" className="hidden items-center gap-2 sm:flex" title={titleFor(p.xp, lang)}>
            <span className="pill">
              Nv {lvl.level}
              <span className="ml-1 inline-block h-1.5 w-12 overflow-hidden rounded-full bg-bg2 align-middle">
                <span className="block h-full bg-accent2" style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
              </span>
            </span>
          </Link>
          <Link to="/profile" className="text-2xl" aria-label={tr('Profil', 'Profile')}>
            {p.equipped.avatar}
          </Link>
          <button className="pill" onClick={() => setSettings({ lang: lang === 'fr' ? 'en' : 'fr' })} aria-label="FR/EN">
            {lang === 'fr' ? 'FR' : 'EN'}
          </button>
          <Link to="/settings" className="text-lg text-muted hover:text-fg" aria-label={tr('Réglages', 'Settings')}>
            ⚙️
          </Link>
        </div>
      </div>
    </header>
  )
}
