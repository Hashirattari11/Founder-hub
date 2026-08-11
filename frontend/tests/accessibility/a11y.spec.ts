import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility checks on the major public pages. Violations are saved into
 * the Playwright HTML report via test attachments and fail the run.
 */
const PUBLIC_PAGES = ['/', '/login', '/register', '/forgot-password', '/terms', '/privacy', '/contact']

test.describe('Accessibility (axe-core)', () => {
  for (const path of PUBLIC_PAGES) {
    test(`a11y: ${path} has no critical/serious violations`, async ({ page }) => {
      // axe on large pages (landing 3D scene, legal docs) can exceed 60s.
      test.setTimeout(180_000)
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForLoadState('networkidle').catch(() => {})
      await page.waitForTimeout(800)

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      // Save violations into the HTML report.
      await test.info().attach(`axe-${path.replace(/\//g, '_') || 'home'}`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: 'application/json',
      })

      const criticalSerious = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      )
      expect(
        criticalSerious,
        `${path} axe violations (critical/serious):\n` +
          criticalSerious.map((v) => `  [${v.impact}] ${v.id}: ${v.help}`).join('\n'),
      ).toEqual([])
    })
  }

  test('a11y: auth forms have labeled inputs', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    const results = await new AxeBuilder({ page })
      .withRules(['label', 'label-title-only', 'button-name', 'link-name'])
      .analyze()
    expect(results.violations).toEqual([])
  })
})
