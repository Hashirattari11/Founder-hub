import { useEffect } from 'react'

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

/**
 * Supabase sometimes redirects to Site URL root (`/?code=`) instead of
 * `/auth/callback?code=` when the exact redirect URL is not allowlisted.
 * Forward to the callback route on the same origin so PKCE exchange can run.
 */
export function OAuthCodeRedirect() {
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    if (!code || url.pathname.startsWith('/auth/callback')) return

    const params = new URLSearchParams(url.search)
    if (!params.get('intent')) {
      try {
        const stored = sessionStorage.getItem(OAUTH_INTENT_KEY)
        if (stored) params.set('intent', stored)
      } catch {
        /* ignore */
      }
    }
    window.location.replace(`/auth/callback?${params.toString()}`)
  }, [])

  return null
}
