import { useEffect, useState } from 'react'
import { useTr } from '../i18n'

const LIMIT = 45 * 60 * 1000

/** After 45 minutes in a row, suggest a break (can be closed, never guilt-tripping). */
export function BreakReminder() {
  const tr = useTr()
  const [since, setSince] = useState(Date.now())
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden && Date.now() - since > LIMIT) setOpen(true)
    }, 30_000)
    return () => clearInterval(t)
  }, [since])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="card max-w-sm p-6 text-center">
        <div className="text-5xl">🧃</div>
        <h2 className="mt-2 font-display text-2xl">{tr('Petite pause ?', 'Quick break?')}</h2>
        <p className="mt-2 text-sm text-muted">
          {tr('Ça fait 45 minutes que tu codes. Bois un verre d’eau, étire-toi : ton cerveau range ce que tu viens d’apprendre.', 'You have been coding for 45 minutes. Drink some water, stretch: your brain is filing what you just learned.')}
        </p>
        <button
          className="btn btn-primary mt-4"
          onClick={() => {
            setOpen(false)
            setSince(Date.now())
          }}
          autoFocus
        >
          {tr('Je continue', 'Keep going')}
        </button>
      </div>
    </div>
  )
}
