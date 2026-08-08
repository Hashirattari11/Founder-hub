import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
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
import { listMeetings } from '../../lib/meetings'
import { StatCard } from '../../components/dashboard/StatCard'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { StatCardSkeleton, StartupCardSkeleton, SkeletonRow } from '../../components/dashboard/Skeleton'
import { NotificationStrip } from '../../components/dashboard/NotificationStrip'
import { PeopleToConnect } from '../../components/dashboard/PeopleToConnect'
import { ProfileCompleteness } from '../../components/dashboard/ProfileCompleteness'
import { Avatar } from '../../components/Avatar'
import { timeAgo } from '../../lib/helpers'
import type { Application, Startup } from '../../types'
import type { Meeting, MeetingActionItem } from '../../types/meetings'
import { Seo } from '../../components/Seo'

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
  const [upcoming, setUpcoming] = useState<Meeting[]>([])
  const [previous, setPrevious] = useState<Meeting[]>([])
  const [myActionItems, setMyActionItems] = useState<MeetingActionItem[]>([])

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
    listMeetings('upcoming')
      .then((r) => {
        if (active) setUpcoming(r.meetings)
      })
      .catch(() => {})
    listMeetings('past')
      .then((r) => {
        if (active) {
          setPrevious(r.meetings)
          const mine: MeetingActionItem[] = []
          for (const m of r.meetings) {
            for (const a of m.action_items ?? []) {
              if (a.status !== 'completed' && (a.assignee_id === user.id || m.organizer_id === user.id)) mine.push(a)
            }
          }
          setMyActionItems(mine)
        }
      })
      .catch(() => {})
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
      <Seo title="Founder Dashboard — FounderHub AI" />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName ?? 'Founder'} 👋
        </h1>
        <p className="mt-1 text-gray-500">Manage your startups and applicants.</p>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-brand p-8 text-white shadow-xl shadow-primary/20"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-black/10 blur-2xl" />
        <div className="relative z-10">
          <h2 className="text-xl font-bold sm:text-2xl">Post your startup idea</h2>
          <p className="mt-2 max-w-lg text-white/80">
            Get matched with the right co-founders, developers, and investors in minutes.
          </p>
          <Link
            to="/startups/create"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-primary shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
          >
            <Plus className="h-4 w-4" />
            Post Your Startup
          </Link>
        </div>
      </motion.div>

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

      {/* Meetings & tasks */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        className="grid gap-6 lg:grid-cols-3"
      >
        {[
          { title: 'Upcoming Meetings', empty: 'No upcoming meetings. Schedule one to connect.', body: upcoming.slice(0, 3).map((m) => (
            <Link
              key={m.id}
              to={`/meetings/${m.id}`}
              className="rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-dark-300"
            >
              <p className="truncate text-sm font-semibold">{m.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {new Date(m.scheduled_at).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </Link>
          )) },
          { title: 'Pending Tasks', empty: 'No pending action items. Generate AI summaries to track tasks.', badge: myActionItems.length, body: myActionItems.slice(0, 4).map((a) => (
            <div key={a.id} className="rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:shadow-md dark:border-dark-300">
              <p className="text-sm">{a.description}</p>
              {a.due_date && (
                <p className="mt-1 text-xs text-gray-500">Due {new Date(a.due_date).toLocaleDateString()}</p>
              )}
            </div>
          )) },
          { title: 'Previous Meetings', empty: 'No past meetings yet.', body: previous.slice(0, 3).map((m) => (
            <Link
              key={m.id}
              to={`/meetings/${m.id}`}
              className="rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-dark-300"
            >
              <p className="truncate text-sm font-semibold">{m.title}</p>
              <p className="mt-0.5 text-xs text-gray-500">
                {m.status === 'completed' ? 'Completed' : m.status} ·{' '}
                {new Date(m.scheduled_at).toLocaleDateString()}
              </p>
            </Link>
          )) },
        ].map((section, i) => (
          <motion.section
            key={section.title}
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}
            className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-black/5 dark:border-dark-300 dark:bg-dark-100"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">{section.title}</h2>
              {i === 1 ? (
                <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                  {myActionItems.length}
                </span>
              ) : (
                <Link to="/meetings" className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
            {(section.body as React.ReactNode[])?.length === 0 ? (
              <p className="text-sm text-gray-500">{section.empty}</p>
            ) : (
              <div className="flex flex-col gap-3">{section.body}</div>
            )}
          </motion.section>
        ))}
      </motion.div>

      {/* My Startups */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
      >
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
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center transition-colors hover:border-primary/40 dark:border-dark-400">
            <p className="text-sm text-gray-500">No startups yet. Post your first idea to attract a team.</p>
            <Link to="/startups/create" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/30">
              <Plus className="h-4 w-4" /> Create a Startup
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {startups.slice(0, 3).map((startup, idx) => {
              const appCount = applications.filter((a) => a.startup_id === startup.id).length
              return (
                <motion.div
                  key={startup.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + idx * 0.08 }}
                  className="relative"
                >
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
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.section>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid gap-6 lg:grid-cols-3"
      >
        <div className="lg:col-span-2">
          <section className="h-full rounded-2xl border border-gray-200 bg-white p-6 transition-shadow duration-300 hover:shadow-lg hover:shadow-black/5 dark:border-dark-300 dark:bg-dark-100">
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
                    className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md dark:border-dark-300"
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
      </motion.div>
    </div>
  )
}
