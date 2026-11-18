/** Runs the shared Python runner with CPython to check its behaviour. */
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')
const PY = existsSync(join(ROOT, '.venv/bin/python')) ? join(ROOT, '.venv/bin/python') : 'python3'

function py(requests: object[]) {
  const script = `
import sys, json
sys.path.insert(0, ${JSON.stringify(join(ROOT, 'src/python/shims'))})
sys.path.insert(0, ${JSON.stringify(join(ROOT, 'src/python'))})
import runner
out = [json.loads(runner.handle(json.dumps(r))) for r in json.load(sys.stdin)]
print(json.dumps(out))
`
  const r = spawnSync(PY, ['-c', script], { input: JSON.stringify(requests), encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr)
  return JSON.parse(r.stdout)
}

describe('python runner', () => {
  it('detects print instead of return, mutation and float/int confusion', () => {
    const code = 'def f(n):\n    print(n * 2)\n\ndef g(l):\n    l.append(1)\n    return len(l)\n\ndef h(n):\n    return n / 2\n'
    const [, a, b, c] = py([
      { cmd: 'load', code },
      { cmd: 'test', test: { call: 'f(2)', expected: '4' }, code },
      { cmd: 'test', test: { call: 'g([1])', expected: '2', pure: true }, code },
      { cmd: 'test', test: { call: 'h(4)', expected: '2' }, code },
    ])
    expect(a.reason).toBe('print_not_return')
    expect(b.reason).toBe('mutated_args')
    expect(c.reason).toBe('float_vs_int')
  })
  it('explains IndexError with index and length', () => {
    const code = 'def last(l):\n    return l[len(l)]\n'
    const [, t] = py([{ cmd: 'load', code }, { cmd: 'test', test: { call: 'last([1, 2, 3, 4])', expected: '4' }, code }])
    expect(t.error.type).toBe('IndexError')
    expect(t.error.detail).toMatchObject({ index: 4, length: 4 })
    expect(t.error.line).toBe(2)
  })
  it('compares floats with tolerance and lists strictly', () => {
    const code = 'def f():\n    return 0.1 + 0.2\n\ndef g():\n    return [1, 2]\n'
    const [, a, b] = py([
      { cmd: 'load', code },
      { cmd: 'test', test: { call: 'f()', expected: '0.3' }, code },
      { cmd: 'test', test: { call: 'g()', expected: '(1, 2)' }, code },
    ])
    expect(a.passed).toBe(true)
    expect(b.reason).toBe('list_vs_tuple')
  })
  it('checks AST constraints', () => {
    const [r] = py([{ cmd: 'check', code: 'class A:\n    pass\nx = sum([1])\n', constraints: { forbidden: ['ClassDef', 'call:sum'], required: ['While'] } }])
    expect(r.violations.map((v: { detail: string }) => v.detail).sort()).toEqual(['ClassDef', 'While', 'call:sum'])
  })
  it('replays interactive programs', () => {
    const [r] = py([{ cmd: 'exec', code: 'a = input("a? ")\nb = input("b? ")\nprint(a + b)', inputs: ['x'], interactive: true }])
    expect(r.needs).toBe('input')
    expect(r.prompt).toBe('b? ')
  })
  it('records trace rows and robot moves', () => {
    const [t, rb] = py([
      { cmd: 'trace', code: 's = 0\nfor i in range(3):\n    s += i  # @snap\n', watch: ['i', 's'] },
      { cmd: 'robot', code: 'while not at_goal():\n    move()\n', grids: [['#####', '#>.G#', '#####']] },
    ])
    expect(t.rows).toEqual([{ i: '0', s: '0' }, { i: '1', s: '1' }, { i: '2', s: '3' }])
    expect(rb.success).toBe(true)
  })
})
