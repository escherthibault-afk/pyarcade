import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useProfile, useStore } from '../store/store'
import { useLang, useTr } from '../i18n'
import { playerLevel, titleFor, nextTitle } from '../lib/xp'
import { BADGES } from '../lib/badges'
import { mastery, trainingLevel, RADAR_BRANCHES, type Branch } from '../lib/progress'
import { ActivityCalendar } from '../components/ActivityCalendar'
import { localRepository, downloadText } from '../store/repository'
import { explainError } from '../engine/explain'
import { COSMETICS } from '../lib/cosmetics'

function Radar({ values, onPick }: { values: Record<Branch, number>; onPick: (b: Branch) => void }) {
  const n = RADAR_BRANCHES.length
  const R = 110
  const cx = 150
  const cy = 140
  const pt = (i: number, r: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const poly = RADAR_BRANCHES.map((b, i) => pt(i, Math.max(0.04, values[b]) * R).join(',')).join(' ')
  return (
    <svg viewBox="0 0 300 290" className="mx-auto w-full max-w-sm" role="img" aria-label="radar de maîtrise">
      {[0.25, 0.5, 0.75, 1].map((k) => (
        <polygon key={k} points={RADAR_BRANCHES.map((_, i) => pt(i, k * R).join(',')).join(' ')} fill="none" stroke="var(--line)" />
      ))}
      {RADAR_BRANCHES.map((_, i) => {
        const [x, y] = pt(i, R)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" />
      })}
      <polygon points={poly} fill="color-mix(in srgb, var(--accent-2) 35%, transparent)" stroke="var(--accent-2)" strokeWidth="2" />
      {RADAR_BRANCHES.map((b, i) => {
        const [x, y] = pt(i, R + 22)
        return (
          <g key={b} onClick={() => onPick(b)} className="cursor-pointer" role="button" aria-label={`entraîner ${b}`}>
            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="var(--text)">
              {b}
            </text>
            <text x={x} y={y + 12} textAnchor="middle" fontSize="9" fill="var(--muted)">
              {Math.round(values[b] * 100)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default function ProfilePage() {
  const tr = useTr()
  const lang = useLang()
  const p = useProfile()
  const profiles = useStore((s) => s.profiles)
  const currentId = useStore((s) => s.currentId)
  const { addProfile, switchProfile, deleteProfile, update } = useStore.getState()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const lvl = playerLevel(p.xp)
  const next = nextTitle(p.xp)
  const m = mastery(p)
  const completed = Object.values(p.levels).filter((l) => l.completed)
  const errors = Object.entries(p.errors)
    .filter(([k]) => /^[A-Z]/.test(k))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const leaderboard = Object.values(profiles).sort((a, b) => b.xp - a.xp)
  const hours = Math.floor(p.timeSpentMs / 3_600_000)
  const minutes = Math.floor((p.timeSpentMs % 3_600_000) / 60_000)
  const titles = COSMETICS.filter((c) => c.kind === 'title' && p.owned.includes(c.id))

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-6">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="text-6xl">{p.equipped.avatar}</div>
        <div className="flex-1">
          <h1 className="font-display text-3xl">{p.name}</h1>
          <div className="text-accent2">
            {p.equipped.title || titleFor(p.xp, lang)} · {tr('niveau', 'level')} {lvl.level}
          </div>
          <div className="mt-2 h-3 max-w-md overflow-hidden rounded-full bg-panel2">
            <div className="h-full bg-accent2" style={{ width: `${(lvl.into / lvl.need) * 100}%` }} />
          </div>
          <div className="mt-1 text-xs text-muted">
            {lvl.into}/{lvl.need} XP {tr('avant le niveau', 'to level')} {lvl.level + 1}
            {next && ` · ${tr('prochain titre', 'next title')} : ${lang === 'en' ? next.en : next.fr} (${next.xp} XP)`}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            ['XP', p.xp],
            ['🪙', p.coins],
            ['✓', completed.length],
            ['⭐', completed.reduce((a, l) => a + l.stars, 0)],
            ['🔥', p.streak.current],
            ['🏆', p.streak.best],
            ['🏅', Object.keys(p.badges).length],
            ['⏱', `${hours} h ${minutes}`],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl border border-line bg-panel2 px-3 py-2 text-center">
              <div className="text-xs text-muted">{k}</div>
              <div className="font-bold">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-display text-xl">🎯 {tr('Maîtrise par notion', 'Mastery by topic')}</h2>
          <p className="text-xs text-muted">{tr('Clique sur une branche faible pour un entraînement ciblé.', 'Click a weak branch for targeted practice.')}</p>
          <Radar
            values={m}
            onPick={(b) => {
              const l = trainingLevel(p, b)
              if (l) navigate(`/level/${l.id}?review=1`)
            }}
          />
        </div>
        <div className="card p-4">
          <h2 className="font-display text-xl">📅 {tr('Jours actifs', 'Active days')}</h2>
          <ActivityCalendar days={p.activeDays} weeks={26} />
          <h3 className="mt-4 font-semibold">🐞 {tr('Tes erreurs les plus fréquentes', 'Your most frequent errors')}</h3>
          {errors.length ? (
            <ul className="mt-1 space-y-1 text-sm">
              {errors.map(([type, n]) => (
                <li key={type} className="flex justify-between gap-2">
                  <span>{explainError({ type, message: '', line: null, line_text: '', detail: {}, trace: '' }, lang).title}</span>
                  <span className="text-muted">×{n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-muted">{tr('Aucune pour l’instant.', 'None yet.')}</div>
          )}
          {titles.length > 0 && (
            <label className="mt-4 block text-sm">
              🏷️ {tr('Titre affiché', 'Displayed title')}
              <select
                className="ml-2 rounded-lg border border-line bg-bg2 px-2 py-1"
                value={p.equipped.title}
                onChange={(e) =>
                  update((q) => {
                    q.equipped.title = e.target.value
                  })
                }
              >
                <option value="">{titleFor(p.xp, lang)}</option>
                {titles.map((t) => (
                  <option key={t.id} value={t.value}>
                    {t.value}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className="card mt-4 p-4">
        <h2 className="font-display text-xl">🏅 {tr('Succès', 'Achievements')} ({Object.keys(p.badges).length}/{BADGES.length})</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {BADGES.map((b) => {
            const got = !!p.badges[b.id]
            const hidden = b.secret && !got
            return (
              <div key={b.id} className={`rounded-xl border p-2 text-sm ${got ? 'border-gold/60 bg-gold/10' : 'border-line opacity-60'}`} title={hidden ? '???' : b.desc}>
                <div className="text-2xl">{hidden ? '❔' : got ? b.emoji : '🔒'}</div>
                <div className="font-semibold">{hidden ? tr('Secret', 'Secret') : lang === 'en' ? b.en : b.fr}</div>
                <div className="text-xs text-muted">{hidden ? '???' : b.desc}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-display text-xl">👥 {tr('Profils sur cet ordinateur', 'Profiles on this computer')}</h2>
          <ol className="mt-2 space-y-1">
            {leaderboard.map((q, i) => (
              <li key={q.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${q.id === currentId ? 'bg-accent/15' : ''}`}>
                <span className="w-5 text-muted">{i + 1}.</span>
                <span className="text-xl">{q.equipped.avatar}</span>
                <span className="flex-1">{q.name}</span>
                <span className="text-sm text-muted">{q.xp} XP</span>
                {q.id !== currentId && (
                  <button className="pill" onClick={() => switchProfile(q.id)}>
                    {tr('Jouer', 'Play')}
                  </button>
                )}
                {Object.keys(profiles).length > 1 && (
                  <button
                    className="pill text-ko"
                    onClick={() => confirm(tr(`Supprimer le profil ${q.name} ? Sa progression sera perdue.`, `Delete profile ${q.name}? Its progress will be lost.`)) && deleteProfile(q.id)}
                    aria-label={tr('supprimer', 'delete')}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ol>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) addProfile(name.trim(), ['🦊', '🐼', '🐸', '🦉'][Object.keys(profiles).length % 4])
              setName('')
            }}
          >
            <input className="flex-1 rounded-lg border border-line bg-bg2 px-3 py-1.5" placeholder={tr('Prénom', 'First name')} value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn">＋ {tr('Ajouter', 'Add')}</button>
          </form>
          <p className="mt-2 text-xs text-muted">{tr('Classement local. Un classement en ligne pourra être branché plus tard (ProgressRepository).', 'Local leaderboard. An online one can be plugged later (ProgressRepository).')}</p>
        </div>
        <div className="card p-4">
          <h2 className="font-display text-xl">💾 {tr('Sauvegarde', 'Backup')}</h2>
          <p className="text-sm text-muted">{tr('Exporte ta progression (fichier JSON) pour la garder ou la transférer.', 'Export your progress (JSON) to keep or move it.')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn" onClick={() => downloadText(`pyarcade-${p.name}.json`, localRepository.exportProfile())}>
              ⬇️ {tr('Exporter', 'Export')}
            </button>
            <Link className="btn" to="/settings">
              ⬆️ {tr('Importer (Réglages)', 'Import (Settings)')}
            </Link>
            <Link className="btn" to="/shop">
              🛍️ {tr('Boutique', 'Shop')}
            </Link>
          </div>
          <label className="mt-4 block text-sm">
            {tr('Ton nom', 'Your name')}
            <input
              className="ml-2 rounded-lg border border-line bg-bg2 px-2 py-1"
              value={p.name}
              onChange={(e) =>
                update((q) => {
                  q.name = e.target.value.slice(0, 24)
                })
              }
            />
          </label>
        </div>
      </div>
    </div>
  )
}
