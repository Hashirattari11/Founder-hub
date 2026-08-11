import type { Page } from '@playwright/test'

/**
 * Shared QA helpers — error collectors + route registry.
 */

export interface RouteSpec {
  path: string
  visibility: 'public' | 'protected' | 'admin'
  /** Optional: what an unauthenticated user must see on protected routes. */
  expect?: 'login-redirect' | 'page'
  /** Optional human note surfaced in the QA report. */
  note?: string
}

/**
 * Route registry (derived from src/App.tsx). No /signup and no /startups
 * routes exist in the app — /register and /explore are the real paths.
 */
export const ROUTES: RouteSpec[] = [
  { path: '/', visibility: 'public', expect: 'page', note: 'Landing page' },
  { path: '/login', visibility: 'public', expect: 'page' },
  { path: '/register', visibility: 'public', expect: 'page', note: '/signup does not exist — /register is the create-account route' },
  { path: '/auth/callback', visibility: 'public', expect: 'page', note: 'Shows loading/error state; real exchange needs a live code' },
  { path: '/forgot-password', visibility: 'public', expect: 'page' },
  { path: '/reset-password', visibility: 'public', expect: 'login-redirect', note: 'Redirects to /forgot-password without a session' },
  { path: '/profile/janedoe', visibility: 'public', expect: 'page', note: 'Public profile view (needs existing username in DB)' },
  { path: '/terms', visibility: 'public', expect: 'page' },
  { path: '/privacy', visibility: 'public', expect: 'page' },
  { path: '/cookies', visibility: 'public', expect: 'page' },
  { path: '/about', visibility: 'public', expect: 'page' },
  { path: '/contact', visibility: 'public', expect: 'page' },
  { path: '/legal', visibility: 'public', expect: 'page' },
  { path: '/community-guidelines', visibility: 'public', expect: 'page' },
  { path: '/acceptable-use', visibility: 'public', expect: 'page' },
  { path: '/intellectual-property', visibility: 'public', expect: 'page' },
  { path: '/security', visibility: 'public', expect: 'page' },
  { path: '/disclaimer', visibility: 'public', expect: 'page' },
  { path: '/investor-disclaimer', visibility: 'public', expect: 'page' },
  { path: '/refund-policy', visibility: 'public', expect: 'page' },

  { path: '/dashboard', visibility: 'protected', expect: 'login-redirect' },
  { path: '/explore', visibility: 'protected', expect: 'login-redirect', note: 'Startup listing lives at /explore, not /startups' },
  { path: '/startups/example', visibility: 'protected', expect: 'login-redirect', note: 'Startup detail is protected' },
  { path: '/jobs', visibility: 'protected', expect: 'login-redirect' },
  { path: '/jobs/post', visibility: 'protected', expect: 'login-redirect' },
  { path: '/community', visibility: 'protected', expect: 'login-redirect' },
  { path: '/messages', visibility: 'protected', expect: 'login-redirect' },
  { path: '/connections', visibility: 'protected', expect: 'login-redirect' },
  { path: '/meetings', visibility: 'protected', expect: 'login-redirect' },
  { path: '/book-meeting/some-user', visibility: 'protected', expect: 'login-redirect' },
  { path: '/notifications', visibility: 'protected', expect: 'login-redirect' },
  { path: '/complete-profile', visibility: 'protected', expect: 'login-redirect' },
  { path: '/onboarding', visibility: 'protected', expect: 'login-redirect' },

  { path: '/admin/dashboard', visibility: 'admin', expect: 'login-redirect', note: 'Unauthenticated -> /login; non-admin -> /dashboard' },
  { path: '/admin/users', visibility: 'admin', expect: 'login-redirect' },
  { path: '/admin/role-requests', visibility: 'admin', expect: 'login-redirect' },
]

/** Wire console + page error collectors onto a page. Call before navigation. */
export function attachErrorCollectors(page: Page) {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const failedRequests: string[] = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText ?? 'unknown'}`)
  })

  return { consoleErrors, pageErrors, failedRequests }
}

export const QA_TARGET = process.env.BASE_URL ?? 'http://localhost:5173'

export function markUnverified(testInfo: { annotations: { type: string; description?: string }[] }, reason: string) {
  testInfo.annotations.push({ type: 'UNVERIFIED', description: reason })
}
