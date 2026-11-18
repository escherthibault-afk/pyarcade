import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { getLevel, getWorld, isLevelUnlocked, nextLevelId } from '../content'
import type { Level } from '../content/schema'
import { useProfile, useSettings, useStore } from '../store/store'
import { useTr } from '../i18n'
import { TYPE_META } from '../lib/levelTypes'
import { xpFor } from '../lib/xp'
import { sfx } from '../lib/sound'
import { celebrate } from '../lib/confetti'
import { awardBadges } from '../lib/badges'
import { Markdown } from '../components/Markdown'
import { HintPanel } from '../components/HintPanel'
import { CompletionModal, type CompletionInfo } from '../components/CompletionModal'
import { Stars } from '../components/Stars'
import { GameFor } from '../games'
import { BossPage } from './BossPage'

export type CompleteOpts = { stars?: number; bonus3?: boolean; timeMs?: number; chars?: number; code?: string; extra?: string }

export type Session = {
  level: Level
  hints: number
  mistakes: number
  done: boolean
  startedAt: number
  /** a failed submission (wrong answer, failing tests…) */
  fail: (errorTypes?: string[]) => void
  complete: (o?: CompleteOpts) => void
  /** Hint panel to render inside the game layout. */
  hintPanel: React.ReactNode
  /** Statement block (story + statement) to render inside the game layout. */
  statement: React.ReactNode
  replayKey: number
}

export function LevelPage() {
  const { id = '' } = useParams()
  const level = getLevel(id)
  const tr = useTr()
  if (!level) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <div className="text-5xl">🕳️</div>
        <p className="mt-2">{tr('Ce niveau n’existe pas.', 'This level does not exist.')}</p>
        <Link className="btn mt-4" to="/map">
          🗺️ {tr('Retour à la carte', 'Back to the map')}
        </Link>
      </div>
    )
  }
  if (level.type === 'boss') return <BossPage key={level.id} level={level} />
  return <LevelRunner key={level.id} level={level} />
}

