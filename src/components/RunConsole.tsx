import { useCallback, useRef, useState } from 'react'
import { runProgram, type ExecOptions, type ExecResult } from '../engine/api'
import { ConsoleView } from './ConsoleView'
import { useTr } from '../i18n'

const KEYMAP: Record<string, string> = {
  ArrowUp: '\x1b[A', ArrowDown: '\x1b[B', ArrowRight: '\x1b[C', ArrowLeft: '\x1b[D',
  z: '\x1b[A', s: '\x1b[B', d: '\x1b[C', q: '\x1b[D', w: '\x1b[A', a: '\x1b[D',
  Enter: '\r', Escape: '\x1b', ' ': ' ', Backspace: '\x7f',
}

/**
 * Runs a whole program with interactive input()/readkey() support:
 * when the program waits for input, it is replayed from the start with all answers so far
 * (same random seed), which keeps Python fully synchronous in the worker.
 */
export function useInteractiveRun() {
  const [result, setResult] = useState<ExecResult | null>(null)
  const [running, setRunning] = useState(false)
  const state = useRef<{ opts: ExecOptions | null; inputs: string[]; keys: string[] }>({ opts: null, inputs: [], keys: [] })

  const exec = useCallback(async () => {
    const s = state.current
    if (!s.opts) return null
    setRunning(true)
    const r = await runProgram({ ...s.opts, inputs: s.inputs, keys: s.keys, interactive: true })
    setResult(r)
    setRunning(false)
    return r
  }, [])

  const start = useCallback(
    (opts: ExecOptions) => {
      state.current = { opts: { seed: opts.seed ?? Math.floor(Math.random() * 1e6), ...opts }, inputs: [], keys: [] }
      return exec()
    },
    [exec],
  )

  const sendInput = useCallback(
    (value: string) => {
      state.current.inputs.push(value)
      return exec()
    },
    [exec],
  )
  const sendKey = useCallback(
    (key: string) => {
      state.current.keys.push(key)
      return exec()
    },
    [exec],
  )
  const reset = useCallback(() => setResult(null), [])
  return { result, running, start, sendInput, sendKey, reset }
}

export function RunConsole({ run, placeholder }: { run: ReturnType<typeof useInteractiveRun>; placeholder?: string }) {
  const tr = useTr()
  const [value, setValue] = useState('')
  const { result, running } = run
  return (
    <div className="space-y-2">
      <ConsoleView result={result} running={running} placeholder={placeholder} />
      {result?.needs === 'input' && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run.sendInput(value)
            setValue('')
          }}
        >
          <span className="self-center font-mono text-sm text-accent2">{result.prompt || '>'}</span>
          <input autoFocus className="flex-1 rounded-lg border border-line bg-bg2 px-3 py-1.5 font-mono text-sm" value={value} onChange={(e) => setValue(e.target.value)} aria-label={tr('Ta saisie', 'Your input')} />
          <button className="btn btn-primary py-1.5 text-sm">↵</button>
        </form>
      )}
      {result?.needs === 'key' && (
        <div
          tabIndex={0}
          autoFocus
          className="rounded-lg border border-accent2 bg-accent2/10 p-2 text-center text-sm outline-none"
          onKeyDown={(e) => {
            const k = KEYMAP[e.key] ?? (e.key.length === 1 ? e.key : null)
            if (k) {
              e.preventDefault()
              run.sendKey(k)
            }
          }}
          ref={(el) => el?.focus()}
        >
          ⌨️ {tr('Clique ici puis appuie sur une touche (flèches, ZQSD ou WASD).', 'Click here then press a key (arrows, ZQSD or WASD).')}
        </div>
      )}
    </div>
  )
}
