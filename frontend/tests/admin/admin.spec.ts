import { test, expect } from '@playwright/test'
import { markUnverified } from '../helpers'

test.describe('Admin', () => {
  const adminRoutes = [
    '/admin/dashboard',
    '/admin/users',
    '/admin/startups',
    '/admin/investors',
    '/admin/role-requests',
    '/admin/messages',
    '/admin/reports',
    '/admin/notifications',
    '/admin/emails',
    '/admin/analytics',
    '/admin/settings',
  ]

  test('all admin routes are blocked for unauthenticated users (redirect to /login)', async ({ page }) => {
    for (const path of adminRoutes) {
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1_200)
      expect(page.url(), `${path} should redirect to /login`).toContain('/login')
    }
  })

  test('admin functionality requires an admin account', async ({ page }, testInfo) => {
    const adminEmail = process.env.E2E_ADMIN_EMAIL
    const adminPassword = process.env.E2E_ADMIN_PASSWORD
    if (!adminEmail || !adminPassword) {
      markUnverified(
        testInfo,
        'E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set — admin panels (dashboard, users, startups, investors, role requests, messages, reports, notifications, email logs, analytics, settings) cannot be exercised. Access control verified above; backend endpoints require RequireAdmin (service role).',
      )
      test.skip()
      return
    }
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.getByLabel(/Email/i).fill(adminEmail)
    await page.getByLabel(/Password/i).fill(adminPassword)
    await page.getByRole('button', { name: /Sign In/i }).click()
    await page.waitForURL('**/dashboard**', { timeout: 20_000 })

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2_000)
    // Admin should reach the admin dashboard, not be bounced.
    expect(page.url()).toContain('/admin')
  })

  test('role-request approval pipeline (email contract)', async ({ page }, testInfo) => {
    markUnverified(
      testInfo,
      'Full approve/reject flow needs an admin + a pending role request. Backend contract code-reviewed: admin_approve_role_request -> notify(... role_approved) and admin_reject_role_request -> notify(... role_rejected) both enqueue emails via the Brevo queue.',
    )
    test.skip()
  })
})
