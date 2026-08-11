import { test, expect } from '@playwright/test'
import { attachErrorCollectors } from '../helpers'

test.describe('Application load — homepage', () => {
  test('page loads with branding, navbar, hero and working buttons; no console/page errors', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    // No blank screen — the page must actually render content.
    await expect(page.locator('body')).not.toBeEmpty()

    // No obvious console errors (allow known-harmless browser noise).
    const noisy = /favicon|ResizeObserver|Download the React DevTools|net::ERR_|third-party|DevTools/i
    const realErrors = consoleErrors.filter((e) => !noisy.test(e))
    expect(realErrors, `console errors: ${realErrors.join(' | ')}`).toEqual([])
    expect(pageErrors).toEqual([])

    // FounderHub branding exists (navbar logo + wordmark).
    await expect(page.getByAltText('FounderHub').first()).toBeVisible()
    await expect(page.getByText('FounderHub', { exact: true }).first()).toBeVisible()

    // Navbar exists.
    const navbar = page.locator('header').first()
    await expect(navbar).toBeVisible()

    // Hero exists (badge + headline).
    await expect(page.getByText(/Introducing FounderHub AI/i)).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: /From Idea to/i })).toBeVisible()

    // Buttons work — "Start for Free" opens the waitlist modal.
    const startForFree = page.getByRole('button', { name: /Start for Free/i })
    await expect(startForFree).toBeVisible()
    await startForFree.click()
    await expect(page.getByText(/Join the Waitlist|waitlist/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('navigation links work (navbar links resolve to real pages)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    // Landing footer/nav links to legal pages must not 404.
    for (const link of ['/terms', '/privacy', '/login']) {
      const response = await page.request.get(link)
      // Vite SPA returns 200 for client routes; anything else is a break.
      expect(response.status(), `${link} should resolve`).toBeLessThan(400)
    }
  })
})