function LevelRunner({ level }: { level: Level }) {
  const tr = useTr()
  const profile = useProfile()
  const settings = useSettings()
  const [params] = useSearchParams()
  const daily = params.get('daily') === '1'
  const review = params.get('review') === '1'
  const heal = params.get('heal') === '1'
  const recordAttempt = useStore((s) => s.recordAttempt)
  const completeLevel = useStore((s) => s.completeLevel)
  const bump = useStore((s) => s.bump)
  const [replayKey, setReplayKey] = useState(0)
  const [hints, setHints] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  const [info, setInfo] = useState<CompletionInfo | null>(null)
  const startedAt = useRef(Date.now())
  const lastErrors = useRef<string[]>([])
  const world = getWorld(level.world)
  const unlocked = isLevelUnlocked(profile, level, settings.unlockAll) || daily || review
  const meta = TYPE_META[level.type]
  const best = profile.levels[level.id]

  useEffect(() => {
    useStore.getState().update((p) => {
      p.lastLevelId = level.id
    })
  }, [level.id])

  // time spent while the level is open
  useEffect(() => {
    const t0 = Date.now()
    return () => {
      const dt = Math.min(Date.now() - t0, 60 * 60 * 1000)
      useStore.getState().update((p) => {
        p.timeSpentMs += dt
      })
    }
  }, [])

  const fail = useCallback(
    (errorTypes: string[] = []) => {
      setMistakes((m) => m + 1)
      lastErrors.current = errorTypes
      recordAttempt(level.id, false, level.concepts, errorTypes)
      if (errorTypes.includes('float')) bump('float_trap')
      sfx.ko()
    },
    [level.id, level.concepts, recordAttempt, bump],
  )

  const complete = useCallback(
    (o: CompleteOpts = {}) => {
      const noHint = hints === 0
      const stars = o.stars ?? 1 + (noHint ? 1 : 0) + (noHint && (o.bonus3 ?? mistakes === 0) ? 1 : 0)
      const xp = xpFor(level.xp, stars, { copy: level.type === 'copy', daily })
      recordAttempt(level.id, true, [], [])
      if (lastErrors.current.includes('print_not_return')) bump('print_return_fixed')
      if (lastErrors.current.includes('IndexError')) bump('fixed_after_index')
      if (review) bump('reviews_done')
      if (heal) useStore.getState().refillHearts(1)
      if (level.type === 'golf' && level.par_chars && o.chars !== undefined && o.chars <= level.par_chars) bump('golf_par')
      if (level.type === 'predict_output' && level.timed_seconds && stars === 3) bump('speed3')
      const outcome = completeLevel({
        levelId: level.id,
        stars,
        xp,
        coins: 5 + stars * 2 + (daily ? 10 : 0),
        concepts: level.concepts,
        timeMs: o.timeMs ?? Date.now() - startedAt.current,
        chars: o.chars,
        usedHints: hints,
        firstTry: mistakes === 0,
        type: level.type,
        daily,
        review,
      })
      sfx.win()
      celebrate(stars === 3)
      setInfo({ stars, outcome, code: o.code, timeMs: o.timeMs, chars: o.chars, extra: o.extra })
      awardBadges()
    },
    [hints, mistakes, level, daily, review, heal, recordAttempt, completeLevel, bump],
  )

  const statement = useMemo(
    () => (
      <div className="space-y-3">
        {level.story && <p className="rounded-xl border border-line bg-panel2 p-3 text-sm italic text-muted">🎬 {level.story}</p>}
        <Markdown src={level.statement_md} />
      </div>
    ),
    [level],
  )

  const hintPanel = <HintPanel levelId={level.id} hints={level.hints} revealed={hints} onReveal={setHints} disabled={level.type === 'copy'} />

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <div className="text-5xl">🔒</div>
        <p className="mt-2">{tr('Ce niveau est encore verrouillé : termine le précédent.', 'This level is still locked: finish the previous one.')}</p>
        <Link className="btn mt-4" to="/map">
          🗺️ {tr('Retour à la carte', 'Back to the map')}
        </Link>
      </div>
    )
  }

  const session: Session = { level, hints, mistakes, done: !!info, startedAt: startedAt.current, fail, complete, hintPanel, statement, replayKey }

  return (
    <div className="mx-auto max-w-[1500px] px-3 pb-16 pt-3 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link to={world ? `/map#world-${world.id}` : '/map'} className="btn btn-ghost px-2 py-1 text-sm">
          ← {world ? `${world.emoji} ${world.title}` : tr('Carte', 'Map')}
        </Link>
        <span className="pill">
          {meta.icon} {level.type === 'predict_output' && level.timed_seconds ? 'Speed Read' : tr(meta.fr, meta.en)}
        </span>
        {daily && <span className="pill border-gold text-gold">📅 {tr('Défi du jour · XP ×2', 'Daily challenge · XP ×2')}</span>}
        {review && <span className="pill border-accent2 text-accent2">🔁 {tr('Révision', 'Review')}</span>}
        {level.review && <span className="pill">🔀 {tr('Rappel', 'Recap')}</span>}
        <span className="pill" title={tr('difficulté', 'difficulty')}>
          {'●'.repeat(level.difficulty)}
          <span className="opacity-30">{'●'.repeat(5 - level.difficulty)}</span>
        </span>
        <span className="pill">⏱ ~{level.estimated_minutes} min</span>
        <span className="pill text-accent2">{level.xp} XP</span>
        {best?.completed && <Stars n={best.stars} className="ml-1" />}
      </div>
      <h1 className="mb-3 font-display text-2xl sm:text-3xl">{level.title}</h1>
      <GameFor key={replayKey} session={session} />
      {info && (
        <CompletionModal
          level={level}
          info={info}
          nextId={daily || review ? null : nextLevelId(level.id)}
          onReplay={() => {
            setInfo(null)
            setHints(0)
            setMistakes(0)
            startedAt.current = Date.now()
            setReplayKey((k) => k + 1)
          }}
          onClose={() => setInfo(null)}
        />
      )}
    </div>
  )
}
