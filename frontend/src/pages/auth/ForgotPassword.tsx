import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase, APP_URL } from '../../lib/supabase'
import { AuthLayout } from '../../components/AuthLayout'
import { Field, TextInput } from '../../components/FormInput'

const forgotSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type ForgotForm = z.infer<typeof forgotSchema>

export default function ForgotPassword() {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) })

  const onSubmit = async (values: ForgotForm) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${APP_URL}/auth/callback?next=update-password`,
      })
      if (error) throw error
      setSent(true)
      toast.success('Password reset email sent')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a reset link."
    >
      {sent ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6 text-center">
          <p className="font-semibold text-primary">Check your inbox</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            We sent a password reset link to your email. The link expires in 1 hour.
          </p>
          <Link to="/login" className="btn-primary mt-6 w-full">
            Back to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <Field label="Email" error={errors.email?.message}>
            <TextInput
              type="email"
              placeholder="you@startup.com"
              autoComplete="email"
              {...register('email')}
            />
          </Field>

          <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
            {submitting ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to Sign In
        </Link>
      </p>
    </AuthLayout>
  )
}
