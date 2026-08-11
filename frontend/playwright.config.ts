import { defineConfig, devices } from '@playwright/test'

/**
 * FounderHub automated QA configuration.
 *
 * Target selection (no hardcoded URLs in tests):
 *   BASE_URL              Target app (defaults to the local Vite dev server)
 *                         - LOCAL:      leave unset  -> http://localhost:5173
 *                         - PRODUCTION: BASE_URL=https://founderhub.site
 *
 * Optional test credentials (never committed; set in your shell/.env):
 *   E2E_TEST_EMAIL        A regular test account (any role)
 *   E2E_TEST_PASSWORD
 *   E2E_ADMIN_EMAIL       An admin test account
 *   E2E_ADMIN_PASSWORD
 *
 * When credentials are absent, credential-requiring suites are reported as
 * UNVERIFIED instead of faking a pass (see .opencode/qa-report.md).
 */
const baseURL = process.env.BASE_URL ?? 'http://localhost:5173'
const isExplicitTarget = process.env.BASE_URL !== undefined

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 4 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Auto-start the Vite dev server ONLY for the default local target.
  // When BASE_URL is set (production), no local server is started.
  webServer: isExplicitTarget
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
