import { Link } from 'react-router-dom'
import { CheckCircle2, ArrowRight } from 'lucide-react'
import type { ProfileCompletion } from '../lib/profileCompletion'
import { PROFILE_COMPLETION_THRESHOLD } from '../lib/profileCompletion'

interface ProfileCompletionCardProps {
  completion: ProfileCompletion
}

/** Compact banner for the dashboard showing profile strength. */
export default function ProfileCompletionCard({ completion }: ProfileCompletionCardProps) {
  const complete = completion.percent >= PROFILE_COMPLETION_THRESHOLD

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${
        complete
          ? 'border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/10'
          : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
      }`}
    >
      <div className="flex flex-1 items-center gap-3">
        {complete ? (
          <CheckCircle2 className="h-8 w-8 flex-shrink-0 text-green-600 dark:text-green-400" />
        ) : (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
            {completion.percent}%
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${complete ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}>
            {complete
              ? 'Profile complete'
              : `Profile strength: ${completion.percent}%`}
          </p>
          {!complete && (
            <p className="mt-0.5 truncate text-xs text-amber-700 dark:text-amber-400">
              Complete your profile to unlock important actions
            </p>
          )}
          <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className={`h-full ${complete ? 'bg-green-500' : 'bg-amber-500'} transition-all duration-500`}
              style={{ width: `${completion.percent}%` }}
            />
          </div>
        </div>
      </div>
      {!complete && (
        <Link
          to="/complete-profile"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
        >
          Complete profile
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}
