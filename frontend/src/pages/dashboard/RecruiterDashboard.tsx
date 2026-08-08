import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserSearch, ArrowRight, Users, Briefcase, FileText, Rocket } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getMyApplications } from '../../lib/applications'
import { supabase } from '../../lib/supabase'
import { NotificationStrip } from '../../components/dashboard/NotificationStrip'
import { PeopleToConnect } from '../../components/dashboard/PeopleToConnect'
import { ProfileCompleteness } from '../../components/dashboard/ProfileCompleteness'
import { ROLE_LABELS } from '../../types'
import type { Application } from '../../types'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function RecruiterDashboard() {
  const { user, profile } = useSession()
  const [stats, setStats] = useState({ connections: 0, applications: 0, jobs: 0 })
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<Application[]>([])

  const role = (profile?.role ?? 'recruiter') as keyof typeof ROLE_LABELS
  const firstName = profile?.full_name?.split(' ')[0]
  const roleLabel = ROLE_LABELS[role] ?? 'Recruiter'

  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([
      supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .then(({ count }) => count ?? 0),
      getMyApplications(user.id),
      supabase
        .from('job_postings')
        .select('*', { count: 'exact', head: true })
        .eq('posted_by', user.id)
        .then(({ count }) => count ?? 0),
    ])
      .then(([connections, apps, jobs]) => {
        if (!active) return
        setApplications(apps)
        setStats({ connections, applications: apps.length, jobs })
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName ?? roleLabel} 👋
        </h1>
        <p className="mt-1 text-gray-500">
          Source candidates, post jobs and build your talent pipeline.
        </p>
      </div>

      {/* Unique recruiter hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-8 text-white">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
            <UserSearch className="h-3.5 w-3.5" />
            Talent Desk
          </span>
          <h2 className="mt-3 text-xl font-bold sm:text-2xl">Build the teams behind tomorrow's startups</h2>
          <p className="mt-2 max-w-lg text-white/80">
            Post openings, discover candidates and move them through your pipeline.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/jobs/post"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 transition-transform hover:scale-105"
            >
              <Rocket className="h-4 w-4" />
              Post a Job
            </Link>
            <Link
              to="/dashboard/manage-jobs"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <Briefcase className="h-4 w-4" />
              Manage Jobs
            </Link>
          </div>
        </div>
      </div>

      <NotificationStrip userId={user?.id ?? ''} />

      {/* Recruiter KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <Briefcase className="h-6 w-6 text-blue-500" />
          <p className="mt-3 text-2xl font-bold">{loading ? '—' : stats.jobs}</p>
          <p className="text-sm text-gray-500">Jobs posted</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <FileText className="h-6 w-6 text-indigo-500" />
          <p className="mt-3 text-2xl font-bold">{loading ? '—' : stats.applications}</p>
          <p className="text-sm text-gray-500">Applications in</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <Users className="h-6 w-6 text-violet-500" />
          <p className="mt-3 text-2xl font-bold">{stats.connections}</p>
          <p className="text-sm text-gray-500">Connections</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent applications */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Recent applications</h2>
            <Link to="/dashboard/manage-jobs" className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2">
              Manage jobs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-dark-200" />
              ))}
            </div>
          ) : applications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-dark-400">
              <UserSearch className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-3 font-semibold">No activity yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Post a job to start receiving applications.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {applications.slice(0, 5).map((app) => (
                <Link
                  key={app.id}
                  to={`/startups/${app.startup_id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 transition-colors hover:border-indigo-300 dark:border-dark-300"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{app.startups?.name ?? 'Startup'}</p>
                    <p className="truncate text-xs text-gray-400">
                      {app.role_applying_for ?? 'General'}
                    </p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-600 dark:text-indigo-400">
                    {app.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Right rail */}
        <div className="space-y-6">
          {profile && <ProfileCompleteness profile={profile} />}
          {profile && <PeopleToConnect user={profile} />}
        </div>
      </div>
    </div>
  )
}
