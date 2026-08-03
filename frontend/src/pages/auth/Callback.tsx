import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function Callback() {
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    async function handleCallback() {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const next = url.searchParams.get('next')

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        }

        const { data: { session }, error: sessionError } =
          await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (cancelled) return

        if (!session) {
          setError('We could not verify your account. The link may be invalid or expired.')
          return
        }

        if (next === 'update-password') {
          navigate('/reset-password', { replace: true })
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .maybeSingle()

        if (cancelled) return

        if ((profile as { full_name?: string } | null)?.full_name) {
          navigate('/dashboard', { replace: true })
        } else {
          navigate('/complete-profile', { replace: true })
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Verification failed')
      }
    }

    handleCallback()
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 dark:bg-dark">
      {error ? (
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-500/30 dark:bg-red-500/10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
            <span className="text-2xl font-bold">!</span>
          </div>
          <h1 className="mt-4 text-xl font-bold">Verification failed</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => {
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
