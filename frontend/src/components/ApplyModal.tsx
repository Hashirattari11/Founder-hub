import { useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { applyToStartup } from '../lib/applications'
import { useSession } from '../context/AuthContext'
import { Avatar } from './Avatar'
import type { Startup } from '../types'
import { skillsMatchPercent } from '../lib/helpers'

const applySchema = z.object({
  role_applying_for: z.string().min(1, 'Choose the role you are applying for'),
  cover_message: z
    .string()
    .min(50, 'Cover message must be at least 50 characters')
    .max(500, 'Cover message cannot exceed 500 characters'),
})

type ApplyFormValues = z.infer<typeof applySchema>

interface ApplyModalProps {
  startup: Startup
  open: boolean
  onClose: () => void
  onApplied: () => void
}

export function ApplyModal({ startup, open, onClose, onApplied }: ApplyModalProps) {
  const { profile } = useSession()
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplyFormValues>({
    resolver: zodResolver(applySchema),
  })

  const match = skillsMatchPercent(profile?.skills ?? [], startup.tech_stack ?? [])

  const onSubmit = async (values: ApplyFormValues) => {
    if (!profile) return
    setSubmitting(true)
    try {
      await applyToStartup({
        startup_id: startup.id,
        role_applying_for: values.role_applying_for,
        cover_message: values.cover_message,
      })
      toast.success('Application sent!')
      onApplied()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">Apply to {startup.name}</h2>
                <p className="mt-0.5 text-sm text-gray-500">{startup.tagline}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Auto-attached profile */}
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-dark-300 dark:bg-dark">
              <Avatar src={profile?.avatar_url} name={profile?.full_name} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{profile?.full_name}</p>
                <p className="truncate text-xs text-gray-500">
                  {profile?.skills?.slice(0, 4).join(', ') || 'No skills listed'}
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                {match}% skill match
              </span>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Role applying for
                </label>
                <select
                  {...register('role_applying_for')}
                  className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                >
                  <option value="">Select a role…</option>
                  {(startup.team_roles_needed ?? []).map((role: string) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                {errors.role_applying_for && (
                  <p className="text-xs text-red-500">{errors.role_applying_for.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cover message
                  </label>
                  <span className="text-xs text-gray-400">50–500 chars</span>
                </div>
                <textarea
                  {...register('cover_message')}
                  rows={5}
                  placeholder="Tell the founder why you're a great fit for this role…"
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                />
                {errors.cover_message && (
                  <p className="text-xs text-red-500">{errors.cover_message.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Application
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
