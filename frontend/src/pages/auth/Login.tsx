import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase, APP_URL, stashAuthRedirect } from '../../lib/supabase'
import { stashOAuthIntent } from '../../components/OAuthCodeRedirect'
import { getErrorMessage } from '../../lib/errors'
import { AuthLayout } from '../../components/AuthLayout'
import { Field, TextInput } from '../../components/FormInput'
import { isAdminProfile } from '../../lib/admin'
import { hasUserConsent } from '../../lib/consent'
import { Seo } from '../../components/Seo'
import type { Profile } from '../../types'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
  rememberMe: z.boolean(),
})

type LoginForm = z.infer<typeof loginSchema>

export default function Login() {
  const [submitting, setSubmitting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: string })?.from ?? '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: true },
  })

  const onSubmit = async (values: LoginForm) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })

      if (error) throw error

      const {
        data: { session },
      } = await supabase.auth.getSession()

      let profile: Profile | null = null
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('id, role, is_admin, username')
          .eq('id', session.user.id)
          .maybeSingle()
        profile = (data as Profile | null) ?? null
      }

      toast.success('Welcome back!')
      if (!profile?.username) {
        const consented = session ? await hasUserConsent(session.user.id) : false
        navigate(consented ? '/complete-profile' : '/auth/consent', { replace: true })
      } else if (!location.state?.from && isAdminProfile(profile)) {
        navigate('/admin/dashboard', { replace: true })
      } else {
        navigate(from, { replace: true })
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'auth'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setOauthLoading(true)
    try {
      stashAuthRedirect(from)
      stashOAuthIntent('signin')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${APP_URL}/auth/callback?intent=signin`,
        },
      })
      if (error) throw error
    } catch (error) {
      toast.error(getErrorMessage(error, 'auth'))
      setOauthLoading(false)
    }
  }

  return (
    <>
      <Seo title="Sign in — FounderHub AI" description="Sign in to FounderHub AI to continue building your startup." />
      <AuthLayout
        title="Welcome back"
        subtitle="Sign in to continue building your startup."
      >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Field label="Email" error={errors.email?.message}>
          <TextInput
            type="email"
            placeholder="you@startup.com"
            autoComplete="email"
            {...register('email')}
          />
        </Field>

        <Field label="Password" error={errors.password?.message}>
          <TextInput
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register('password')}
          />
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              {...register('rememberMe')}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200 dark:bg-dark-300" />
        <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
          or continue with
        </span>
        <div className="h-px flex-1 bg-gray-200 dark:bg-dark-300" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={oauthLoading}
        className="btn-ghost w-full disabled:opacity-60"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        {oauthLoading ? 'Redirecting to Google...' : 'Continue with Google'}
      </button>

      <p className="mt-4 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        By continuing with Google, you agree to our{' '}
        <Link to="/terms" className="font-semibold text-primary hover:underline">Terms of Service</Link>
        {' '}and{' '}
        <Link to="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.
      </p>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        New to FounderHub?{' '}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
    </>
  )
}
