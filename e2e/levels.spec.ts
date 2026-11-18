import { expect, test } from '@playwright/test'
import { freshProfile, level, setCode, bossSolution } from './helpers'

test.describe('PyArcade — parcours critiques', () => {
  test('accueil : Python se charge et le bouton Jouer ouvre le premier niveau', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await expect(page.getByText(/Python est prêt/)).toBeVisible({ timeout: 90_000 })
    await page.getByRole('button', { name: /Jouer/ }).click()
    await expect(page).toHaveURL(/level\/w0-l01/)
  })

  test('mini-leçon : modifier et exécuter valide le niveau', async ({ page }) => {
    await freshProfile(page, false)
    await page.goto('/#/level/w0-l01')
    await setCode(page, 'print("Bonjour, PyArcade !")\n')
    await page.getByRole('button', { name: /Exécuter/ }).first().click()
    await page.getByRole('button', { name: /J’ai compris/ }).click()
    await expect(page.getByText('Niveau réussi !')).toBeVisible()
  })

  test('Code Fill : la solution passe tous les tests, un mauvais code est expliqué', async ({ page }) => {
    await freshProfile(page)
    await page.goto('/#/level/w1-l04')
    await setCode(page, 'def is_adult(age):\n    print(age >= 18)\n')
    await page.getByRole('button', { name: /Lancer les tests/ }).click()
    await expect(page.getByText(/Tu affiches au lieu de renvoyer/).first()).toBeVisible()
    await setCode(page, level('w1-l04').solution)
    await page.getByRole('button', { name: /Lancer les tests/ }).click()
    await expect(page.getByText('Niveau réussi !')).toBeVisible()
  })

  test('boucle infinie : le worker est relancé avec un message clair', async ({ page }) => {
    await freshProfile(page)
    await page.goto('/#/level/w4-l03')
    await setCode(page, 'def countdown(n):\n    result = []\n    while n > 0:\n        result.append(n)\n    return result\n')
    await page.getByRole('button', { name: /Lancer les tests/ }).click()
    await expect(page.getByText(/Ta boucle ne s’arrête jamais/).first()).toBeVisible({ timeout: 60_000 })
  })

  test('Devine la sortie', async ({ page }) => {
    await freshProfile(page)
    await page.goto('/#/level/w0-l02')
    await page.locator('#predict-answer').fill(level('w0-l02').answer)
    await page.getByRole('button', { name: /Valider/ }).click()
    await expect(page.getByText('Niveau réussi !')).toBeVisible()
  })

  test('Puzzle de Parsons', async ({ page }) => {
    await freshProfile(page)
    await page.goto('/#/level/w1-l06')
    const lines: string[] = level('w1-l06').lines
    for (const l of lines) {
      const text = l.trim()
      await page.locator('.card').filter({ hasText: 'Lignes mélangées' }).getByText(text, { exact: true }).first().click()
      const indent = (l.length - l.trimStart().length) / 4
      for (let i = 0; i < indent; i++) await page.getByRole('button', { name: 'indenter', exact: true }).click()
    }
    await page.getByRole('button', { name: /Vérifier/ }).click()
    await expect(page.getByText('Niveau réussi !')).toBeVisible()
  })

  test('QCM éclair', async ({ page }) => {
    await freshProfile(page)
    const quiz = level('w0-l05')
    await page.goto('/#/level/w0-l05')
    await page.getByRole('button', { name: /C’est parti/ }).click()
    for (let i = 0; i < quiz.questions.length; i++) {
      const qText: string = await page.locator('.card .md').first().innerText()
      const q = quiz.questions.find((x: { q: string }) => qText.includes(x.q.replace(/`/g, '').slice(0, 12)))
      const choice: string = q ? q.choices[q.answer] : quiz.questions[0].choices[0]
      await page.getByRole('button', { name: new RegExp(choice.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/"/g, '.')) }).first().click()
      await page.waitForTimeout(800)
      const next = page.getByRole('button', { name: /Suivant/ })
      if (await next.isVisible()) await next.click()
    }
    await expect(page.getByText('Niveau réussi !')).toBeVisible()
  })

  test('Devine la couleur (lettres en double)', async ({ page }) => {
    await freshProfile(page)
    await page.goto('/#/level/wd-l12')
    const rounds = level('wd-l12').rounds as { secret: string; guess: string }[]
    for (const r of rounds) {
      const colors = await page.evaluate(
        ([g, s]) => {
          const res = Array(g.length).fill('grey')
          const left: Record<string, number> = {}
          for (let i = 0; i < s.length; i++) {
            if (g[i] === s[i]) res[i] = 'green'
            else left[s[i]] = (left[s[i]] ?? 0) + 1
          }
          for (let i = 0; i < g.length; i++) if (res[i] !== 'green' && (left[g[i]] ?? 0) > 0) { res[i] = 'yellow'; left[g[i]]-- }
          return res
        },
        [r.guess, r.secret],
      )
      const tiles = page.locator('button[aria-label*=" : "]')
      for (let i = 0; i < colors.length; i++) {
        const clicks = { grey: 0, yellow: 1, green: 2 }[colors[i] as 'grey' | 'yellow' | 'green']
        for (let k = 0; k < clicks; k++) await tiles.nth(i).click()
      }
      await page.getByRole('button', { name: /Valider les couleurs/ }).click()
      await page.waitForTimeout(1200)
    }
    await expect(page.getByText('Niveau réussi !')).toBeVisible()
  })

  test('boss Wordle : la solution bat le boss et le jeu en direct utilise le code', async ({ page }) => {
    await freshProfile(page)
    await page.goto('/#/level/boss-wordle-guided')
    await setCode(page, bossSolution('boss-wordle-guided'))
    await page.getByRole('button', { name: /Attaquer/ }).click()
    await expect(page.getByText(/Ce jeu tourne avec tes 15 fonctions/)).toBeVisible({ timeout: 90_000 })
    await expect(page.getByRole('button', { name: 'q', exact: true })).toBeVisible({ timeout: 30_000 })
    await page.getByText(/Boss vaincu/).click()
    for (const c of 'slate') await page.keyboard.press(c)
    await page.keyboard.press('Enter')
    await expect(page.locator('[role=row]').first().locator('div').first()).toHaveText('s', { timeout: 15_000 })
  })
})
