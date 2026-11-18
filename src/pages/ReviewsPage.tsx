import { Link, useSearchParams } from 'react-router'
import { LEVELS, ALL_LEVELS } from '../content'
import { useProfile } from '../store/store'
import { useTr } from '../i18n'
import { dueReviews, levelWorldTitle } from '../lib/progress'
import { REVIEW_INTERVALS } from '../store/store'
import { TYPE_META } from '../lib/levelTypes'

export default function ReviewsPage() {
  const tr = useTr()
  const p = useProfile()
  const [params] = useSearchParams()
  const heal = params.get('heal') === '1'
  const due = dueReviews(p)
  const later = p.reviews.filter((r) => !due.includes(r)).sort((a, b) => a.due.localeCompare(b.due))
  // when nothing is due, any finished level can serve as a review (to heal hearts)
  const fallback = ALL_LEVELS.filter((l) => l.type !== 'boss' && p.levels[l.id]?.completed && l.estimated_minutes <= 4).slice(-12)
  const q = heal ? '?review=1&heal=1' : '?review=1'
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6">
      <h1 className="font-display text-3xl">🔁 {tr('Révisions espacées', 'Spaced reviews')}</h1>
      <p className="mt-1 text-sm text-muted">
        {tr('Une notion ratée revient 1, 3, 7 puis 14 jours plus tard. Chaque révision réussie l’ancre un peu plus.', 'A missed concept comes back 1, 3, 7 then 14 days later.')}
        {heal && ' ' + tr('Réussis une révision pour regagner un cœur ❤️.', 'Clear a review to win back a heart ❤️.')}
      </p>
      <div className="mt-4 space-y-2">
        {due.map((r) => {
          const l = LEVELS[r.levelId]
          return (
            <Link key={r.levelId} to={`/level/${l.id}${q}`} className="card flex items-center gap-3 p-3 hover:border-accent">
              <span className="text-2xl">{TYPE_META[l.type].icon}</span>
              <span className="flex-1">
                <span className="font-semibold">{l.title}</span>
                <span className="block text-xs text-muted">
                  {levelWorldTitle(l)} · {r.concept} · {tr('étape', 'step')} {r.stage + 1}/{REVIEW_INTERVALS.length}
                </span>
              </span>
              <span className="btn btn-primary text-sm">{tr('Réviser', 'Review')} ▶</span>
            </Link>
          )
        })}
        {!due.length && (
          <div className="card p-4 text-sm">
            {tr('Aucune révision due aujourd’hui. 🎉', 'No review due today. 🎉')}
            {fallback.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 text-muted">{tr('Révision libre :', 'Free review:')}</div>
                <div className="flex flex-wrap gap-2">
                  {fallback.map((l) => (
                    <Link key={l.id} className="pill" to={`/level/${l.id}${q}`}>
                      {TYPE_META[l.type].icon} {l.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {later.length > 0 && (
        <>
          <h2 className="mt-6 font-display text-xl">{tr('À venir', 'Coming up')}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {later.map((r) => (
              <li key={r.levelId} className="flex justify-between">
                <span>{LEVELS[r.levelId]?.title}</span>
                <span className="text-muted">{r.due}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
