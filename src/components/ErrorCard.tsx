import { useState } from 'react'
import type { PyError } from '../engine/api'
import { explainError } from '../engine/explain'
import { useLang, useTr } from '../i18n'
import { Markdown } from './Markdown'

export function ErrorCard({ error }: { error: PyError }) {
  const lang = useLang()
  const tr = useTr()
  const [raw, setRaw] = useState(false)
  const ex = explainError(error, lang)
  return (
    <div className="rounded-xl border border-ko/50 bg-ko/10 p-3 text-sm" role="alert">
      <div className="font-semibold text-ko">{ex.title}</div>
      <Markdown src={ex.body} className="mt-1 text-fg" />
      {error.line_text && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-bg2 px-2 py-1 font-mono text-xs">
          {error.line ? <span className="text-muted">{error.line} │ </span> : null}
          {error.line_text.trim()}
        </pre>
      )}
      {error.type !== 'Timeout' && (
        <button className="mt-2 text-xs text-muted underline" onClick={() => setRaw(!raw)}>
          {raw ? tr('Masquer le message Python', 'Hide the Python message') : tr('Voir le message Python original', 'Show the original Python message')}
        </button>
      )}
      {raw && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted">{error.trace || `${error.type}: ${error.message}`}</pre>}
    </div>
  )
}
