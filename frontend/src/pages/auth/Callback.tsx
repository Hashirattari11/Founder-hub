import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import { supabase, popAuthRedirect } from '../../lib/supabase'
import { isAdminProfile } from '../../lib/admin'
import type { Profile } from '../../types'

type CallbackState = 'loading' | 'error' | 'accountNotFound' | 'accountAlreadyExists'

export default function Callback() {
  const [state, setState] = useState<CallbackState>('loading')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function handleCallback() {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const next = url.searchParams.get('next')
        const intent = url.searchParams.get('intent')

        if (!code) {
          setState('error')
          setError('Missing authorization code. Please try signing in again.')
          return
        }

        // Single explicit exchange. The client was created with
        // detectSessionInUrl: false so nothing else consumes the PKCE verifier.
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) throw exchangeError

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (cancelled) return

        if (!session) {
          setState('error')
          setError('We could not verify your account. The link may be invalid or expired.')
          return
        }

        if (next === 'update-password') {
          navigate('/reset-password', { replace: true })
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username, role, is_admin')
          .eq('id', session.user.id)
          .maybeSingle()

        if (cancelled) return

        const p = profile as (Profile & { full_name?: string; username?: string | null }) | null

        // Admin always goes to the admin area.
        if (isAdminProfile(p)) {
          navigate('/admin/dashboard', { replace: true })
          return
        }

        // A real FounderHub account has a profile row (created by the
        // handle_new_user trigger on first-ever auth). username being set means
        // onboarding was completed; username NULL means the row exists but
        // onboarding was never finished (still needs a username + role pick).
        const isOnboarded = Boolean(p?.username)

        if (intent === 'signin') {
          if (isOnboarded) {
            navigate(popAuthRedirect('/dashboard'), { replace: true })
          } else {
            // Sign-in expects a finished account (username set). Stub profiles
            // from an unfinished registration do not count — ask them to register.
            setState('accountNotFound')
            await supabase.auth.signOut()
          }
          return
        }

        if (intent === 'register') {
          // handle_new_user always creates a profile row on first OAuth, so we
          // cannot use hasProfile to detect duplicates. A completed account has
          // a username; a brand-new Google signup only has the stub profile.
          if (isOnboarded) {
            setState('accountAlreadyExists')
            await supabase.auth.signOut()
          } else {
            navigate('/onboarding', { replace: true })
          }
          return
        }

        // No intent (e.g. email verification links): an onboarded user goes
        // straight to the dashboard, everyone else completes onboarding.
        if (isOnboarded) {
          navigate(popAuthRedirect('/dashboard'), { replace: true })
        } else {
          navigate('/onboarding', { replace: true })
        }
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Verification failed'
        setError(message.includes('PKCE')
          ? `${message} Please try signing in again — the login link may be stale.`
          : message)
        setState('error')
      }
    }

    handleCallback()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-dark">
      {state === 'error' ? (
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h1 className="mt-4 text-xl font-bold">Verification failed</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => {
                setState('loading')
                setError(null)
                window.location.reload()
              }}
              className="btn-primary w-full"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn-ghost w-full"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      ) : state === 'accountNotFound' ? (
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-dark-300 dark:bg-dark">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <span className="text-2xl font-bold">?</span>
          </div>
          <h1 className="mt-4 text-xl font-bold">Account not found</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            No FounderHub account is linked to this Google account yet. Create one
            to get started.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link to="/register" className="btn-primary w-full">
              Create account
            </Link>
            <Link to="/login" className="btn-ghost w-full">
              Back to sign in
            </Link>
          </div>
        </div>
      ) : state === 'accountAlreadyExists' ? (
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-dark-300 dark:bg-dark">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h1 className="mt-4 text-xl font-bold">Your account is already created</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            This Google account is already registered on FounderHub.
            Please sign in to continue.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link to="/login" className="btn-primary w-full">
              Go to Sign In
            </Link>
            <Link to="/register" className="btn-ghost w-full">
              Use a different email
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-xl shadow-primary/30">
            <Rocket className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-xl font-bold">Verifying your account</h1>
          <div className="mt-6 h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
          <p className="mt-6 text-sm text-gray-500">This should only take a second...</p>
        </div>
      )}
    </div>
  )
}
