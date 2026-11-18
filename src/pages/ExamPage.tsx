import { Link, useNavigate } from 'react-router'
import { ALL_LEVELS } from '../content'
import type { BossLevel } from '../content/schema'
import { useProfile } from '../store/store'
import { useTr } from '../i18n'

/** Final exam: a twin project drawn at random among those not done yet, in exam conditions. */
export default function ExamPage() {
  const tr = useTr()
  const p = useProfile()
  const navigate = useNavigate()
  const twins = ALL_LEVELS.filter((l): l is BossLevel => l.type === 'boss' && l.variant === 'twin')
  const notDone = twins.filter((t) => !p.bosses[t.id]?.won)
  const pool = notDone.length ? notDone : twins
  const draw = () => {
    const pick = pool[Math.floor(Math.random() * pool.length)]
    navigate(`/level/${pick.id}?final=1`)
  }
  return (
    <div className="mx-auto max-w-2xl px-4 pb-20 pt-6">
      <div className="card space-y-4 p-6">
        <div className="text-5xl">🎓</div>
        <h1 className="font-display text-3xl">{tr('Examen final : Diplôme PyArcade', 'Final exam: PyArcade diploma')}</h1>
        <p>
          {tr(
            'Un projet complet tiré au hasard parmi les boss jumeaux que tu n’as pas encore battus, en conditions réelles : 90 minutes, aucun indice, note sur 20 (tests visibles et cachés, signatures, lisibilité).',
            'A full project drawn at random among the twin bosses you have not beaten yet, in real conditions: 90 minutes, no hints, graded /20.',
          )}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{tr('10/20 ou plus : certificat imprimable et accès au monde secret.', '10/20 or more: printable certificate and access to the secret world.')}</li>
          <li>{tr('Projets possibles', 'Possible projects')} ({pool.length}) : {pool.map((t) => t.title.replace(/^\S+\s/, '')).join(' · ')}</li>
          <li>{tr('Tu peux activer le mode copie au début (aucune exécution, comme sur papier).', 'You can enable paper mode at the start.')}</li>
        </ul>
        {p.diploma ? (
          <div className="rounded-xl border border-gold/60 bg-gold/10 p-3 text-sm">
            🎓 {tr('Diplôme obtenu', 'Diploma earned')} : {p.diploma.score.toFixed(1)}/20 · {p.diploma.project}
            <Link to="/certificate" className="btn ml-2 text-sm">
              📜 {tr('Certificat', 'Certificate')}
            </Link>
          </div>
        ) : null}
        <button className="btn btn-primary px-6 py-3 text-lg" onClick={draw}>
          🎲 {tr('Tirer mon sujet et commencer', 'Draw my project and start')}
        </button>
      </div>
    </div>
  )
}
