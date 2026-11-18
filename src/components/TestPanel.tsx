import { useEffect, useState } from 'react'
import type { TestReport, TestResult } from '../engine/api'
import { explainReason, explainViolation } from '../engine/explain'
import { useLang, useTr } from '../i18n'
import { ErrorCard } from './ErrorCard'
import { Markdown } from './Markdown'
import { Stdout } from './ConsoleView'

function Detail({ r }: { r: TestResult }) {
  const tr = useTr()
  const lang = useLang()
  const reason = explainReason(r, lang)
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-line bg-bg2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`pill ${r.passed ? 'border-ok text-ok' : 'border-ko text-ko'}`}>{r.passed ? '✓ ' + tr('réussi', 'passed') : '✗ ' + tr('échoué', 'failed')}</span>
        {r.hidden && <span className="pill">🙈 {tr('test caché', 'hidden test')}</span>}
        {r.stat && <span className="pill">🎲 {tr('test statistique', 'statistical test')}</span>}
        {r.label && <span className="text-muted">{r.label}</span>}
      </div>
      <div className="grid gap-1 font-mono text-[0.85rem]">
        <div>
          <span className="text-muted">{tr('appel', 'call')} › </span>
          {r.call}
        </div>
        {r.stdin && r.stdin.length > 0 && (
          <div>
            <span className="text-muted">{tr('saisies', 'inputs')} › </span>
            {r.stdin.map((s) => JSON.stringify(s)).join(', ')}
          </div>
        )}
        {r.expected !== undefined && (!r.hidden || r.passed) && (
          <div>
            <span className="text-muted">{tr('attendu', 'expected')} › </span>
            <span className="text-ok">{r.expected}</span>
          </div>
        )}
        {r.got !== undefined && !r.error && (
          <div>
            <span className="text-muted">{tr('obtenu', 'got')} › </span>
            <span className={r.passed ? 'text-ok' : 'text-ko'}>{r.got}</span>
          </div>
        )}
      </div>
      {r.expected_output !== undefined && !r.passed && (!r.hidden || r.passed) && (
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted">{tr('affichage attendu', 'expected output')}</div>
            <pre className="whitespace-pre-wrap rounded-lg border border-line p-2 font-mono text-xs">{r.expected_output}</pre>
          </div>
          <div>
            <div className="text-xs text-muted">{tr('ton affichage', 'your output')}</div>
            <pre className="whitespace-pre-wrap rounded-lg border border-line p-2 font-mono text-xs">{r.stdout || ' '}</pre>
          </div>
        </div>
      )}
      {reason && (
        <div className="rounded-lg border border-warn/40 bg-warn/10 p-2">
          <div className="font-semibold">{reason.title}</div>
          <Markdown src={reason.body} />
        </div>
      )}
      {r.error && r.reason !== 'timeout' && r.reason !== 'skipped' && <ErrorCard error={r.error} />}
      {r.stdout && r.expected_output === undefined && (
        <div>
          <div className="text-xs text-muted">{tr('affiché pendant le test', 'printed during the test')}</div>
          <Stdout text={r.stdout} />
        </div>
      )}
    </div>
  )
}

export function TestPanel({ report, running, total, partial }: { report: TestReport | null; running: boolean; total: number; partial: TestResult[] }) {
  const tr = useTr()
  const lang = useLang()
  const results = report?.results ?? partial
  const [sel, setSel] = useState<number | null>(null)
  useEffect(() => {
    if (report) {
      const firstFail = report.results.findIndex((r) => !r.passed)
      setSel(firstFail >= 0 ? firstFail : null)
    } else setSel(null)
  }, [report])
  const passed = results.filter((r) => r.passed).length
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-muted">{tr('Tests', 'Tests')}</div>
        {results.length > 0 && (
          <div className="text-sm font-semibold">
            <span className={passed === total ? 'text-ok' : ''}>{passed}</span>
            <span className="text-muted"> / {total}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="list">
        {Array.from({ length: total }, (_, i) => {
          const r = results[i]
          const state = r ? (r.passed ? 'ok' : 'ko') : running ? 'run' : 'idle'
          return (
            <button
              key={i}
              role="listitem"
              onClick={() => r && setSel(sel === i ? null : i)}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-bold transition ${
                state === 'ok'
                  ? 'border-ok bg-ok text-[var(--ok-text)]'
                  : state === 'ko'
                    ? 'border-ko bg-ko text-[var(--ko-text)]'
                    : state === 'run'
                      ? 'animate-pulse border-line bg-panel2'
                      : 'border-line bg-panel2 text-muted'
              } ${sel === i ? 'ring-2 ring-accent2' : ''}`}
              aria-label={`test ${i + 1} ${state}`}
            >
              {state === 'ok' ? '✓' : state === 'ko' ? '✗' : i + 1}
              {r?.hidden ? ' 🙈' : ''}
            </button>
          )
        })}
      </div>
      {report?.violations && report.violations.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {report.violations.map((v, i) => (
            <li key={i} className="rounded-lg border border-warn/50 bg-warn/10 px-2 py-1">
              📐 <Markdown src={explainViolation(v, lang)} className="inline [&>p]:inline" />
            </li>
          ))}
        </ul>
      )}
      {report?.loadError && (
        <div className="mt-3">
          <div className="mb-1 text-sm text-muted">{tr('Ton code ne se charge pas :', 'Your code does not load:')}</div>
          <ErrorCard error={report.loadError} />
        </div>
      )}
      {sel !== null && results[sel] && <Detail r={results[sel]} />}
    </div>
  )
}
