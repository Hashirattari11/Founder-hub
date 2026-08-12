/**
 * Central error → user-friendly message mapping.
 * Never surface raw Supabase codes, HTTP statuses, or stack traces in the UI.
 */

export type ErrorContext =
  | 'auth'
  | 'profile'
  | 'startup'
  | 'upload'
  | 'job'
  | 'network'
  | 'permission'
  | 'notFound'
  | 'session'
  | 'generic'

const CONTEXT_DEFAULTS: Record<ErrorContext, string> = {
  auth: 'Please sign in to continue.',
  profile: "Couldn't save profile. Please try again.",
  startup: "Couldn't save startup. Please try again.",
  upload: 'Upload failed. Check file size and try again.',
  job: "Couldn't save job. Please try again.",
  network: 'Connection issue. Please try again.',
  permission: "You don't have access to this.",
  notFound: "This page doesn't exist.",
  session: 'Your session expired — Please sign in again.',
  generic: 'Something went wrong. Please try again.',
}

const TECHNICAL_PATTERNS: Array<{ test: RegExp; message: string }> = [
  { test: /permission denied/i, message: CONTEXT_DEFAULTS.permission },
  { test: /42501|PGRST42501/i, message: CONTEXT_DEFAULTS.permission },
  { test: /401|unauthorized/i, message: CONTEXT_DEFAULTS.auth },
  { test: /403|forbidden/i, message: CONTEXT_DEFAULTS.permission },
  { test: /404|not found/i, message: CONTEXT_DEFAULTS.notFound },
  { test: /500|internal server/i, message: 'Server issue. Please try again later.' },
  { test: /failed to fetch|networkerror|network error|load failed/i, message: CONTEXT_DEFAULTS.network },
  { test: /cors|cross-origin/i, message: 'Service temporarily unavailable.' },
  { test: /service temporarily unavailable/i, message: 'Service temporarily unavailable.' },
  { test: /invalid login credentials|invalid email or password/i, message: 'Wrong email or password. Please try again.' },
  { test: /email not confirmed|email confirmation/i, message: 'Please sign in to continue.' },
  { test: /user already registered|already registered|user_already_exists/i, message: 'Account already exists — Please sign in.' },
  { test: /jwt expired|token expired|session expired|refresh token/i, message: CONTEXT_DEFAULTS.session },
  { test: /pkce|code verifier/i, message: 'Sign-in link expired. Please try again.' },
  { test: /rate limit|too many requests/i, message: 'Too many requests. Please wait a minute and try again.' },
  { test: /\[object object\]/i, message: CONTEXT_DEFAULTS.generic },
  { test: /null is not an object|cannot read propert|undefined is not/i, message: CONTEXT_DEFAULTS.generic },
  { test: /unexpected token|not valid json/i, message: CONTEXT_DEFAULTS.network },
  { test: /PGRST205|could not find the table/i, message: CONTEXT_DEFAULTS.generic },
  { test: /duplicate key|unique constraint/i, message: 'This item already exists.' },
  { test: /terms of service and privacy policy must be accepted/i, message: 'Please accept the Terms of Service and Privacy Policy to create your account.' },
  { test: /request failed with status/i, message: CONTEXT_DEFAULTS.network },
]

function extractRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    const msg = String(e.message ?? e.detail ?? e.error ?? '')
    const code = String(e.code ?? e.status ?? '')
    if (msg && code) return `${msg} ${code}`
    return msg || code
  }
  return String(error ?? '')
}

function isTechnicalMessage(message: string): boolean {
  if (!message.trim()) return true
  if (/^PGRST\d+/i.test(message)) return true
  if (/^\d{3}\s/.test(message)) return true
  if (/postgres|supabase|postgrest|sql|relation "/i.test(message)) return true
  if (/at\s+\w+\s+\(/i.test(message)) return true
  return TECHNICAL_PATTERNS.some(({ test }) => test.test(message))
}

/** Map any thrown value to a safe, user-facing string. */
export function getErrorMessage(error: unknown, context: ErrorContext = 'generic'): string {
  const raw = extractRawMessage(error).trim()
  const fallback = CONTEXT_DEFAULTS[context]

  for (const { test, message } of TECHNICAL_PATTERNS) {
    if (test.test(raw)) return message
  }

  if (!raw || isTechnicalMessage(raw)) return fallback
  return raw
}

/** @deprecated Prefer getErrorMessage — kept for existing imports. */
export function friendlyDbError(err: unknown, context: ErrorContext = 'generic'): Error {
  return new Error(getErrorMessage(err, context))
}
