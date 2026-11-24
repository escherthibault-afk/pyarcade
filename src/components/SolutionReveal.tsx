import { useState } from 'react'
import type { Level } from '../content/schema'
import { useTr } from '../i18n'
import { CodeBlock, Markdown } from './Markdown'

/** What can be shown as "the correction" for a level (null: nothing meaningful to show). */
export function referenceOf(level: Level): { code?: string; output?: string } | null {
  switch (level.type) {
    case 'code_fill':
    case 'bug_hunt':
    case 'golf':
    case 'big_volume':
    case 'refactor':
    case 'assemble':
    case 'simulation':
    case 'robot':
    case 'truth_table':
    case 'write_test':
      return { code: level.solution }
    case 'lesson':
      return level.solution ? { code: level.solution } : null
    case 'parsons':
      return { code: level.lines.join('\n') }
    case 'predict_output':
      return { output: level.answer }
    default:
      return null
  }
}

type Props = {
  /** Code (or expected output) of the reference solution. */
  reference: { code?: string; output?: string }
  explanation?: string
  unlocked: boolean
  shown: boolean
  onShow: () => void
  /** Text explaining when the button unlocks. */
  lockedText: string
  /** Consequence shown before confirming (stars, review…). */
  warning: string
  label?: string
}

/**
 * "Voir la correction": a last resort when the player is stuck even with every hint.
 * Two-step confirmation, then the reference solution with its explanation.
 */
export function SolutionReveal({ reference, explanation, unlocked, shown, onShow, lockedText, warning, label }: Props) {
  const tr = useTr()
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!shown) {
    if (!unlocked) return <div className="text-xs text-muted">📗 {lockedText}</div>
    if (!confirming)
      return (
        <button className="btn w-full text-sm" onClick={() => setConfirming(true)}>
          📗 {label ?? tr('Voir la correction', 'Show the solution')}
        </button>
      )
    return (
      <div className="space-y-2 rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm">
        <div>{warning}</div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary text-sm" onClick={onShow}>
            {tr('Oui, montre-la', 'Yes, show it')}
          </button>
          <button className="btn text-sm" onClick={() => setConfirming(false)}>
            {tr('Je réessaie encore', 'Let me try again')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pop space-y-2 rounded-xl border border-accent2/50 bg-accent2/10 p-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-accent2">📗 {tr('Correction', 'Solution')}</div>
      {reference.code && (
        <>
          <CodeBlock code={reference.code} />
          <button
            className="pill"
            onClick={() => {
              void navigator.clipboard?.writeText(reference.code!).then(() => setCopied(true))
            }}
          >
            {copied ? '✓ ' + tr('copié', 'copied') : '📋 ' + tr('Copier', 'Copy')}
          </button>
        </>
      )}
      {reference.output !== undefined && (
        <>
          <div className="text-xs text-muted">{tr('Sortie exacte du programme :', 'Exact program output:')}</div>
          <pre className="whitespace-pre-wrap rounded-lg border border-line bg-bg2 p-2 font-mono text-xs">{reference.output}</pre>
        </>
      )}
      {explanation && <Markdown src={explanation} />}
      <div className="text-xs text-muted">
        {tr(
          'Conseil : recopie-la toi-même ligne par ligne en te demandant à quoi sert chacune, puis relance les tests. C’est en la retapant qu’on la retient.',
          'Tip: type it yourself line by line, asking what each line does, then run the tests again.',
        )}
      </div>
    </div>
  )
}
