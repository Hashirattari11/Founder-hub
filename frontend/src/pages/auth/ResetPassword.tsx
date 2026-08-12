import { useState, useEffect } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useSession } from '../../context/AuthContext'
import { AuthLayout } from '../../components/AuthLayout'
import { Field, TextInput } from '../../components/FormInput'

const resetSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type ResetForm = z.infer<typeof resetSchema>

export default function ResetPassword() {
  const [submitting, setSubmitting] = useState(false)
  const { session } = useSession()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) })

  useEffect(() => {
    if (!session) navigate('/forgot-password', { replace: true })
  }, [session, navigate])

  const onSubmit = async (values: ResetForm) => {
    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      })
      if (error) throw error
      toast.success('Password updated successfully')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error, 'generic'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!session) return null

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password for your account."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Field label="New Password" error={errors.password?.message}>
          <TextInput
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>

        <Field label="Confirm New Password" error={errors.confirmPassword?.message}>
          <TextInput
            type="password"
            placeholder="••••••••"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        </Field>

        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
          {submitting ? 'Updating...' : 'Update Password'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to Sign In
        </Link>
      </p>
    </AuthLayout>
  )
}
