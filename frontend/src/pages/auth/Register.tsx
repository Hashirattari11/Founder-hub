import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase, APP_URL } from '../../lib/supabase'
import { AuthLayout } from '../../components/AuthLayout'
import { Field, TextInput, SelectInput } from '../../components/FormInput'
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

      if (error) throw error

      if (data.session) {
        toast.success('Account created! Complete your profile to get started.')
        navigate('/complete-profile')
      } else {
        toast.success('Check your email to verify your account')
        navigate('/login')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start building your startup in minutes."
    >
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
      </form>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
