import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Briefcase, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getMyStartups } from '../../lib/startups'
import { getApplicationsForStartup, updateApplicationStatus } from '../../lib/applications'
import { skillsMatchPercent, timeAgo } from '../../lib/helpers'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/dashboard/Skeleton'
import type { Application, ApplicationStatus, Startup } from '../../types'

const TABS: Array<ApplicationStatus | 'all'> = ['all', 'pending', 'shortlisted', 'accepted', 'rejected']

const STATUS_BADGE: Record<ApplicationStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  shortlisted: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  accepted: 'bg-green-500/15 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-500',
}

function ApplicationCard({
  application,
  startup,
  onStatusChange,
}: {
  application: Application
  startup: Startup
  onStatusChange: (id: string, status: ApplicationStatus) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<ApplicationStatus | null>(null)
  const applicant = application.profiles
  const match = skillsMatchPercent(applicant?.skills ?? [], startup.tech_stack ?? [])

  const act = async (status: ApplicationStatus) => {
    setBusy(status)
    try {
      await onStatusChange(application.id, status)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/30 dark:border-dark-300 dark:bg-dark-100">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar src={applicant?.avatar_url} name={applicant?.full_name} size="md" className="flex-shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">{applicant?.full_name ?? 'Applicant'}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[application.status]}`}>
              {application.status}
            </span>
            <span className="text-xs text-gray-400">{timeAgo(application.created_at)}</span>
          </div>

          <p className="mt-1 text-sm font-semibold text-primary">
            {application.role_applying_for ?? 'General'}
          </p>

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-200">
                <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${match}%` }} />
              </div>
              <span className="text-xs font-bold text-primary">{match}% skills match</span>
            </div>
            {applicant?.city && <span className="text-xs text-gray-500">{applicant.city}</span>}
          </div>

          {application.cover_message && (
            <div className="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-dark">
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${expanded ? '' : 'line-clamp-2'}`}>
                {application.cover_message}
              </p>
              {application.cover_message.length > 140 && (
                <button
                  onClick={() => setExpanded((prev) => !prev)}
                  className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
                >
                  {expanded ? (
                    <>Read less <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>Read more <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {application.status !== 'rejected' && application.status !== 'accepted' && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 dark:border-dark-300">
          <button
            onClick={() => act('shortlisted')}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-colors hover:bg-blue-500/10 dark:text-blue-400"
          >
            {busy === 'shortlisted' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Shortlist
          </button>
          <button
            onClick={() => act('accepted')}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/30 px-3 py-1.5 text-xs font-semibold text-green-600 transition-colors hover:bg-green-500/10 dark:text-green-400"
          >
            {busy === 'accepted' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Accept
          </button>
          <button
            onClick={() => act('rejected')}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10"
          >
            {busy === 'rejected' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

export default function ApplicationsDashboard() {
  const { user } = useSession()
  const [startups, setStartups] = useState<Startup[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [applications, setApplications] = useState<Application[]>([])
  const [loadingStartups, setLoadingStartups] = useState(true)
  const [loadingApps, setLoadingApps] = useState(true)
  const [tab, setTab] = useState<ApplicationStatus | 'all'>('all')
  const [sortByMatch, setSortByMatch] = useState(false)

  useEffect(() => {
    if (!user) return
    getMyStartups(user.id)
      .then((data) => {
        setStartups(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .catch(() => toast.error('Could not load your startups'))
      .finally(() => setLoadingStartups(false))
  }, [user])

  const selectedStartup = useMemo(
    () => startups.find((s) => s.id === selectedId) ?? null,
    [startups, selectedId],
  )

  const loadApplications = useCallback(async (startupId: string) => {
    setLoadingApps(true)
    try {
      const data = await getApplicationsForStartup(startupId)
      setApplications(data)
    } catch {
      setApplications([])
      toast.error('Could not load applications')
    } finally {
      setLoadingApps(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadApplications(selectedId)
  }, [selectedId, loadApplications])

  const handleStatusChange = async (applicationId: string, status: ApplicationStatus) => {
    try {
      await updateApplicationStatus(applicationId, status)
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status } : a)),
      )
      toast.success(`Application ${status}`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    }
  }

  const filtered = useMemo(() => {
    let list = tab === 'all' ? applications : applications.filter((a) => a.status === tab)
    if (sortByMatch) {
      list = [...list].sort((a, b) => {
        const ma = skillsMatchPercent(a.profiles?.skills ?? [], selectedStartup?.tech_stack ?? [])
        const mb = skillsMatchPercent(b.profiles?.skills ?? [], selectedStartup?.tech_stack ?? [])
        return mb - ma
      })
    }
    return list
  }, [applications, tab, sortByMatch, selectedStartup])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">Applications</h1>
        <p className="mt-1 text-sm text-gray-500">Review applicants across your startups.</p>
      </div>

      {/* Startup selector */}
      {loadingStartups ? (
        <SkeletonRow />
      ) : startups.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No startups yet"
          description="Post your first startup to start receiving applications."
          action={{ label: 'Post a Startup', to: '/startups/create' }}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {startups.map((startup) => (
              <button
                key={startup.id}
                onClick={() => setSelectedId(startup.id)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                  selectedId === startup.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 text-gray-600 hover:border-primary dark:border-dark-300 dark:text-gray-300'
                }`}
              >
                {startup.name}
              </button>
            ))}
            <Link to="/startups/create" className="ml-auto text-sm font-semibold text-primary hover:underline">
              + New startup
            </Link>
          </div>

          {selectedStartup && (
            <>
              {/* Tabs + sort */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
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
                <button
                  onClick={() => setSortByMatch((prev) => !prev)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    sortByMatch
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 text-gray-600 dark:border-dark-300 dark:text-gray-300'
                  }`}
                >
                  Sort: {sortByMatch ? 'Match %' : 'Newest'}
                </button>
              </div>

              {loadingApps ? (
                <div className="flex flex-col gap-3">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No applications here"
                  description={
                    tab === 'all'
                      ? 'No applications yet. Share your startup!'
                      : `No ${tab} applications yet.`
                  }
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {filtered.map((application) => (
                    <ApplicationCard
                      key={application.id}
                      application={application}
                      startup={selectedStartup}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
