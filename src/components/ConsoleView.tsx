import { Fragment, lazy, Suspense } from 'react'
import { parseMarkup } from '../lib/richMarkup'
import type { ExecResult } from '../engine/api'
import { ErrorCard } from './ErrorCard'
import { CanvasView } from './CanvasView'
import { AnimatedCanvas } from './AnimatedCanvas'
import { useTr } from '../i18n'

const MapView = lazy(() => import('./MapView').then((m) => ({ default: m.MapView })))

const MARK = '\x1b[R]'
const CLEAR = '\x1b[CLEAR]'

/** stdout with rich_lite markup support. */
export function Stdout({ text }: { text: string }) {
  let lines = text.replace(/\n$/, '').split('\n')
  const lastClear = lines.lastIndexOf(CLEAR)
  if (lastClear >= 0) lines = lines.slice(lastClear + 1)
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-[0.86rem] leading-snug">
      {lines.map((ln, i) => (
        <Fragment key={i}>
          {ln.startsWith(MARK)
            ? parseMarkup(ln.slice(MARK.length)).map((s, j) => (
                <span key={j} style={s.style}>
                  {s.text}
                </span>
              ))
            : ln}
          {'\n'}
        </Fragment>
      ))}
    </pre>
  )
}

export function ConsoleView({ result, running, placeholder }: { result: ExecResult | null; running?: boolean; placeholder?: string }) {
  const tr = useTr()
  return (
    <div className="flex min-h-[90px] flex-col gap-2 rounded-xl border border-line bg-bg2 p-3" aria-live="polite">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
        <span>▸ Console</span>
        {running && <span className="animate-pulse text-accent2">{tr('exécution…', 'running…')}</span>}
      </div>
      {!result && !running && <div className="text-sm text-muted">{placeholder ?? tr('La sortie de ton programme apparaîtra ici.', 'Your program output will appear here.')}</div>}
      {result?.stdout ? <Stdout text={result.stdout} /> : null}
      {result?.error && <ErrorCard error={result.error} />}
      {result?.images?.map((b64, i) => <img key={i} alt={`figure ${i + 1}`} className="max-w-full rounded-lg bg-white" src={`data:image/png;base64,${b64}`} />)}
      {result?.canvas?.animated && !result.error && <AnimatedCanvas width={result.canvas.width} height={result.canvas.height} first={result.canvas.frame} />}
      {result?.canvas && !result.canvas.animated && result.canvas.frame.length > 0 && <CanvasView width={result.canvas.width} height={result.canvas.height} frame={result.canvas.frame} />}
      {result?.maps?.map((m, i) => (
        <Suspense key={i} fallback={<div className="text-muted">…</div>}>
          <MapView data={m} />
        </Suspense>
      ))}
      {result && !result.stdout && !result.error && !result.images && !result.canvas && !result.maps && (
        <div className="text-sm text-muted">{tr('(rien n’a été affiché)', '(nothing was printed)')}</div>
      )}
    </div>
  )
}
