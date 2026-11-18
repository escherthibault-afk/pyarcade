/**
 * npm run verify-content
 *
 * For EVERY level: (a) the YAML matches the zod schema, (b) the solution passes 100% of the tests,
 * (c) the starter fails at least one test, (d) the solution respects the AST constraints,
 * (e) statistical tests pass 20 times in a row with different seeds.
 * Any failure exits with code 1 (blocks CI / the build).
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { LevelSchema, WorldsFile, type Level, type Tests } from '../src/content/schema'
import { applyVariant, bossFile } from '../src/content/variants'
import { evaluateGuess } from '../src/lib/wordle'
import { allBoolRows } from '../src/lib/truth'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, 'content')
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const verbose = process.argv.includes('-v')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === 'data' ? [] : walk(p)
    return /\.ya?ml$/.test(name) && name !== 'worlds.yaml' ? [p] : []
  })
}

function resolveFiles(files: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(files)) {
    out[name] = value.startsWith('@data/') ? readFileSync(join(CONTENT, 'data', value.slice(6)), 'utf8') : value
  }
  return out
}

function flatTests(t: Tests | undefined) {
  if (!t) return []
  return [...t.visible, ...t.hidden]
}

const problems: Record<string, string[]> = {}
const add = (id: string, msg: string) => (problems[id] ??= []).push(msg)

// ---- worlds.yaml
const worlds = WorldsFile.safeParse(parse(readFileSync(join(CONTENT, 'worlds.yaml'), 'utf8')))
if (!worlds.success) add('worlds.yaml', worlds.error.message)

// ---- levels
const levels: Level[] = []
const ids = new Set<string>()
for (const file of walk(CONTENT)) {
  const rel = relative(ROOT, file)
  let raw: unknown
  try {
    raw = parse(readFileSync(file, 'utf8'))
  } catch (e) {
    add(rel, `YAML parse error: ${(e as Error).message}`)
    continue
  }
  const parsed = LevelSchema.safeParse(raw)
  if (!parsed.success) {
    add(rel, `schema: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
    continue
  }
  const level = parsed.data
  if (ids.has(level.id)) add(rel, `duplicate id ${level.id}`)
  ids.add(level.id)
  if (!file.endsWith(`${level.id}.yaml`)) add(rel, `file name must be ${level.id}.yaml`)
  levels.push(level)
}

if (worlds.success) {
  const worldIds = new Set(worlds.data.worlds.map((w) => String(w.id)))
  for (const l of levels) if (!worldIds.has(String(l.world))) add(l.id, `unknown world ${l.world}`)
  for (const w of worlds.data.worlds)
    for (const b of w.bosses) if (!ids.has(b)) add('worlds.yaml', `world ${w.id}: unknown boss ${b}`)
}

// ---- python jobs
type Job = Record<string, unknown> & { id: string; kind: string }
const jobs: Job[] = []
for (const level0 of levels) {
  if (only.length && !only.some((o) => level0.id.includes(o))) continue
  const variants = level0.type === 'boss' && level0.variants.length ? level0.variants : [null]
  variants.forEach((variant, vi) => {
    const level = variant ? applyVariant(level0, variant.vars) : level0
    const id = variant ? `${level.id}#${vi}` : level.id
    const files = resolveFiles(level.files)
    switch (level.type) {
      case 'code_fill':
      case 'bug_hunt':
      case 'golf':
      case 'big_volume':
      case 'refactor':
      case 'assemble':
      case 'copy':
      case 'simulation': {
        const tests = flatTests(level.tests)
        if (!level.tests.visible.length) add(id, 'needs at least one visible test')
        const job: Job = {
          id,
          kind: level.type === 'simulation' ? 'simulation' : 'code',
          solution: level.solution,
          starter: level.starter_code,
          tests,
          seed: level.tests.random_seed,
          statistical: level.tests.statistical,
          constraints: [level.constraints],
          files,
          given_code: level.given_code,
        }
        if (level.type === 'simulation') Object.assign(job, { params: level.sim.params, driver: level.sim.driver })
        if (level.type === 'golf' && level.par_chars && level.solution.trim().length > level.par_chars)
          add(id, `golf solution (${level.solution.trim().length} chars) is above par_chars ${level.par_chars}`)
        if (level.type === 'bug_hunt' && !level.bugs) add(id, 'bug_hunt needs `bugs`')
        jobs.push(job)
        break
      }
      case 'boss': {
        const steps = level.steps.map((s) => ({
          fn: s.fn,
          tests: flatTests(s.tests).map((t) => ({ ...t, fn: s.fn })),
          statistical: s.tests.statistical.map((t) => ({ ...t, fn: s.fn })),
          constraints: s.constraints ? { ...s.constraints, scope: s.constraints.scope ?? s.fn } : undefined,
        }))
        const seeds = level.steps.map((s) => s.tests.random_seed).filter((x) => x !== undefined)
        jobs.push({
          id,
          kind: 'boss',
          solution: bossFile(level, 'solution'),
          starter: bossFile(level, 'starter_code'),
          steps,
          seed: seeds[0],
          files,
        })
        if (level.variant === 'exam') {
          const total = level.steps.reduce((a, s) => a + s.points, 0)
          if (Math.abs(total - 20) > 1e-6) add(id, `exam rubric must total 20 points (got ${total})`)
          if (!level.time_limit_minutes) add(id, 'exam needs time_limit_minutes')
        }
        break
      }
      case 'predict_output':
        jobs.push({ id, kind: 'predict', code: level.code, answer: level.answer, stdin: level.stdin, files })
        break
      case 'lesson':
        jobs.push({ id, kind: 'lesson', example_code: level.example_code, expected_output: level.expected_output, solution: level.solution, stdin: level.stdin, files })
        break
      case 'parsons':
        jobs.push({ id, kind: 'parsons', lines: level.lines, tests: flatTests(level.tests), seed: level.tests?.random_seed, files, given_code: level.given_code })
        break
      case 'trace':
        if ((level.code.match(/# @snap/g) ?? []).length < 1) add(id, 'trace code needs a `# @snap` marker')
        jobs.push({ id, kind: 'trace', code: level.code, watch: level.watch, max_rows: level.max_rows })
        break
      case 'truth_table': {
        const rows = level.rows ?? allBoolRows(level.vars)
        jobs.push({ id, kind: 'truth', solution: level.solution, rows })
        if (level.simple_len && level.solution.replace(/\s+/g, '').length > level.simple_len)
          add(id, 'solution longer than simple_len')
        break
      }
      case 'robot':
        jobs.push({ id, kind: 'robot', solution: level.solution, starter: level.starter_code, grids: level.grids, max_steps: level.max_steps, constraints: [level.constraints] })
        break
      case 'write_test':
        jobs.push({ id, kind: 'write_test', solution: level.solution, starter: level.starter_code, impls: level.implementations })
        if (!level.implementations.some((i) => i.correct)) add(id, 'needs one correct implementation')
        break
      case 'quiz':
        level.questions.forEach((q, i) => {
          if (q.answer >= q.choices.length) add(id, `question ${i}: answer index out of range`)
        })
        break
      case 'color_tiles':
        level.rounds.forEach((r, i) => {
          if (r.secret.length !== r.guess.length) add(id, `round ${i}: secret and guess lengths differ`)
          evaluateGuess(r.guess, r.secret)
        })
        break
    }
  })
}

const python = existsSync(join(ROOT, '.venv/bin/python')) ? join(ROOT, '.venv/bin/python') : 'python3'
const t0 = Date.now()
const tmp = mkdtempSync(join(tmpdir(), 'pyarcade-verify-'))
const jobsFile = join(tmp, 'jobs.json')
const reportFile = join(tmp, 'report.json')
writeFileSync(jobsFile, JSON.stringify(jobs))
const proc = spawnSync(python, [join(ROOT, 'scripts/verify_runner.py'), jobsFile, reportFile], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 1 << 28,
  timeout: 15 * 60 * 1000,
})
if (proc.status !== 0) {
  console.error(proc.stderr)
  console.error('❌ verify_runner.py crashed')
  process.exit(1)
}
const report = JSON.parse(readFileSync(reportFile, 'utf8')) as Record<string, string[]>
rmSync(tmp, { recursive: true, force: true })
for (const [id, errs] of Object.entries(report)) for (const e of errs) add(id, e)

const nLevels = levels.length
const byType = levels.reduce<Record<string, number>>((acc, l) => ((acc[l.type] = (acc[l.type] ?? 0) + 1), acc), {})
const bad = Object.keys(problems)
if (verbose || bad.length) {
  for (const id of bad) {
    console.log(`\n✗ ${id}`)
    for (const p of problems[id]) console.log(`   - ${p}`)
  }
}
console.log(
  `\n${bad.length ? '❌' : '✅'} ${nLevels} levels, ${jobs.length} python checks in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${bad.length} with problems`,
)
console.log('   by type:', Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(' '))
process.exit(bad.length ? 1 : 0)
