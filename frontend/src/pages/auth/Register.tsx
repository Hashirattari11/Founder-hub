import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CircleAlert } from 'lucide-react'
import { supabase, APP_URL } from '../../lib/supabase'
import { getErrorMessage } from '../../lib/errors'
import { AuthLayout } from '../../components/AuthLayout'
import { Field, TextInput, SelectInput } from '../../components/FormInput'
import { Seo } from '../../components/Seo'
import type { Role } from '../../types'

const roles: { value: Role; label: string }[] = [
  { value: 'founder', label: 'Founder' },
  { value: 'developer', label: 'Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'investor', label: 'Investor' },
  { value: 'marketer', label: 'Marketer' },
]

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Enter your full name'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    role: z.enum(['founder', 'developer', 'designer', 'investor', 'marketer']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function Register() {
  const [submitting, setSubmitting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [existingEmail, setExistingEmail] = useState<string | null>(null)
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'founder' },
  })

  const onSubmit = async (values: RegisterForm) => {
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            full_name: values.fullName,
            role: values.role,
          },
          emailRedirectTo: `${APP_URL}/auth/callback`,
        },
      })

      if (error) {
        const message = (error.message ?? '').toLowerCase()
        if (message.includes('already registered') || error.code === 'user_already_exists') {
          setExistingEmail(values.email)
          return
        }
        toast.error(getErrorMessage(error, 'auth'))
        return
      }

      const identities = data.user?.identities ?? []
      if (identities.length === 0) {
        setExistingEmail(values.email)
        return
      }

      if (data.session) {
        toast.success('Welcome to FounderHub!')
        navigate('/complete-profile', { replace: true })
        return
      }

      // Email confirmation may still be on in Supabase — try immediate sign-in.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      })
      if (!signInError && signInData.session) {
        toast.success('Welcome to FounderHub!')
        navigate('/complete-profile', { replace: true })
        return
      }

      toast.success('Welcome to FounderHub!')
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error, 'auth'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    setOauthLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${APP_URL}/auth/callback?intent=register`,
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
      <Seo title="Create account — FounderHub AI" description="Join FounderHub AI to find co-founders, investors, and AI tools for your startup." />
      <AuthLayout
        title="Create your account"
        subtitle="Start building your startup in minutes."
      >
      {existingEmail ? (
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <CircleAlert className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold">Account Already Exists</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            An account with <span className="font-semibold">{existingEmail}</span> already exists.
          </p>
          <Link to="/login" className="btn-primary mt-6 w-full">
            Sign In to My Account
          </Link>
          <button
            type="button"
            onClick={() => setExistingEmail(null)}
            className="btn-ghost mt-3 w-full"
          >
            Try Different Email
          </button>
        </div>
      ) : (
      <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Field label="Full Name" error={errors.fullName?.message}>
          <TextInput
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            {...register('fullName')}
          />
        </Field>

        <Field label="Email" error={errors.email?.message}>
          <TextInput
            type="email"
            placeholder="you@startup.com"
            autoComplete="email"
            {...register('email')}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Password" error={errors.password?.message}>
            <TextInput
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('password')}
            />
          </Field>

          <Field label="Confirm Password" error={errors.confirmPassword?.message}>
            <TextInput
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
          </Field>
        </div>

        <Field label="I am a..." error={errors.role?.message}>
          <SelectInput {...register('role')}>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </SelectInput>
        </Field>

        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>

        <p className="mt-2 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          By creating an account, you agree to our{' '}
          <Link to="/terms" className="font-semibold text-primary hover:underline">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" className="font-semibold text-primary hover:underline">Privacy Policy</Link>.
        </p>
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
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
      </>
      )}
    </AuthLayout>
    </>
  )
}
