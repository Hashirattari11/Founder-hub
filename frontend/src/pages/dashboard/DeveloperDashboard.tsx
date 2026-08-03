import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, ArrowRight, Clock } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getRecommendedStartups, getRecentlyViewed } from '../../lib/startups'
import { getMyApplications } from '../../lib/applications'
import { useSavedStartups } from '../../hooks/useSavedStartups'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { StartupCardSkeleton, SkeletonRow } from '../../components/dashboard/Skeleton'
import { NotificationStrip } from '../../components/dashboard/NotificationStrip'
import { PeopleToConnect } from '../../components/dashboard/PeopleToConnect'
import { ProfileCompleteness } from '../../components/dashboard/ProfileCompleteness'
import { calcMatchScore, timeAgo } from '../../lib/helpers'
import { ROLE_LABELS } from '../../types'
import type { Application, Startup } from '../../types'

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  shortlisted: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  accepted: 'bg-green-500/15 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-500',
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DeveloperDashboard() {
  const { user, profile } = useSession()
  const { savedIds, toggleSave } = useSavedStartups(user?.id)
  const [recommended, setRecommended] = useState<Startup[]>([])
  const [loadingRec, setLoadingRec] = useState(true)
  const [applications, setApplications] = useState<Application[]>([])
  const [loadingApps, setLoadingApps] = useState(true)
  const [recentViews, setRecentViews] = useState<Startup[]>([])

  const role = (profile?.role ?? 'developer') as keyof typeof ROLE_LABELS
  const roleLabel = ROLE_LABELS[role] ?? 'Member'
  const firstName = profile?.full_name?.split(' ')[0]

  useEffect(() => {
    if (!profile) return
    getRecommendedStartups(profile, 3)
      .then(setRecommended)
      .catch(() => {})
      .finally(() => setLoadingRec(false))
  }, [profile])

  useEffect(() => {
    if (!user) return
    getMyApplications(user.id)
      .then(setApplications)
      .catch(() => {})
      .finally(() => setLoadingApps(false))
    getRecentlyViewed(user.id, 3)
      .then(setRecentViews)
      .catch(() => {})
  }, [user])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName ?? roleLabel} 👋
        </h1>
        <p className="mt-1 text-gray-500">
          {role === 'designer'
            ? 'Find startups that need your design eye.'
            : role === 'marketer'
              ? 'Find startups that need growth and distribution.'
              : 'Find your next startup to build.'}
        </p>
      </div>

      {/* CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-8 text-white">
        <div className="relative z-10">
          <h2 className="text-xl font-bold sm:text-2xl">Your next project is one match away</h2>
          <p className="mt-2 max-w-lg text-white/80">
            FounderHub AI ranks startups by your skills, experience, and location.
          </p>
          <Link
            to="/explore"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary transition-transform hover:scale-105"
          >
            <Compass className="h-4 w-4" />
            Explore Startups
          </Link>
        </div>
      </div>

      <NotificationStrip userId={user?.id ?? ''} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recommended */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Recommended for you</h2>
            <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2">
              Explore all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {loadingRec
              ? Array.from({ length: 2 }).map((_, i) => <StartupCardSkeleton key={i} />)
              : recommended.map((startup) => (
                  <StartupCard
                    key={startup.id}
                    startup={startup}
                    match={profile ? calcMatchScore(profile, startup) : 0}
                    saved={!!savedIds[startup.id]}
                    onToggleSave={() => toggleSave(startup.id)}
                  />
                ))}
          </div>

          {recentViews.length > 0 && (
            <div className="mt-8">
              <div className="mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <h2 className="font-bold">Recently viewed</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {recentViews.map((startup) => (
                  <StartupCard
                    key={startup.id}
                    startup={startup}
                    compact
                    saved={!!savedIds[startup.id]}
                    onToggleSave={() => toggleSave(startup.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right rail */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">My Applications</h2>
              <Link to="/dashboard/my-applications" className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>
            {loadingApps ? (
              <SkeletonRow />
            ) : applications.length === 0 ? (
              <p className="text-sm text-gray-500">You haven't applied anywhere yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {applications.slice(0, 3).map((app) => (
                  <Link
                    key={app.id}
                    to={`/startups/${app.startup_id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 transition-colors hover:border-primary/30 dark:border-dark-300"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{app.startups?.name ?? 'Startup'}</p>
                      <p className="truncate text-xs text-gray-400">
                        {app.role_applying_for ?? 'General'} · {timeAgo(app.created_at)}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_BADGE[app.status]}`}>
                      {app.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {profile && <ProfileCompleteness profile={profile} />}

          {profile && <PeopleToConnect user={profile} />}
        </div>
      </div>
    </div>
  )
}
