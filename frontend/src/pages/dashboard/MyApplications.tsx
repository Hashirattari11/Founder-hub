import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Send } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getMyApplications } from '../../lib/applications'
import { timeAgo } from '../../lib/helpers'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/dashboard/Skeleton'
import type { Application, ApplicationStatus } from '../../types'

const TABS: Array<ApplicationStatus | 'all'> = ['all', 'pending', 'shortlisted', 'accepted', 'rejected']

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  shortlisted: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  accepted: 'bg-green-500/15 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-500',
}

export default function MyApplications() {
  const { user } = useSession()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ApplicationStatus | 'all'>('all')

  useEffect(() => {
    if (!user) return
    getMyApplications(user.id)
      .then(setApplications)
      .catch(() => toast.error('Could not load your applications'))
      .finally(() => setLoading(false))
  }, [user])

  const filtered = useMemo(
    () => (tab === 'all' ? applications : applications.filter((a) => a.status === tab)),
    [applications, tab],
  )

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">My Applications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track where you've applied and what's been decided.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No applications yet"
          description="Browse startups matched to your skills and send your first application."
          action={{ label: 'Explore Startups', to: '/explore' }}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  tab === t
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-200 dark:text-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {filtered.map((application) => {
              const startup = application.startups
              return (
                <div
                  key={application.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/30 dark:border-dark-300 dark:bg-dark-100"
                >
                  <div className="flex items-start gap-4">
                    <Avatar src={startup?.profiles?.avatar_url} name={startup?.name ?? '?'} size="md" className="flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/startups/${startup?.id}`} className="font-bold hover:text-primary">
                          {startup?.name ?? 'Deleted startup'}
                        </Link>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[application.status]}`}>
                          {application.status}
                        </span>
                        <span className="text-xs text-gray-400">{timeAgo(application.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-primary">
                        {application.role_applying_for ?? 'General'}
                      </p>
                      <p className="mt-1 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">
                        {startup?.tagline}
                      </p>
                    </div>
                    <Link
                      to={`/startups/${startup?.id}`}
                      className="hidden flex-shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 sm:inline-flex"
                    >
                      View startup
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
