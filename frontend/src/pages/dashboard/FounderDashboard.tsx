import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Users,
  Layers,
  Bell,
  Rocket,
  ArrowRight,
} from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getMyStartups } from '../../lib/startups'
import { getApplicationsForStartup } from '../../lib/applications'
import { getUnreadCount } from '../../lib/notifications'
import { StatCard } from '../../components/dashboard/StatCard'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { StatCardSkeleton, StartupCardSkeleton, SkeletonRow } from '../../components/dashboard/Skeleton'
import { NotificationStrip } from '../../components/dashboard/NotificationStrip'
import { PeopleToConnect } from '../../components/dashboard/PeopleToConnect'
import { ProfileCompleteness } from '../../components/dashboard/ProfileCompleteness'
import { Avatar } from '../../components/Avatar'
import { timeAgo } from '../../lib/helpers'
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

export default function FounderDashboard() {
  const { user, profile } = useSession()
  const [startups, setStartups] = useState<Startup[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [unread, setUnread] = useState(0)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    if (!user) return
    let active = true

    getMyStartups(user.id)
      .then(async (data) => {
        if (!active) return
        setStartups(data)
        const appsByStartup = await Promise.all(
          data.map((s) => getApplicationsForStartup(s.id).catch(() => [] as Application[])),
        )
        if (!active) return
        setApplications(appsByStartup.flat())
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingStats(false)
      })

    getUnreadCount(user.id).then(setUnread).catch(() => {})
    return () => {
      active = false
    }
  }, [user])

  const firstName = profile?.full_name?.split(' ')[0]
  const publishedCount = startups.filter((s) => s.is_published).length

  const recentApplications = useMemo(
    () =>
      [...applications]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 4),
    [applications],
  )

  const applicantIds = new Set(applications.map((a) => a.applicant_id))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName ?? 'Founder'} 👋
        </h1>
        <p className="mt-1 text-gray-500">Manage your startups and applicants.</p>
      </div>

      {/* CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-8 text-white">
        <div className="relative z-10">
          <h2 className="text-xl font-bold sm:text-2xl">Post your startup idea</h2>
          <p className="mt-2 max-w-lg text-white/80">
            Get matched with the right co-founders, developers, and investors in minutes.
          </p>
          <Link
            to="/startups/create"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary transition-transform hover:scale-105"
          >
            <Plus className="h-4 w-4" />
            Post Your Startup
          </Link>
        </div>
      </div>

      <NotificationStrip userId={user?.id ?? ''} />

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingStats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard icon={Users} label="Total applicants" value={applicantIds.size} />
            <StatCard icon={Layers} label="Startups posted" value={startups.length} />
            <StatCard icon={Rocket} label="Published" value={publishedCount} />
            <StatCard icon={Bell} label="Unread notifications" value={unread} />
          </>
        )}
      </div>

      {/* My Startups */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">My Startups</h2>
          <Link to="/dashboard/startups" className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2">
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {loadingStats ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <StartupCardSkeleton />
            <StartupCardSkeleton />
            <StartupCardSkeleton />
          </div>
        ) : startups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-dark-400">
            <p className="text-sm text-gray-500">No startups yet. Post your first idea to attract a team.</p>
            <Link to="/startups/create" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Create a Startup
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {startups.slice(0, 3).map((startup) => {
              const appCount = applications.filter((a) => a.startup_id === startup.id).length
              return (
                <div key={startup.id} className="relative">
                  <StartupCard startup={startup} showFounder={false} />
                  {startup.is_published && appCount > 0 && (
                    <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {appCount} applicant{appCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {!startup.is_published && (
                    <span className="absolute right-4 top-4 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      Draft
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">Recent Applications</h2>
              <Link to="/dashboard/applications" className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2">
                Manage
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {loadingStats ? (
              <SkeletonRow />
            ) : recentApplications.length === 0 ? (
              <p className="text-sm text-gray-500">
                No applications yet. Share your startup links to attract talent.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {recentApplications.map((app) => (
                  <Link
                    key={app.id}
                    to="/dashboard/applications"
                    className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 transition-colors hover:border-primary/30 dark:border-dark-300"
                  >
                    <Avatar src={app.profiles?.avatar_url} name={app.profiles?.full_name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{app.profiles?.full_name ?? 'Applicant'}</p>
                      <p className="truncate text-xs text-gray-500">
                        {app.role_applying_for ?? 'General'} ·{' '}
                        {startups.find((s) => s.id === app.startup_id)?.name ?? 'Startup'} · {timeAgo(app.created_at)}
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
        </div>

        <div className="space-y-6">
          {profile && <ProfileCompleteness profile={profile} />}
          {profile && <PeopleToConnect user={profile} />}
        </div>
      </div>
    </div>
  )
}
