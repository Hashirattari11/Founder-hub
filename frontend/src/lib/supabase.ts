import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and anon key must be configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
}

/**
 * The public origin of this deployment. Always derived from the browser
 * location so Google OAuth works identically on localhost, staging and
 * production without any hardcoded domain.
 */
export const APP_URL = window.location.origin

const AUTH_REDIRECT_KEY = 'founderhub:auth:redirect'

/** Persist the path the user wanted before auth so OAuth redirects can restore it. */
export function stashAuthRedirect(path: string | null): void {
  try {
    if (path) sessionStorage.setItem(AUTH_REDIRECT_KEY, path)
    else sessionStorage.removeItem(AUTH_REDIRECT_KEY)
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Pop (and clear) the stored redirect path, falling back to `/dashboard`. */
export function popAuthRedirect(fallback = '/dashboard'): string {
  let path = fallback
  try {
    path = sessionStorage.getItem(AUTH_REDIRECT_KEY) || fallback
    sessionStorage.removeItem(AUTH_REDIRECT_KEY)
  } catch {
    /* ignore */
  }
  if (!path.startsWith('/')) path = fallback
  return path
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'founderhub-auth',
    flowType: 'pkce',
  },
})
