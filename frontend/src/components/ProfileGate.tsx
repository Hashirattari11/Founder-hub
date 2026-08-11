import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import type { ProfileCompletion } from '../lib/profileCompletion'

interface ProfileGateProps {
  completion: ProfileCompletion
}

/**
 * Full-screen gate shown when a user tries an important action (post a job,
 * create a startup, message someone, connect, book a meeting) with a profile
 * below the completion threshold.
 */
export default function ProfileGate({ completion }: ProfileGateProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12 dark:bg-dark">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-dark-300 dark:bg-dark">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-center text-xl font-bold">
          Complete your profile to continue
        </h1>
        <p className="mt-2 text-center text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Your profile is {completion.percent}% complete. Add a few details so
          our matching engine can find the right people for you.
        </p>

        <div className="mt-6">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-dark-200">
            <div
              className="h-full bg-gradient-brand transition-all duration-500"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-right text-xs font-semibold text-primary">
            {completion.percent}%
          </p>
        </div>

        {completion.missing.length > 0 && (
          <ul className="mt-6 space-y-2">
            {completion.missing.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {item}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <Link to="/complete-profile" className="btn-primary w-full">
            Complete profile
          </Link>
          <Link to="/dashboard" className="btn-ghost w-full">
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
