import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, ArrowRight, Briefcase, Users, Sparkles, TrendingUp } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getRecommendedStartups } from '../../lib/startups'
import { getMyApplications } from '../../lib/applications'
import { useSavedStartups } from '../../hooks/useSavedStartups'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { StartupCardSkeleton } from '../../components/dashboard/Skeleton'
import { NotificationStrip } from '../../components/dashboard/NotificationStrip'
import { PeopleToConnect } from '../../components/dashboard/PeopleToConnect'
import { ProfileCompleteness } from '../../components/dashboard/ProfileCompleteness'
import { calcMatchScore } from '../../lib/helpers'
import { ROLE_LABELS } from '../../types'
import type { Application, Startup } from '../../types'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function MarketerDashboard() {
  const { user, profile } = useSession()
  const { savedIds, toggleSave } = useSavedStartups(user?.id)
  const [recommended, setRecommended] = useState<Startup[]>([])
  const [loadingRec, setLoadingRec] = useState(true)
  const [applications, setApplications] = useState<Application[]>([])
  const [loadingApps, setLoadingApps] = useState(true)

  const role = (profile?.role ?? 'marketer') as keyof typeof ROLE_LABELS
  const firstName = profile?.full_name?.split(' ')[0]
  const roleLabel = ROLE_LABELS[role] ?? 'Marketer'

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
  }, [user])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName ?? roleLabel} 👋
        </h1>
        <p className="mt-1 text-gray-500">
          Grow startups people talk about — own the funnel from first touch to loyal users.
        </p>
      </div>

      {/* Unique marketer hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 via-orange-500 to-amber-500 p-8 text-white">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
            <Megaphone className="h-3.5 w-3.5" />
            Growth Studio
          </span>
          <h2 className="mt-3 text-xl font-bold sm:text-2xl">Find startups ready for a growth spurt</h2>
          <p className="mt-2 max-w-lg text-white/80">
            FounderHub matches your growth toolkit with early teams that need traction.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-rose-600 transition-transform hover:scale-105"
            >
              <ArrowRight className="h-4 w-4" />
              Explore Growth Opportunities
            </Link>
            <Link
              to="/resume-builder"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <TrendingUp className="h-4 w-4" />
              Growth Profile
            </Link>
          </div>
        </div>
      </div>

      <NotificationStrip userId={user?.id ?? ''} />

      {/* Marketer KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/dashboard/my-applications"
          className="rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-rose-300 hover:shadow-lg dark:border-dark-300 dark:bg-dark-100"
        >
          <Briefcase className="h-6 w-6 text-rose-500" />
          <p className="mt-3 text-2xl font-bold">{loadingApps ? '—' : applications.length}</p>
          <p className="text-sm text-gray-500">Growth applications</p>
        </Link>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <Sparkles className="h-6 w-6 text-orange-500" />
          <p className="mt-3 text-2xl font-bold">{loadingRec ? '—' : recommended.length}</p>
          <p className="text-sm text-gray-500">Startups for you</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <Users className="h-6 w-6 text-amber-500" />
          <p className="mt-3 text-2xl font-bold">
            {profile ? (profile.skills?.length ?? 0) : 0}
          </p>
          <p className="text-sm text-gray-500">Skills in profile</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recommended */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Startups that need your growth</h2>
            <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2">
              Explore all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
              <p className="text-sm text-gray-500">Loading…</p>
            ) : applications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center dark:border-dark-400">
                <Megaphone className="mx-auto h-6 w-6 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">No applications yet — pitch your growth playbook.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {applications.slice(0, 3).map((app) => (
                  <Link
                    key={app.id}
                    to={`/startups/${app.startup_id}`}
                    className="rounded-xl border border-gray-200 p-3 transition-colors hover:border-rose-300 dark:border-dark-300"
                  >
                    <p className="truncate text-sm font-semibold">{app.startups?.name ?? 'Startup'}</p>
                    <p className="truncate text-xs text-gray-400">
                      {app.role_applying_for ?? 'General'}
                    </p>
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
