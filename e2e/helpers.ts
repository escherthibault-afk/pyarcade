import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function level(id: string) {
  const dirs = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11', 'w12', 'wordle', 'bosses', 'secret']
  for (const d of dirs) {
    try {
      return parse(readFileSync(join(ROOT, 'content', d, `${id}.yaml`), 'utf8'))
    } catch {
      /* next */
    }
  }
  throw new Error(`level ${id} not found`)
}

export function bossSolution(id: string): string {
  const l = level(id)
  return [l.header_code?.trimEnd(), ...l.steps.map((s: { solution: string }) => s.solution.trimEnd())].filter(Boolean).join('\n\n\n') + '\n'
}

/** Fresh profile with everything unlocked (to reach any level directly). */
export async function freshProfile(page: Page, unlockAll = true) {
  await page.goto('/')
  await page.evaluate((u) => {
    localStorage.clear()
    localStorage.setItem('pyarcade-v1', JSON.stringify({ state: { settings: { unlockAll: u, autoNext: false, sound: false, motion: 'reduce' } }, version: 1 }))
  }, unlockAll)
  await page.reload()
  await expect(page.getByText(/Python est prêt/)).toBeVisible({ timeout: 90_000 })
}

/** Replace the whole content of the first CodeMirror editor. */
export async function setCode(page: Page, code: string) {
  await page.waitForSelector('.cm-content')
  await page.evaluate((c) => {
    const el = document.querySelector('.cm-content') as HTMLElement & { cmTile?: { view: { state: { doc: { length: number } }; dispatch: (t: unknown) => void } } }
    const view = el.cmTile!.view
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: c } })
  }, code)
  await page.waitForTimeout(300)
}
