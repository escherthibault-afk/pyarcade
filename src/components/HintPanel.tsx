import { useState } from 'react'
import { HINT_COST } from '../lib/xp'
import { useProfile, useStore } from '../store/store'
import { useTr } from '../i18n'
import { Markdown } from './Markdown'
import { sfx } from '../lib/sound'

/** 3 hints, more and more precise, paid with coins (5, 15, 40). */
export function HintPanel({ levelId, hints, revealed, onReveal, disabled }: { levelId: string; hints: string[]; revealed: number; onReveal: (n: number) => void; disabled?: boolean }) {
  const tr = useTr()
  const profile = useProfile()
  const buyHint = useStore((s) => s.buyHint)
  const [msg, setMsg] = useState('')
  if (!hints.length) return null
  const alreadyPaid = profile.levels[levelId]?.hintsUsed ?? 0
  const next = revealed
  const cost = next < alreadyPaid ? 0 : HINT_COST[next]
  const labels = [tr('Concept', 'Concept'), tr('Pseudo-code', 'Pseudo-code'), tr('Début de code', 'Code start')]
  return (
    <div className="space-y-2">
      {hints.slice(0, revealed).map((h, i) => (
        <div key={i} className="pop rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-accent">💡 {tr('Indice', 'Hint')} {i + 1} · {labels[i]}</div>
          <Markdown src={h} />
        </div>
      ))}
      {next < hints.length && !disabled && (
        <button
          className="btn w-full text-sm"
          onClick={() => {
            if (cost === 0 || buyHint(levelId, next)) {
              sfx.coin()
              onReveal(next + 1)
              setMsg('')
            } else setMsg(tr('Pas assez de pièces : gagne-en en réussissant des niveaux !', 'Not enough coins: win some by clearing levels!'))
          }}
        >
          💡 {tr('Indice', 'Hint')} {next + 1}/{hints.length} · {labels[next]}{' '}
          <span className="pill">{cost === 0 ? tr('déjà payé', 'paid') : `🪙 ${cost}`}</span>
        </button>
      )}
      {msg && <div className="text-xs text-warn">{msg}</div>}
      {revealed > 0 && <div className="text-xs text-muted">{tr('Un indice utilisé = 2 étoiles maximum.', 'Using a hint caps you at 2 stars.')}</div>}
    </div>
  )
}
