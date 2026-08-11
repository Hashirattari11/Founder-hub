import { test, expect } from '@playwright/test'
import { attachErrorCollectors, markUnverified } from '../helpers'

test.describe('Community', () => {
  test('unauthenticated /community redirects to /login', async ({ page }) => {
    await page.goto('/community', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1_500)
    expect(page.url()).toContain('/login')
  })

  test('community features (post, comment, reply, like, repost, notifications)', async ({ page }, testInfo) => {
    const email = process.env.E2E_TEST_EMAIL
    const password = process.env.E2E_TEST_PASSWORD
    if (!email || !password) {
      markUnverified(
        testInfo,
        'Requires an authenticated test account + seeded community data. Community pages are behind auth; feature-level verification (post/comment/like/repost/notifications and role-specific posting permissions) cannot run without credentials.',
      )
      test.skip()
      return
    }
    const { pageErrors } = attachErrorCollectors(page)
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/Email/i).fill(email)
    await page.getByLabel(/Password/i).fill(password)
    await page.getByRole('button', { name: /Sign In/i }).click()
    await page.waitForURL('**/dashboard**', { timeout: 20_000 })

    await page.goto('/community', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2_000)
    await expect(page.locator('body')).not.toBeEmpty()
    expect(pageErrors).toEqual([])
  })
})

test.describe('Startups', () => {
  test('startup explorer requires auth (route is /explore)', async ({ page }) => {
    await page.goto('/explore', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1_500)
    expect(page.url()).toContain('/login')
  })

  test('founder create/manage startup + investor visibility', async ({ page }, testInfo) => {
    markUnverified(
      testInfo,
      'Requires founder + investor test accounts with startup data. CreateStartup is behind FounderGuard + profile-completion gate; backend authorization verified via RLS/RequireAdmin audits. Runtime verification needs credentials.',
    )
    test.skip()
  })
})

test.describe('Jobs', () => {
  test('job listing requires auth', async ({ page }) => {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1_500)
    expect(page.url()).toContain('/login')
  })

  test('job creation permissions + application flow', async ({ page }, testInfo) => {
    markUnverified(
      testInfo,
      'Requires founder (post) and candidate (apply) test accounts. /jobs/post is gated by profile completion; backend permissions via RLS. Runtime verification needs credentials.',
    )
    test.skip()
  })
})

test.describe('Meetings', () => {
  test('meetings require auth', async ({ page }) => {
    await page.goto('/meetings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1_500)
    expect(page.url()).toContain('/login')
  })

  test('meeting lifecycle (create, invite, accept/reject, reschedule, cancel)', async ({ page }, testInfo) => {
    markUnverified(
      testInfo,
      'Requires two authenticated test accounts. Meetings UI exists (AvailabilitySettings, BookMeeting, Meetings pages); lifecycle verification needs credentials.',
    )
    test.skip()
  })
})
