import { Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ALL_LEVELS } from '../content'
import type { BossLevel } from '../content/schema'
import { bossFile } from '../content/variants'
import { loadNamespace, resolveFiles, type PyError } from '../engine/api'
import { useProfile } from '../store/store'
import { useTr } from '../i18n'
import { LIVE_GAMES } from '../live'
import { ErrorCard } from '../components/ErrorCard'

function Play({ boss }: { boss: BossLevel }) {
  const p = useProfile()
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<PyError | null>(null)
  useEffect(() => {
    void (async () => {
      const code = p.drafts[boss.id] ?? bossFile(boss, 'solution')
      const r = await loadNamespace(code, 'bonus', { files: await resolveFiles(boss.files) })
      if (r.ok) setReady(true)
      else setErr(r.error)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boss.id])
  const Game = LIVE_GAMES[boss.live_game!]
  if (err) return <ErrorCard error={err} />
  return ready && Game ? (
    <Suspense fallback={<div className="text-muted">…</div>}>
      <Game ns="bonus" level={boss} />
    </Suspense>
  ) : (
    <div className="text-muted">…</div>
  )
}

export default function BonusPage() {
  const tr = useTr()
  const p = useProfile()
  const games = ALL_LEVELS.filter((l): l is BossLevel => l.type === 'boss' && !!l.live_game && l.variant !== 'exam' && !!LIVE_GAMES[l.live_game])
  const [sel, setSel] = useState<string | null>(null)
  const won = games.filter((g) => p.bosses[g.id]?.won)
  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-6">
      <h1 className="font-display text-3xl">🕹️ {tr('Jeux bonus', 'Bonus games')}</h1>
      <p className="mt-1 text-sm text-muted">{tr('Chaque boss vaincu débloque son jeu, à rejouer sans fin… propulsé par TON code.', 'Each defeated boss unlocks its game, replayable forever… powered by YOUR code.')}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {games.map((g) => {
          const ok = !!p.bosses[g.id]?.won
          return (
            <button key={g.id} disabled={!ok} onClick={() => setSel(g.id)} className={`card p-4 text-left ${sel === g.id ? 'border-accent' : ''} ${ok ? '' : 'opacity-50'}`}>
              <div className="text-3xl">{ok ? '🎮' : '🔒'}</div>
              <div className="mt-1 font-semibold">{g.title}</div>
              <div className="text-xs text-muted">{ok ? tr('Jouer', 'Play') : tr('Bats le boss pour débloquer', 'Beat the boss to unlock')}</div>
            </button>
          )
        })}
      </div>
      {!won.length && (
        <div className="mt-6 text-center text-sm text-muted">
          {tr('Aucun jeu débloqué pour l’instant.', 'No game unlocked yet.')}{' '}
          <Link to="/wordle" className="underline">
            {tr('Le boss Wordle est accessible dès maintenant.', 'The Wordle boss is open right now.')}
          </Link>
        </div>
      )}
      {sel && (
        <div className="card mt-6 p-4">
          <Play key={sel} boss={games.find((g) => g.id === sel)!} />
        </div>
      )}
    </div>
  )
}
