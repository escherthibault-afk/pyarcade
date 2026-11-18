import { lazy, Suspense, useEffect, useState } from 'react'
import type { BossLevel } from '../content/schema'
import { loadNamespace, resolveFiles, type PyError } from '../engine/api'
import { ErrorCard } from '../components/ErrorCard'
import { useTr } from '../i18n'

export const LIVE_GAMES: Record<string, React.LazyExoticComponent<React.ComponentType<{ ns: string; level: BossLevel }>>> = {
  wordle: lazy(() => import('./WordleLive')),
  mastermind: lazy(() => import('./MastermindLive')),
  motus: lazy(() => import('./WordleLive').then((m) => ({ default: m.MotusLive }))),
}

export function registerLiveGame(name: string, comp: (typeof LIVE_GAMES)[string]) {
  LIVE_GAMES[name] = comp
}

/** "⚡ This game runs on your N functions": loads the student's file into the `boss` namespace. */
export function LiveGame({ level, code }: { level: BossLevel; code: string }) {
  const tr = useTr()
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState<PyError | null>(null)
  useEffect(() => {
    void (async () => {
      const files = await resolveFiles(level.files)
      const r = await loadNamespace(code, 'boss', { files })
      if (r.ok) setReady(true)
      else setErr(r.error)
    })()
  }, [code, level.files])
  const Game = level.live_game ? LIVE_GAMES[level.live_game] : undefined
  return (
    <div className="card mb-5 overflow-hidden border-ok p-4">
      <div className="mb-3 text-center">
        <div className="font-display text-2xl text-ok sm:text-3xl">⚡ {tr(`Ce jeu tourne avec tes ${level.steps.length} fonctions.`, `This game runs on your ${level.steps.length} functions.`)}</div>
        <div className="text-sm text-muted">{tr('Boss vaincu ! Voici la récompense : ton code, en vrai.', 'Boss defeated! Here is your reward: your code, for real.')}</div>
      </div>
      {err && <ErrorCard error={err} />}
      {ready && Game ? (
        <Suspense fallback={<div className="text-center text-muted">…</div>}>
          <Game ns="boss" level={level} />
        </Suspense>
      ) : (
        !err && !Game && <div className="text-center text-muted">{tr('Rejoue quand tu veux depuis « Jeux bonus ».', 'Replay any time from “Bonus games”.')}</div>
      )}
    </div>
  )
}
