import { Link } from 'react-router'
import { useProfile } from '../store/store'
import { useTr } from '../i18n'
import { titleFor } from '../lib/xp'

export default function CertificatePage() {
  const tr = useTr()
  const p = useProfile()
  if (!p.diploma)
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <div className="text-5xl">📜</div>
        <p className="mt-2">{tr('Le certificat se gagne en réussissant l’examen final (10/20 ou plus).', 'The certificate is earned by passing the final exam (10/20 or more).')}</p>
        <Link className="btn btn-primary mt-4" to="/exam">
          🎓 {tr('Examen final', 'Final exam')}
        </Link>
      </div>
    )
  const date = new Date(p.diploma.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const done = Object.values(p.levels).filter((l) => l.completed).length
  const bosses = Object.values(p.bosses).filter((b) => b.won).length
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <div className="no-print mb-4 flex justify-end">
        <button className="btn btn-primary" onClick={() => window.print()}>
          🖨️ {tr('Imprimer / PDF', 'Print / PDF')}
        </button>
      </div>
      <div className="card border-4 border-double border-gold p-10 text-center" style={{ background: 'linear-gradient(135deg, var(--panel), var(--panel-2))' }}>
        <div className="text-6xl">🐍</div>
        <div className="mt-2 font-display text-4xl tracking-wide">Diplôme PyArcade</div>
        <div className="mt-6 text-muted">{tr('décerné à', 'awarded to')}</div>
        <div className="mt-1 font-display text-5xl text-accent2">{p.name}</div>
        <p className="mx-auto mt-6 max-w-lg">
          {tr(
            'pour avoir réalisé seul(e), en temps limité et sans indice, un projet Python complet de niveau L1',
            'for completing alone, in limited time and without hints, a full first-year Python project',
          )}{' '}
          : <b>{p.diploma.project}</b>, {tr('avec la note de', 'graded')} <b>{p.diploma.score.toFixed(1)}/20</b>.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <span className="pill">{done} {tr('niveaux réussis', 'levels cleared')}</span>
          <span className="pill">{bosses} boss</span>
          <span className="pill">{p.xp} XP</span>
          <span className="pill">{titleFor(p.xp)}</span>
        </div>
        <div className="mt-8 text-sm text-muted">{date}</div>
      </div>
    </div>
  )
}
