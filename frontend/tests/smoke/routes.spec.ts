import { test, expect } from '@playwright/test'
import { ROUTES, attachErrorCollectors, markUnverified } from '../helpers'

test.describe('Route smoke — public, protected and admin routes', () => {
  // One test per route: an isolated navigation crash cannot cascade or flake
  // other routes (earlier single-test/40-step version produced ERR_ABORTED).
  for (const route of ROUTES) {
    test(`GET ${route.path} (${route.visibility}) resolves without crash`, async ({ page }) => {
      const { pageErrors } = attachErrorCollectors(page)

      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' })

      // SPA always serves 200 (or redirect for /reset-password / admin).
      expect(response?.status(), `${route.path} HTTP status`).toBeLessThan(400)

      // Wait for the router to settle.
      await page.waitForTimeout(1_200)

      if (
        (route.visibility === 'protected' || route.visibility === 'admin') &&
        route.expect === 'login-redirect'
      ) {
        // Unauthenticated protected routes must redirect to /login.
        const currentUrl = page.url()
        expect(
          currentUrl.includes('/login'),
          `${route.path} should redirect to /login, got ${currentUrl}`,
        ).toBeTruthy()
      } else {
        // Public routes must render content (no blank screen).
        const body = page.locator('body')
        await expect(body).not.toBeEmpty()
        const blank = (await body.innerText()).trim().length === 0
        expect(blank, `${route.path} rendered a blank screen`).toBeFalsy()
      }

      // No uncaught page exceptions.
      expect(pageErrors, `${route.path} page errors: ${pageErrors.join(' | ')}`).toEqual([])
    })
  }

  test('route map sanity — /signup and /startups do not exist as routes (app uses /register, /explore)', async ({ page }) => {
    const errors = attachErrorCollectors(page)
    // A non-existent SPA route falls through to the NotFound catch-all (200 SPA).
    await page.goto('/signup', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1_000)
    markUnverified(
      test.info(),
      'No /signup route exists; create-account lives at /register. No /startups route exists; startup listing lives at /explore.',
    )
    // It must not crash even if it is the NotFound page.
    expect(errors.pageErrors).toEqual([])
  })
})
