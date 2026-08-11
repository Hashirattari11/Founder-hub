import { Link } from 'react-router-dom'
import { Briefcase, MapPin } from 'lucide-react'
import { Avatar } from './Avatar'
import { ROLE_LABELS } from '../types'
import type { Profile } from '../types'

interface ProfileCardProps {
  profile: Profile
  onConnect?: () => void
}

export function ProfileCard({ profile, onConnect }: ProfileCardProps) {
  const topSkills = (profile.skills ?? []).slice(0, 3)

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 dark:border-dark-300 dark:bg-dark-100">
      <div className="flex items-start justify-between">
        <Link to={`/profile/${profile.username}`}>
          <Avatar src={profile.avatar_url} name={profile.full_name} size="lg" />
        </Link>
        {profile.is_open_to_work && (
          <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
            Open to work
          </span>
        )}
      </div>

      <Link to={`/profile/${profile.username}`} className="mt-4">
        <h3 className="font-bold hover:text-primary">
          {profile.full_name ?? 'New Member'}
        </h3>
      </Link>

      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
        <Briefcase className="h-3.5 w-3.5" />
        {profile.role ? ROLE_LABELS[profile.role] : 'FounderHub member'}
        {profile.experience_years ? ` · ${profile.experience_years} yrs` : ''}
      </p>

      {profile.city && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
          <MapPin className="h-3.5 w-3.5" />
          {profile.city}
          {profile.country ? `, ${profile.country}` : ''}
        </p>
      )}

      {topSkills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {topSkills.map((skill) => (
            <span
              key={skill}
              className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      {onConnect && (
        <button
          onClick={onConnect}
          className="btn-primary mt-5 w-full text-sm"
        >
          Connect
        </button>
      )}
    </div>
  )
}
