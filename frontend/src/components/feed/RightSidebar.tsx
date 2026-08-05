import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, Eye } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { Avatar } from '../Avatar'
import { FollowButton } from '../FollowButton'
import { ConnectButton } from '../ConnectButton'
import { getSuggestedPeople, getTrendingStartups } from '../../lib/feed'
import type { Profile, Startup } from '../../types'

export function RightSidebar() {
  const { user } = useSession()
  const [people, setPeople] = useState<Profile[]>([])
  const [startups, setStartups] = useState<(Startup & { views_count: number })[]>([])

  useEffect(() => {
    if (!user) return
    getSuggestedPeople(user.id)
      .then(setPeople)
      .catch(() => {})
    getTrendingStartups()
      .then(setStartups)
      .catch(() => {})
  }, [user])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-800 bg-[#1A1A1A] p-4">
        <p className="mb-3 text-sm font-bold text-white">Suggested to Follow</p>
        {people.length === 0 && (
          <p className="text-xs text-gray-500">No suggestions yet</p>
        )}
        <div className="space-y-3">
          {people.slice(0, 3).map((person) => (
            <div key={person.id} className="flex items-center gap-3">
              <Link to={`/profile/${person.username ?? ''}`}>
                <Avatar src={person.avatar_url} name={person.full_name} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/profile/${person.username ?? ''}`}
                  className="block truncate text-sm font-medium text-white hover:underline"
                >
                  {person.full_name}
                </Link>
                <p className="truncate text-xs text-gray-500">
                  {person.role ?? 'Member'} · {person.city ?? 'FounderHub'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <ConnectButton targetId={person.id} targetName={person.full_name} variant="icon" />
                <FollowButton targetId={person.id} targetType="user" className="!px-3 !py-1 text-xs" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-800 bg-[#1A1A1A] p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
          <TrendingUp className="h-4 w-4 text-purple-400" />
          Trending Startups
        </p>
        {startups.length === 0 && (
          <p className="text-xs text-gray-500">No startups yet</p>
        )}
        <div className="space-y-3">
          {startups.map((startup) => (
            <div key={startup.id} className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-sm font-bold text-purple-400">
                {startup.name?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/startups/${startup.id}`}
                  className="block truncate text-sm font-medium text-white hover:underline"
                >
                  {startup.name}
                </Link>
                <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                  {startup.industry} · {startup.views_count ?? 0}{' '}
                  <Eye className="h-3 w-3" />
                </p>
              </div>
              <Link
                to={`/startups/${startup.id}`}
                className="rounded-lg border border-gray-700 px-2.5 py-1 text-xs font-medium text-gray-300 transition-colors hover:border-purple-500 hover:text-purple-400"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-emerald-500/5 p-4">
        <p className="text-sm font-bold text-white">
          💰 $2.3B raised by startups in MENA this month
        </p>
        <p className="mt-1 text-xs text-gray-500">
          From AI to fintech — the ecosystem is booming.
        </p>
      </div>
    </div>
  )
}
