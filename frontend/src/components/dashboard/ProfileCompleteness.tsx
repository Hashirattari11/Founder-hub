import { Link } from 'react-router-dom'
import { Rocket } from 'lucide-react'
import type { Profile } from '../../types'

function computeCompleteness(profile: Profile): number {
  const checks = [
    !!profile.full_name,
    !!profile.username,
    !!profile.avatar_url,
    !!profile.bio,
    !!profile.role,
    (profile.skills ?? []).length > 0,
    !!profile.city,
    !!profile.country,
    profile.experience_years != null && profile.experience_years > 0,
    !!(profile.linkedin_url || profile.github_url || profile.portfolio_url),
  ]
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100)
  return Math.max(0, Math.min(100, score))
}

export function ProfileCompleteness({ profile }: { profile: Profile }) {
  const score = computeCompleteness(profile)
  const complete = score === 100

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Profile completeness</h2>
        <span className="text-sm font-extrabold text-primary">{score}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-200">
        <div
          className="h-full rounded-full bg-gradient-brand transition-all duration-700"
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {complete
          ? 'Your profile is complete. Great matches ahead!'
          : 'Complete your profile to get better matches and more applications.'}
      </p>
      <Link
        to="/settings/profile"
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
      >
        <Rocket className="h-4 w-4" />
        {complete ? 'Edit Profile' : 'Complete Profile'}
      </Link>
    </section>
  )
}
