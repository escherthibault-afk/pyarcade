import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, weekKey } from '../src/lib/dates'
import { playerLevel, titleFor, xpFor } from '../src/lib/xp'
import { allBoolRows } from '../src/lib/truth'
import { parseMarkup } from '../src/lib/richMarkup'
import { applyVariant, bossFile } from '../src/content/variants'
import { BossLevel } from '../src/content/schema'

describe('dates', () => {
  it('adds days across months', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2)
  })
  it('weekKey is Monday based', () => {
    expect(weekKey(new Date(2026, 10, 16))).toBe(weekKey(new Date(2026, 10, 22)))
    expect(weekKey(new Date(2026, 10, 15))).not.toBe(weekKey(new Date(2026, 10, 16)))
  })
})

describe('xp', () => {
  it('levels up and gives titles', () => {
    expect(playerLevel(0).level).toBe(1)
    expect(playerLevel(100).level).toBe(2)
    expect(titleFor(0)).toBe('Script Kiddie')
    expect(titleFor(1200)).toBe('Pythonista')
    expect(xpFor(20, 3, { copy: true })).toBe(48)
  })
})

describe('truth tables', () => {
  it('lists every combination', () => {
    expect(allBoolRows(['a', 'b'])).toEqual([
      { a: false, b: false },
      { a: false, b: true },
      { a: true, b: false },
      { a: true, b: true },
    ])
  })
})

describe('rich markup', () => {
  it('parses colours and backgrounds', () => {
    const segs = parseMarkup('[bold white on green] C [/][dim]x[/]y')
    expect(segs[0]).toEqual({ text: ' C ', style: { fontWeight: '700', color: '#f5f5f5', background: '#22c55e' } })
    expect(segs[2].text).toBe('y')
  })
})

describe('boss variants', () => {
  it('replaces placeholders and assembles the file', () => {
    const boss = BossLevel.parse({
      id: 'b',
      world: 'wordle',
      type: 'boss',
      variant: 'exam',
      project: 'wordle',
      title: 't',
      header_code: 'LENGTH = {{LEN}}',
      steps: [1, 2, 3].map((i) => ({ fn: `f${i}`, title: 'x', starter_code: `def f${i}():\n    pass`, solution: `def f${i}():\n    return {{LEN}}`, tests: { visible: [{ call: `f${i}()`, expected: '{{LEN}}' }] } })),
      variants: [{ label: 'six', vars: { LEN: 6 } }],
    })
    const v = applyVariant(boss, { LEN: 6 })
    expect(v.header_code).toBe('LENGTH = 6')
    expect(bossFile(v, 'solution')).toContain('return 6')
    expect(v.steps[0].tests.visible[0].expected).toBe('6')
  })
})
