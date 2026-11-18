import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import { engine, type EngineStatus } from '../engine/engine'
import { useProfile, useSettings, useStore } from '../store/store'
import { useLang, useTr } from '../i18n'
import { continueTarget, dailyLevel, dueReviews, weeklyQuests, wordleReadiness } from '../lib/progress'
import { dayKey, weekKey } from '../lib/dates'
import { playerLevel, titleFor } from '../lib/xp'
import { levelWorldTitle } from '../lib/progress'
import { ActivityCalendar } from '../components/ActivityCalendar'
import { sfx } from '../lib/sound'
import { contentErrors } from '../content'

const LOADING = [
  ['Réveil du serpent…', 'Waking up the snake…'],
  ['Téléchargement de l’interpréteur Python…', 'Downloading the Python interpreter…'],
  ['Alignement des indentations sur 4 espaces…', 'Aligning indentation on 4 spaces…'],
  ['Remplacement des `pass` par du vrai code…', 'Replacing `pass` with real code…'],
  ['Chargement des tests cachés…', 'Loading hidden tests…'],
]

function EngineBar() {
  const tr = useTr()
  const lang = useLang()
  const [st, setSt] = useState<EngineStatus>(engine.status)
  const [msg, setMsg] = useState(0)
  useEffect(() => engine.subscribe(setSt), [])
  useEffect(() => {
    if (st.state === 'ready') return
    const t = setInterval(() => setMsg((m) => (m + 1) % LOADING.length), 1600)
    return () => clearInterval(t)
  }, [st.state])
  if (st.state === 'ready')
    return <div className="text-sm text-ok">🐍 {tr('Python est prêt dans ton navigateur.', 'Python is ready in your browser.')}</div>
  if (st.state === 'error')
    return (
      <div className="text-sm text-ko">
        ⚠️ {tr('Impossible de charger Python (connexion ?).', 'Could not load Python (connection?).')}{' '}
        <button className="underline" onClick={() => engine.start()}>
          {tr('Réessayer', 'Retry')}
        </button>
      </div>
    )
  return (
    <div className="w-full max-w-md">
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{LOADING[msg][lang === 'en' ? 1 : 0]}</span>
        <span>{Math.round(st.progress)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border border-line bg-panel2">
        <motion.div className="h-full bg-[repeating-linear-gradient(45deg,var(--accent)_0_10px,var(--accent-2)_10px_20px)]" animate={{ width: `${Math.max(4, st.progress)}%` }} />
      </div>
    </div>
  )
}

export function HomePage() {
  const tr = useTr()
  const lang = useLang()
  const navigate = useNavigate()
  const p = useProfile()
  const settings = useSettings()
  const update = useStore((s) => s.update)
  const target = continueTarget(p, settings.unlockAll)
  const daily = dailyLevel()
  const dailyDone = !!p.daily[dayKey()]
  const reviews = dueReviews(p)
  const ready = wordleReadiness(p)
  const lvl = playerLevel(p.xp)
  const quests = weeklyQuests()
  const qp = p.quests.week === weekKey() ? p.quests : { week: weekKey(), progress: {}, claimed: [] as string[] }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-6">
      {contentErrors.length > 0 && <div className="card mb-4 border-ko p-3 text-sm text-ko">⚠️ {contentErrors.length} niveau(x) invalide(s) — lance `npm run verify-content`.</div>}
      <section className="flex flex-col items-center gap-4 py-6 text-center">
        <motion.h1 initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-5xl tracking-wide sm:text-7xl">
          <span className="floaty inline-block">🐍</span> Py<span className="text-accent2">Arcade</span>
        </motion.h1>
        <p className="max-w-xl text-muted">
          {tr('Apprends Python à coups de mini-jeux. Chaque niveau dure quelques minutes ; au bout du chemin, tu codes seul un vrai TP de L1.', 'Learn Python with mini-games. Each level takes a few minutes; at the end of the road you code a real first-year project on your own.')}
        </p>
        <EngineBar />
        <div className="flex flex-wrap justify-center gap-3">
          <button
            className="btn btn-primary glow px-8 py-3 text-lg"
            onClick={() => {
              sfx.click()
              navigate(target ? `/level/${target.id}` : '/map')
            }}
            autoFocus
          >
            ▶ {p.lastLevelId ? tr('Continuer', 'Continue') : tr('Jouer', 'Play')}
          </button>
          <Link to="/wordle" className="btn px-5 py-3">
            🟩 {tr('Parcours express Wordle', 'Wordle fast track')}
          </Link>
        </div>
        {target && (
          <div className="text-sm text-muted">
            {tr('Prochain niveau', 'Next level')} : <b className="text-fg">{target.title}</b> · {levelWorldTitle(target)}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="font-display text-lg">🔥 {tr('Série', 'Streak')}</div>
            <span className="pill">🧊 ×{p.streak.freezes}</span>
          </div>
          <div className="mt-1 text-3xl font-bold">
            {p.streak.current} <span className="text-base font-normal text-muted">{tr('jour(s)', 'day(s)')}</span>
          </div>
          <div className="text-xs text-muted">
            {p.streak.lastDay === dayKey() ? tr('✓ Série validée aujourd’hui', '✓ Streak kept today') : tr('Réussis un niveau aujourd’hui pour la garder.', 'Clear a level today to keep it.')}
          </div>
          <ActivityCalendar days={p.activeDays} weeks={14} />
        </div>

        <div className="card p-4">
          <div className="font-display text-lg">📅 {tr('Défi du jour', 'Daily challenge')}</div>
          {daily ? (
            <>
              <div className="mt-1 font-semibold">{daily.title}</div>
              <div className="text-xs text-muted">{levelWorldTitle(daily)} · XP ×2</div>
              <Link to={`/level/${daily.id}?daily=1`} className={`btn mt-3 ${dailyDone ? '' : 'btn-primary'}`}>
                {dailyDone ? '✓ ' + tr('Relevé ! Rejouer', 'Done! Replay') : tr('Relever le défi', 'Take the challenge')}
              </Link>
            </>
          ) : (
            <div className="text-sm text-muted">…</div>
          )}
          <div className="mt-2 text-xs text-muted">{tr('Le même niveau pour tout le monde aujourd’hui.', 'Same level for everyone today.')}</div>
        </div>

        <div className="card p-4">
          <div className="font-display text-lg">🔁 {tr('Révisions', 'Reviews')}</div>
          {reviews.length ? (
            <>
              <div className="mt-1">
                {tr(`${reviews.length} révision(s) t’attendent, ~${reviews.length * 2} min`, `${reviews.length} review(s) waiting, ~${reviews.length * 2} min`)}
              </div>
              <Link to="/reviews" className="btn btn-primary mt-3">
                {tr('Réviser maintenant', 'Review now')}
              </Link>
            </>
          ) : (
            <div className="mt-1 text-sm text-muted">{tr('Rien à réviser aujourd’hui. Les notions ratées reviennent 1, 3, 7 et 14 jours plus tard.', 'Nothing to review today. Missed concepts come back 1, 3, 7 and 14 days later.')}</div>
          )}
        </div>

        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="font-display text-lg">🟩 {tr('Prêt pour l’évaluation Wordle', 'Ready for the Wordle assessment')}</div>
            <span className="font-display text-2xl text-ok">{ready} %</span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full border border-line bg-panel2">
            <motion.div className="h-full bg-ok" initial={{ width: 0 }} animate={{ width: `${ready}%` }} />
          </div>
          <div className="mt-2 text-sm text-muted">
            {tr('Accessible dès maintenant : chaînes, dict de compteurs, fichiers, puis le boss Wordle et son examen blanc.', 'Open right now: strings, counter dicts, files, then the Wordle boss and its mock exam.')}
          </div>
          <Link to="/wordle" className="btn mt-3">
            {tr('Ouvrir le parcours', 'Open the track')} →
          </Link>
        </div>

        <div className="card p-4">
          <div className="font-display text-lg">🎯 {tr('Quêtes de la semaine', 'Weekly quests')}</div>
          <ul className="mt-2 space-y-2 text-sm">
            {quests.map((q) => {
              const n = Math.min(q.target, qp.progress[q.key] ?? 0)
              const claimed = qp.claimed.includes(q.id)
              return (
                <li key={q.id}>
                  <div className="flex justify-between gap-2">
                    <span>{lang === 'en' ? q.en : q.fr}</span>
                    <span className="text-muted">
                      {n}/{q.target}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel2">
                      <div className="h-full bg-gold" style={{ width: `${(n / q.target) * 100}%` }} />
                    </div>
                    {n >= q.target && !claimed && (
                      <button
                        className="pill border-gold text-gold"
                        onClick={() => {
                          sfx.coin()
                          update((pp) => {
                            if (pp.quests.week !== weekKey()) pp.quests = { week: weekKey(), progress: {}, claimed: [] }
                            pp.quests.claimed.push(q.id)
                            pp.coins += q.reward
                          })
                        }}
                      >
                        +{q.reward} 🪙
                      </button>
                    )}
                    {claimed && <span className="text-xs text-ok">✓</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="card p-4">
          <div className="font-display text-lg">{p.equipped.avatar} {p.name}</div>
          <div className="text-sm text-muted">
            {tr('Niveau', 'Level')} {lvl.level} · {titleFor(p.xp, lang)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="pill">{p.xp} XP</span>
            <span className="pill">🏅 {Object.keys(p.badges).length}</span>
            <span className="pill">✓ {Object.values(p.levels).filter((l) => l.completed).length}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/profile" className="btn text-sm">
              👤 {tr('Profil', 'Profile')}
            </Link>
            <Link to="/notebook" className="btn text-sm">
              📒 {tr('Carnet', 'Notebook')}
            </Link>
          </div>
        </div>

        <div className="card p-4 md:col-span-2 lg:col-span-1">
          <div className="font-display text-lg">🎓 {tr('Examens', 'Exams')}</div>
          <p className="mt-1 text-sm text-muted">{tr('Sujet blanc chronométré sur les notions de ton choix, ou Diplôme PyArcade.', 'Timed mock exam on the topics you pick, or the PyArcade diploma.')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/revision" className="btn text-sm">
              🧾 {tr('Sujet blanc', 'Mock exam')}
            </Link>
            <Link to="/exam" className="btn text-sm">
              🎓 {tr('Examen final', 'Final exam')}
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
