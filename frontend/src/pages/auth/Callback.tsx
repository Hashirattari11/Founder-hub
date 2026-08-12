import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase, popAuthRedirect } from '../../lib/supabase'
import { getErrorMessage } from '../../lib/errors'
import { hasUserConsent } from '../../lib/consent'
import { isAdminProfile } from '../../lib/admin'
import type { Profile } from '../../types'

type CallbackState = 'loading' | 'error' | 'accountNotFound'

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
          setError('Please sign in again to continue.')
          return
        }

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) throw exchangeError

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (cancelled) return

        if (!session) {
          setState('error')
          setError('Your session expired — Please sign in again.')
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

        if (isAdminProfile(p)) {
          navigate('/admin/dashboard', { replace: true })
          return
        }

        const isOnboarded = Boolean(p?.username)
        const consented = await hasUserConsent(session.user.id)
        const needsConsent = !isOnboarded && !consented

        if (intent === 'signin') {
          if (isOnboarded) {
            toast.success('Welcome back!')
            navigate(popAuthRedirect('/dashboard'), { replace: true })
          } else {
            setState('accountNotFound')
            await supabase.auth.signOut()
          }
          return
        }

        if (intent === 'register') {
          if (isOnboarded) {
            toast.success('Welcome back!')
            navigate(popAuthRedirect('/dashboard'), { replace: true })
          } else if (needsConsent) {
            navigate('/auth/consent', { replace: true })
          } else {
            navigate('/complete-profile', { replace: true })
          }
          return
        }

        if (isOnboarded) {
          navigate(popAuthRedirect('/dashboard'), { replace: true })
        } else if (needsConsent) {
          navigate('/auth/consent', { replace: true })
        } else {
          navigate('/complete-profile', { replace: true })
        }
      } catch (err) {
        if (cancelled) return
        setError(getErrorMessage(err, 'auth'))
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
          <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setState('loading')
                setError(null)
                window.location.reload()
              }}
              className="btn-primary w-full"
            >
              Try Again
            </button>
            <Link to="/login" className="btn-ghost w-full">
              Back to Sign In
            </Link>
          </div>
        </div>
      ) : state === 'accountNotFound' ? (
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-dark-300 dark:bg-dark">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <span className="text-2xl font-bold">?</span>
          </div>
          <h1 className="mt-4 text-xl font-bold">Account not found</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            No FounderHub account is linked to this Google account yet. Create one to get started.
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
