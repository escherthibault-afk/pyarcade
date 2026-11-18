import type { BossLevel } from '../content/schema'
import type { TestReport } from '../engine/api'

export type GradeRow = { fn: string; max: number; passed: number; total: number; signature: boolean; readability: boolean; notes: string[]; score: number }
export type ExamGrade = { total: number; rows: GradeRow[] }

function signatureOf(code: string, fn: string): string | null {
  const m = code.match(new RegExp(`^def\\s+${fn}\\s*\\(([^)]*)\\)`, 'm'))
  return m ? m[1].replace(/\s+/g, '') : null
}

function bodyOf(code: string, fn: string): string[] {
  const lines = code.split('\n')
  const start = lines.findIndex((l) => new RegExp(`^def\\s+${fn}\\s*\\(`).test(l))
  if (start < 0) return []
  const out: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim() && !/^\s/.test(l)) break
    out.push(l)
  }
  return out
}

/**
 * Exam rubric per function (points from the YAML):
 * 70 % tests (correctness + edge cases), 15 % exact signature, 15 % readability
 * (docstring kept, no stray print when a value is returned, reasonable length).
 */
export function gradeExam(level: BossLevel, code: string, report: TestReport): ExamGrade {
  const rows: GradeRow[] = level.steps.map((s) => {
    const results = report.results.filter((r) => r.fn === s.fn)
    const total = results.length || 1
    const passed = report.loadError ? 0 : results.filter((r) => r.passed).length
    const refSig = signatureOf(s.solution, s.fn)
    const sig = signatureOf(code, s.fn)
    const signature = sig !== null && sig === refSig
    const body = bodyOf(code, s.fn)
    const refBody = bodyOf(s.solution, s.fn)
    const notes: string[] = []
    const hasDoc = /^\s+("""|''')/.test(body.find((l) => l.trim()) ?? '')
    if (refBody.some((l) => /"""|'''/.test(l)) && !hasDoc) notes.push('docstring supprimée')
    const codeLines = body.filter((l) => l.trim() && !l.trim().startsWith('#')).length
    const refLines = refBody.filter((l) => l.trim() && !l.trim().startsWith('#')).length
    if (codeLines > Math.max(8, refLines * 2.5)) notes.push('très long')
    if (!refBody.some((l) => /\bprint\(/.test(l)) && body.some((l) => /\bprint\(/.test(l))) notes.push('print oublié')
    if (body.length && body.every((l) => !l.trim() || /^\s+(pass|"""|'''|#)/.test(l) || /^\s+[A-Za-z].*"""$/.test(l))) notes.push('non traitée')
    const readability = notes.length === 0 && sig !== null
    const testsPart = 0.7 * (passed / total)
    const score = s.points * (testsPart + (signature ? 0.15 : 0) + (readability && passed > 0 ? 0.15 : 0))
    return { fn: s.fn, max: s.points, passed, total: results.length, signature, readability, notes, score: Math.round(score * 4) / 4 }
  })
  // the rubric is always brought back to /20 (twins used as final exams may have another total)
  const maxTotal = rows.reduce((a, r) => a + r.max, 0) || 1
  const raw = rows.reduce((a, r) => a + r.score, 0)
  const total = Math.round(((raw * 20) / maxTotal) * 4) / 4
  return { total: Math.min(20, total), rows }
}
