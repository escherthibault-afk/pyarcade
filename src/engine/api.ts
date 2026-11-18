/** High-level Python API used by the screens. */
import { engine, TIMEOUT } from './engine'
import { RUN_TIMEOUT, TEST_TIMEOUT } from './config'
import type { Constraints, StatTest, TestCase } from '../content/schema'

export type PyError = {
  type: string
  message: string
  line: number | null
  line_text: string
  offset?: number
  detail: Record<string, unknown>
  trace: string
}

export type TestResult = {
  call: string
  label?: string | null
  fn?: string | null
  passed: boolean
  expected?: string
  expected_output?: string
  got?: string
  stdout: string
  stdin?: string[]
  error: PyError | null
  reason?: string | null
  where?: string
  hidden?: boolean
  stat?: boolean
}

export type Violation = { rule: string; detail?: string; limit?: number; count?: number; scope?: string }

export type CanvasCmd = (string | number | boolean | number[][])[]
export type MapItem = {
  kind: 'circle' | 'marker' | 'line'
  loc?: [number, number]
  locs?: [number, number][]
  radius?: number
  popup?: string | null
  tooltip?: string | null
  color?: string
  fillColor?: string
  fill?: boolean
  fillOpacity?: number
  weight?: number
  opacity?: number
}
export type MapData = { center: [number, number]; zoom: number; items: MapItem[] }

export type Media = {
  images?: string[]
  canvas?: { width: number; height: number; frame: CanvasCmd[]; animated?: boolean }
  maps?: MapData[]
}

export type ExecResult = Media & {
  ok: boolean
  stdout: string
  error: PyError | null
  needs: 'input' | 'key' | null
  prompt: string
  timeout?: boolean
  fatal?: string
}

export type CheckResult = { violations: Violation[]; chars: number; lines: number; syntax: PyError | null; stubs: string[] }

export type TestReport = {
  results: TestResult[]
  violations: Violation[]
  loadError: PyError | null
  loadTimeout: boolean
  syntax: PyError | null
  stubs: string[]
  chars: number
  lines: number
  allPassed: boolean
}

/* ---------------------------------------------------------------- data files */

const dataFiles = import.meta.glob('/content/data/*', { query: '?raw', import: 'default' }) as Record<
  string,
  () => Promise<string>
>

export async function loadDataFile(name: string): Promise<string> {
  const loader = dataFiles[`/content/data/${name}`]
  if (!loader) throw new Error(`missing data file ${name}`)
  return loader()
}

export async function resolveFiles(files: Record<string, string> | undefined): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(files ?? {})) {
    out[name] = value.startsWith('@data/') ? await loadDataFile(value.slice(6)) : value
  }
  return out
}

/* ---------------------------------------------------------------- calls */

const timeoutError: PyError = { type: 'Timeout', message: '', line: null, line_text: '', detail: {}, trace: '' }

export async function checkCode(code: string, constraints: (Constraints | undefined)[] = []): Promise<CheckResult> {
  const r = await engine.call<CheckResult>('check', { code, constraints_list: constraints.filter(Boolean) }, 5000)
  if (r === TIMEOUT) return { violations: [], chars: code.trim().length, lines: 0, syntax: null, stubs: [] }
  return r
}

export type ExecOptions = {
  code: string
  stdin?: string[]
  inputs?: string[]
  keys?: string[]
  interactive?: boolean
  files?: Record<string, string>
  given_code?: string
  seed?: number
  keep?: string
  packages?: string[]
  timeoutMs?: number
}

export async function runProgram(opts: ExecOptions): Promise<ExecResult> {
  const { timeoutMs, ...payload } = opts
  const r = await engine.call<ExecResult>('exec', payload, timeoutMs ?? RUN_TIMEOUT)
  if (r === TIMEOUT)
    return { ok: false, stdout: '', error: timeoutError, needs: null, prompt: '', timeout: true }
  if (r.fatal) return { ok: false, stdout: '', error: { ...timeoutError, type: 'Fatal', message: r.fatal }, needs: null, prompt: '' }
  return r
}

export type LevelTestInput = {
  code: string
  tests: (TestCase & { hidden?: boolean })[]
  statistical?: StatTest[]
  seed?: number
  files?: Record<string, string>
  given_code?: string
  constraints?: (Constraints | undefined)[]
  packages?: string[]
  perTestMs?: number
  ns?: string
  onResult?: (r: TestResult, index: number) => void
}

