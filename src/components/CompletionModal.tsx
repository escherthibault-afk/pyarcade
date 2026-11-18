import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { motion } from 'framer-motion'
import type { Level } from '../content/schema'
import type { CompletionOutcome } from '../store/store'
import { useSettings } from '../store/store'
import { useTr } from '../i18n'
import { Markdown, CodeBlock } from './Markdown'
import { Stars } from './Stars'

export type CompletionInfo = {
  stars: number
  outcome: CompletionOutcome
  code?: string
  timeMs?: number
  chars?: number
  extra?: string
}

function referenceCode(level: Level): string | null {
  if ('solution' in level && typeof level.solution === 'string' && level.type !== 'truth_table') return level.solution
  if (level.type === 'parsons') return level.lines.join('\n')
  return null
}

export function CompletionModal({ level, info, nextId, onReplay, onClose }: { level: Level; info: CompletionInfo; nextId: string | null; onReplay: () => void; onClose: () => void }) {
  const tr = useTr()
  const settings = useSettings()
  const navigate = useNavigate()
  const [count, setCount] = useState<number | null>(settings.autoNext && nextId ? 3 : null)
  const [tab, setTab] = useState<'mine' | 'ref'>('ref')
  const paused = useRef(false)
  const ref = referenceCode(level)

  useEffect(() => {
    if (count === null) return
    if (count <= 0) {
      navigate(`/level/${nextId}`)
      return
    }
    const t = setTimeout(() => {
      if (!paused.current) setCount((c) => (c === null ? null : c - 1))
      else setCount((c) => c)
    }, 1000)
    return () => clearTimeout(t)
  }, [count, nextId, navigate])

  const cancel = () => setCount(null)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="done-title">
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto p-5"
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onPointerDown={cancel}
        onKeyDown={cancel}
        onWheel={cancel}
      >
        <div className="text-center">
          <div className="text-5xl">🎉</div>
          <h2 id="done-title" className="mt-1 font-display text-3xl">{tr('Niveau réussi !', 'Level cleared!')}</h2>
          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }} className="mt-2">
            <Stars n={info.stars} size="text-4xl" />
          </motion.div>
          <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
            <span className="pill text-accent2">+{info.outcome.xpGained} XP</span>
            {info.outcome.coinsGained > 0 && <span className="pill text-gold">+{info.outcome.coinsGained} 🪙</span>}
            {info.timeMs !== undefined && <span className="pill">⏱ {(info.timeMs / 1000).toFixed(1)} s</span>}
            {info.chars !== undefined && level.type === 'golf' && <span className="pill">⛳ {info.chars} {tr('caractères', 'chars')}</span>}
          </div>
          {info.stars < 3 && (
            <div className="mt-2 text-xs text-muted">
              {tr('Étoiles manquantes : ', 'Missing stars: ')}
              {level.type === 'golf' && level.par_chars
                ? tr(`⭐⭐⭐ = sans indice et ≤ ${level.par_chars} caractères`, `⭐⭐⭐ = no hint and ≤ ${level.par_chars} chars`)
                : tr('⭐⭐ = sans indice · ⭐⭐⭐ = sans indice et du premier coup', '⭐⭐ = no hint · ⭐⭐⭐ = no hint, first try')}
            </div>
          )}
          {info.extra && <div className="mt-2 text-sm">{info.extra}</div>}
        </div>

        {level.card && (
          <div className="mt-5 rounded-xl border border-accent2/40 bg-accent2/10 p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-accent2">📒 {tr('Fiche ajoutée au Carnet', 'Card added to your Notebook')} · {level.card.title}</div>
            <Markdown src={level.card.body_md} className="text-sm" />
          </div>
        )}
        {level.explanation_md && (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">{tr('Pourquoi ça marche', 'Why it works')}</div>
            <Markdown src={level.explanation_md} className="text-sm" />
          </div>
        )}
        {ref && (
          <div className="mt-4">
            <div className="mb-2 flex gap-2">
              <button className={`pill ${tab === 'ref' ? 'border-accent text-accent' : ''}`} onClick={() => setTab('ref')}>
                {tr('Solution de référence', 'Reference solution')}
              </button>
              {info.code && (
                <button className={`pill ${tab === 'mine' ? 'border-accent text-accent' : ''}`} onClick={() => setTab('mine')}>
                  {tr('Ta solution', 'Your solution')}
                </button>
              )}
            </div>
            <CodeBlock code={tab === 'mine' && info.code ? info.code : ref} />
          </div>
        )}
        {level.exam_tip && (
          <div className="mt-4 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-warn">🎓 {tr('Conseil d’examen', 'Exam tip')}</div>
            <Markdown src={level.exam_tip} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button className="btn" onClick={onReplay}>
            ↺ {tr('Rejouer', 'Replay')}
          </button>
          <Link className="btn" to="/map" onClick={onClose}>
            🗺️ {tr('Carte', 'Map')}
          </Link>
          {nextId ? (
            <Link className="btn btn-primary glow" to={`/level/${nextId}`} autoFocus>
              {tr('Niveau suivant', 'Next level')} ▶ {count !== null ? `(${count})` : ''}
            </Link>
          ) : (
            <button className="btn btn-primary" onClick={onClose}>
              {tr('Fermer', 'Close')}
            </button>
          )}
        </div>
        {count !== null && (
          <div className="mt-2 text-center text-xs text-muted">
            {tr('Passage automatique… ', 'Auto-advance… ')}
            <button className="underline" onClick={cancel}>
              {tr('annuler', 'cancel')}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
