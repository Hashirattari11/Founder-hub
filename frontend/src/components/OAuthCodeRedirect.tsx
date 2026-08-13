import { useLayoutEffect } from 'react'

const OAUTH_INTENT_KEY = 'founderhub:oauth:intent'
const OAUTH_NEXT_KEY = 'founderhub:oauth:next'

/** Persist OAuth intent across redirects when Supabase strips query params. */
export function stashOAuthIntent(intent: string | null, next?: string | null): void {
  try {
    if (intent) sessionStorage.setItem(OAUTH_INTENT_KEY, intent)
    else sessionStorage.removeItem(OAUTH_INTENT_KEY)
    if (next) sessionStorage.setItem(OAUTH_NEXT_KEY, next)
    else sessionStorage.removeItem(OAUTH_NEXT_KEY)
  } catch {
    /* ignore */
  }
}

export function popOAuthIntent(): { intent: string | null; next: string | null } {
  let intent: string | null = null
  let next: string | null = null
  try {
    intent = sessionStorage.getItem(OAUTH_INTENT_KEY)
    next = sessionStorage.getItem(OAUTH_NEXT_KEY)
    sessionStorage.removeItem(OAUTH_INTENT_KEY)
    sessionStorage.removeItem(OAUTH_NEXT_KEY)
  } catch {
    /* ignore */
  }
  return { intent, next }
}

function buildCallbackUrl(from: URL): string {
  const params = new URLSearchParams(from.search)
  if (!params.get('intent')) {
    try {
      const stored = sessionStorage.getItem(OAUTH_INTENT_KEY)
      if (stored) params.set('intent', stored)
    } catch {
      /* ignore */
    }
  }
  return `/auth/callback?${params.toString()}`
}

/**
 * Supabase may redirect to Site URL root (`/?code=`) instead of `/auth/callback`.
 * Run synchronously before React mounts so the landing page never wins the race.
 * Returns true when a redirect was started (caller should skip rendering).
 */
export function bootstrapOAuthCallbackRedirect(): boolean {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  if (!code || url.pathname.startsWith('/auth/callback')) return false
  window.location.replace(buildCallbackUrl(url))
  return true
}

/** React fallback if bootstrap did not run (e.g. client navigation with ?code=). */
export function OAuthCodeRedirect() {
  useLayoutEffect(() => {
    bootstrapOAuthCallbackRedirect()
  }, [])
  return null
}