/** Full pipeline: syntax + AST constraints, load, each test with its own timeout, statistical tests. */
export async function runLevelTests(input: LevelTestInput): Promise<TestReport> {
  const ns = input.ns ?? 'level'
  const check = await checkCode(input.code, input.constraints)
  const base = {
    violations: check.violations,
    syntax: check.syntax,
    stubs: check.stubs,
    chars: check.chars,
    lines: check.lines,
  }
  if (check.syntax) {
    return { ...base, results: [], loadError: check.syntax, loadTimeout: false, allPassed: false }
  }
  const loadPayload = { code: input.code, files: input.files, given_code: input.given_code ?? '', ns, packages: input.packages }
  const scriptsOnly = input.tests.length > 0 && input.tests.every((t) => t.script) && !(input.statistical ?? []).length
  const load = async () =>
    scriptsOnly
      ? { ok: true, error: null, stdout: '' }
      : engine.call<{ ok: boolean; error: PyError | null; stdout: string }>('load', loadPayload, 8000)
  let loaded = await load()
  if (loaded === TIMEOUT) {
    return { ...base, results: [], loadError: timeoutError, loadTimeout: true, allPassed: false }
  }
  if (loaded.error) {
    return { ...base, results: [], loadError: loaded.error, loadTimeout: false, allPassed: false }
  }
  const results: TestResult[] = []
  let timeouts = 0
  for (const [i, t] of input.tests.entries()) {
    const { hidden, ...test } = t
    if (timeouts >= 2) {
      const r: TestResult = { call: test.call ?? '(programme)', label: test.label, fn: test.fn, passed: false, stdout: '', error: timeoutError, reason: 'skipped', hidden }
      results.push(r)
      input.onResult?.(r, i)
      continue
    }
    const ms = test.timeout_ms ?? input.perTestMs ?? TEST_TIMEOUT
    const r = await engine.call<TestResult>(
      'test',
      { ns, test, code: input.code, seed: input.seed, given_code: input.given_code ?? '', files: input.files },
      ms,
    )
    let res: TestResult
    if (r === TIMEOUT) {
      timeouts++
      res = { call: test.call ?? '(programme)', label: test.label, fn: test.fn, passed: false, stdout: '', error: timeoutError, reason: 'timeout', hidden }
      loaded = await load()
    } else {
      res = { ...r, hidden }
    }
    results.push(res)
    input.onResult?.(res, i)
  }
  for (const [j, st] of (input.statistical ?? []).entries()) {
    const r = await engine.call<TestResult>('stat', { ns, stat: st, code: input.code }, 15000)
    const res: TestResult =
      r === TIMEOUT
        ? { call: st.expr, label: st.label, fn: st.fn, passed: false, stdout: '', error: timeoutError, reason: 'timeout', stat: true }
        : r
    results.push(res)
    input.onResult?.(res, input.tests.length + j)
  }
  const allPassed = results.every((r) => r.passed) && check.violations.length === 0
  return { ...base, results, loadError: null, loadTimeout: false, allPassed }
}

/** Evaluate an expression in a loaded namespace (live games powered by the student's code). */
export async function pyCall<T = unknown>(
  expr: string,
  opts: { ns?: string; exec?: string; seed?: number; media?: boolean; timeoutMs?: number } = {},
): Promise<{ ok: boolean; value?: T; repr?: string; stdout?: string; error?: PyError | null; timeout?: boolean } & Media> {
  const r = await engine.call<{ ok: boolean; value?: T; repr?: string; stdout?: string; error?: PyError | null } & Media>(
    'call',
    { ns: opts.ns ?? 'level', expr, exec: opts.exec, seed: opts.seed, media: opts.media },
    opts.timeoutMs ?? TEST_TIMEOUT,
  )
  if (r === TIMEOUT) return { ok: false, timeout: true, error: timeoutError }
  return r
}

export async function loadNamespace(code: string, ns: string, extra: { files?: Record<string, string>; given_code?: string } = {}) {
  const r = await engine.call<{ ok: boolean; error: PyError | null; stdout: string }>(
    'load',
    { code, ns, files: extra.files, given_code: extra.given_code ?? '' },
    8000,
  )
  if (r === TIMEOUT) return { ok: false, error: timeoutError, stdout: '' }
  return r
}

export async function nextFrame(n = 1) {
  const r = await engine.call<{ ok: boolean; frame: CanvasCmd[]; error: PyError | null }>('frame', { n }, 2000)
  if (r === TIMEOUT) return { ok: false, frame: [], error: timeoutError }
  return r
}

export async function traceCode(code: string, watch: string[], max_rows: number) {
  const r = await engine.call<{ rows: Record<string, string>[]; truncated: boolean; stdout: string; error: PyError | null }>(
    'trace',
    { code, watch, max_rows },
    RUN_TIMEOUT,
  )
  if (r === TIMEOUT) return { rows: [], truncated: false, stdout: '', error: timeoutError }
  return r
}

export async function evalTruth(expr: string, rows: Record<string, unknown>[]) {
  const r = await engine.call<{ ok: boolean; values?: unknown[]; error?: PyError }>('truth', { expr, rows }, 3000)
  if (r === TIMEOUT) return { ok: false, error: timeoutError }
  return r
}

export type RobotRun = {
  success: boolean
  reason: string | null
  error: PyError | null
  actions: [number, number, string, string][]
  steps: number
  stdout: string
}
export async function runRobot(code: string, grids: string[][], max_steps: number) {
  const r = await engine.call<{ results: RobotRun[]; success: boolean }>('robot', { code, grids, max_steps }, 8000)
  if (r === TIMEOUT) return null
  return r
}

export async function runWriteTest(code: string, impls: { label: string; code: string }[]) {
  const r = await engine.call<{ ok: boolean; error?: PyError; results: { label: string; passed: boolean; failure: PyError | null }[] }>(
    'write_test',
    { code, impls },
    10000,
  )
  if (r === TIMEOUT) return null
  return r
}
