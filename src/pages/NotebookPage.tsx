import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ALL_LEVELS, getWorld } from '../content'
import { useProfile } from '../store/store'
import { useTr } from '../i18n'
import { Markdown } from '../components/Markdown'

export default function NotebookPage() {
  const tr = useTr()
  const p = useProfile()
  const [q, setQ] = useState('')
  const [showLocked, setShowLocked] = useState(false)
  const cards = useMemo(
    () => ALL_LEVELS.filter((l) => l.card).map((l) => ({ level: l, unlocked: !!p.levels[l.id]?.completed || !!p.bosses[l.id]?.won })),
    [p],
  )
  const ql = q.toLowerCase()
  const shown = cards.filter((c) => (showLocked || c.unlocked) && (!q || `${c.level.card!.title} ${c.level.card!.body_md} ${c.level.concepts.join(' ')}`.toLowerCase().includes(ql)))
  const unlocked = cards.filter((c) => c.unlocked).length
  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-6">
      <div className="no-print flex flex-wrap items-center gap-3">
        <h1 className="flex-1 font-display text-3xl">📒 {tr('Carnet', 'Notebook')}</h1>
        <span className="pill">
          {unlocked}/{cards.length} {tr('fiches', 'cards')}
        </span>
        <button className="btn" onClick={() => window.print()}>
          🖨️ {tr('Exporter en PDF', 'Export to PDF')}
        </button>
      </div>
      <p className="no-print mt-1 text-sm text-muted">{tr('Chaque niveau réussi ajoute sa fiche. Imprime-les (PDF) pour réviser avant un DS.', 'Each cleared level adds its card. Print them (PDF) before an exam.')}</p>
      <div className="no-print mt-4 flex flex-wrap items-center gap-3">
        <input className="flex-1 rounded-xl border border-line bg-bg2 px-3 py-2" placeholder={tr('Rechercher : dict, while, strip…', 'Search: dict, while, strip…')} value={q} onChange={(e) => setQ(e.target.value)} aria-label="recherche" />
        <label className="text-sm">
          <input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} /> {tr('voir aussi les fiches à débloquer', 'show locked cards too')}
        </label>
      </div>
      <h1 className="hidden font-display text-2xl print:block">PyArcade — Carnet de {p.name}</h1>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        {shown.map(({ level, unlocked: u }) => {
          const w = getWorld(level.world)
          return (
            <article key={level.id} className={`card p-4 ${u ? '' : 'opacity-50'}`}>
              <div className="text-xs text-muted">
                {w?.emoji} {w?.title} · <Link to={`/level/${level.id}`} className="underline">{level.title}</Link>
              </div>
              <h2 className="mt-1 font-display text-lg">{level.card!.title}</h2>
              {u ? <Markdown src={level.card!.body_md} className="text-sm" /> : <div className="text-sm text-muted">🔒 {tr('Réussis le niveau pour débloquer cette fiche.', 'Clear the level to unlock this card.')}</div>}
            </article>
          )
        })}
      </div>
      {!shown.length && <div className="mt-8 text-center text-muted">{tr('Aucune fiche pour l’instant : joue quelques niveaux !', 'No card yet: play some levels!')}</div>}
    </div>
  )
}
