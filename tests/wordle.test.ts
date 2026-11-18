import { describe, expect, it } from 'vitest'
import { evaluateGuess, mergeKeyboard, dailyIndex, type Tile } from '../src/lib/wordle'

const s = (t: string): Tile[] => t.split('').map((c) => ({ G: 'green', Y: 'yellow', '-': 'grey' })[c] as Tile)

describe('evaluateGuess (two passes with a counter)', () => {
  const cases: [string, string, string][] = [
    ['crane', 'crane', 'GGGGG'],
    ['moist', 'crane', '-----'],
    ['paper', 'apple', 'YYGY-'],
    ['babes', 'abbey', 'YYGG-'],
    ['eerie', 'crane', '--Y-G'],
    ['lolly', 'hello', '-YGG-'],
    ['speed', 'abide', '--Y-Y'],
    ['allee', 'eagle', 'YY-YG'],
    ['robot', 'motor', 'YG-GY'],
    ['geese', 'eerie', '-GY-G'],
  ]
  it.each(cases)('%s vs %s', (guess, secret, expected) => {
    expect(evaluateGuess(guess, secret)).toEqual(s(expected))
  })
  it('is case insensitive', () => {
    expect(evaluateGuess('CRANE', 'crane')).toEqual(s('GGGGG'))
  })
})

describe('keyboard and daily word', () => {
  it('keeps the best colour per letter', () => {
    let kb = mergeKeyboard({}, 'crane', s('-Y--G'))
    kb = mergeKeyboard(kb, 'rouge', s('G----'))
    expect(kb.r).toBe('green')
    expect(kb.c).toBe('grey')
    expect(kb.e).toBe('green')
  })
  it('daily index is stable for a date', () => {
    expect(dailyIndex(new Date(2026, 10, 18, 8), 100)).toBe(dailyIndex(new Date(2026, 10, 18, 23), 100))
  })
})
