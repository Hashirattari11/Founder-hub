import { useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { Link } from 'react-router-dom'
import { Briefcase, ExternalLink, FileText, Loader2, Send, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSession } from '../../context/AuthContext'
import { getMyJobApplications, withdrawApplication } from '../../lib/jobs'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/dashboard/Skeleton'
import { timeAgo } from '../../lib/helpers'
import { JOB_STATUS_LABELS } from '../../types'
import type { JobApplication, JobApplicationStatus } from '../../types'

const TABS: Array<JobApplicationStatus | 'all'> = [
  'all',
  'pending',
  'reviewing',
  'shortlisted',
  'interview',
  'accepted',
  'rejected',
]

const STATUS_BADGE: Record<JobApplicationStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  reviewing: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  shortlisted: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  interview: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  accepted: 'bg-green-500/15 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-500',
}

export default function JobApplications() {
  const { user } = useSession()
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<JobApplicationStatus | 'all'>('all')
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getMyJobApplications(user.id)
      .then(setApplications)
      .catch(() => toast.error('Could not load your applications'))
      .finally(() => setLoading(false))
  }, [user])

  const stats = useMemo(() => {
    const counts: Record<string, number> = { all: applications.length }
    for (const app of applications) counts[app.status] = (counts[app.status] ?? 0) + 1
    return counts
  }, [applications])

  const filtered = tab === 'all' ? applications : applications.filter((a) => a.status === tab)

  const handleWithdraw = async (id: string) => {
    setWithdrawingId(id)
    try {
      await withdrawApplication(id)
      setApplications((prev) => prev.filter((a) => a.id !== id))
      toast.success('Application withdrawn')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setWithdrawingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">My Job Applications</h1>
          <p className="mt-1 text-sm text-gray-500">Track every job you have applied to.</p>
        </div>
        <Link to="/jobs" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <Briefcase className="h-4 w-4" /> Browse jobs
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['pending', 'interview', 'accepted', 'all'] as const).map((key) => (
          <div key={key} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100">
            <p className="text-2xl font-extrabold capitalize text-gray-900 dark:text-white">{stats[key] ?? 0}</p>
            <p className="text-xs font-medium capitalize text-gray-500">
              {key === 'all' ? 'Total applications' : `${key}`}
            </p>
          </div>
        ))}
      </div>

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
            {stats[t] ? ` (${stats[t]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Send}
          title={applications.length === 0 ? 'No applications yet' : `No ${tab} applications`}
          description={
            applications.length === 0
              ? 'Find a job that matches your skills and apply.'
              : 'Applications in this status will show up here.'
          }
          action={applications.length === 0 ? { label: 'Find jobs', to: '/jobs' } : undefined}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((app) => (
            <div key={app.id} className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/30 dark:border-dark-300 dark:bg-dark-100">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <Avatar src={null} name={app.jobs?.startups?.name ?? 'J'} size="md" className="flex-shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/jobs/${app.job_id}`} className="font-bold text-gray-900 hover:text-primary dark:text-white">
                      {app.jobs?.title ?? 'Job'}
                    </Link>
                    <span className="text-sm text-gray-500">· {app.jobs?.startups?.name ?? 'FounderHub'}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[app.status]}`}>
                      {JOB_STATUS_LABELS[app.status]}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(app.created_at)}</span>
                  </div>

                  {app.cover_letter && (
                    <p className="mt-3 line-clamp-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-dark dark:text-gray-400">
                      {app.cover_letter}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {app.resume_url && (
                      <a href={app.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                        <FileText className="h-3.5 w-3.5" /> Resume
                      </a>
                    )}
                    {app.portfolio_url && (
                      <a href={app.portfolio_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Portfolio
                      </a>
                    )}
                    {app.expected_salary != null && <span>Salary: ${app.expected_salary.toLocaleString('en-US')}/mo</span>}
                    {app.availability && <span>Availability: {app.availability}</span>}
                  </div>
                </div>

                {(app.status === 'pending' || app.status === 'reviewing') && (
                  <button
                    onClick={() => handleWithdraw(app.id)}
                    disabled={withdrawingId === app.id}
                    className="inline-flex items-center gap-1.5 self-start rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {withdrawingId === app.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
