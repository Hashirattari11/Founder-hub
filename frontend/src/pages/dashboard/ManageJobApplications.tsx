import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useSession } from '../../context/AuthContext'
import { getMyJobs, getApplicationsForJob, updateApplicationStatus, toggleJobActive } from '../../lib/jobs'
import { notifyJobStatus } from '../../lib/jobs'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/dashboard/Skeleton'
import { timeAgo } from '../../lib/helpers'
import { JOB_STATUS_LABELS } from '../../types'
import type { Job, JobApplication, JobApplicationStatus } from '../../types'

const STATUS_BADGE: Record<JobApplicationStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  reviewing: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  shortlisted: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  interview: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  accepted: 'bg-green-500/15 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-500',
}

const ACTIONS: { status: JobApplicationStatus; label: string; cls: string }[] = [
  { status: 'reviewing', label: 'Reviewing', cls: 'border-blue-500/30 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400' },
  { status: 'shortlisted', label: 'Shortlist', cls: 'border-violet-500/30 text-violet-600 hover:bg-violet-500/10 dark:text-violet-400' },
  { status: 'interview', label: 'Interview', cls: 'border-cyan-500/30 text-cyan-600 hover:bg-cyan-500/10 dark:text-cyan-400' },
  { status: 'accepted', label: 'Accept', cls: 'border-green-500/30 text-green-600 hover:bg-green-500/10 dark:text-green-400' },
  { status: 'rejected', label: 'Reject', cls: 'border-red-500/30 text-red-500 hover:bg-red-500/10' },
]

function ApplicantCard({
  application,
  onStatusChange,
}: {
  application: JobApplication
  onStatusChange: (id: string, status: JobApplicationStatus) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<JobApplicationStatus | null>(null)
  const applicant = application.profiles

  const act = async (status: JobApplicationStatus) => {
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
            <p className="font-bold text-gray-900 dark:text-white">{applicant?.full_name ?? 'Applicant'}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[application.status]}`}>
              {JOB_STATUS_LABELS[application.status]}
            </span>
            <span className="text-xs text-gray-400">{timeAgo(application.created_at)}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {applicant?.role && <span className="capitalize">{applicant.role}</span>}
            {applicant?.city && <span>{applicant.city}</span>}
            {applicant?.experience_years != null && <span>{applicant.experience_years}+ yrs exp</span>}
            {application.expected_salary != null && <span>${application.expected_salary.toLocaleString('en-US')}/mo</span>}
            {application.availability && <span>Avail: {application.availability}</span>}
          </div>

          {(applicant?.skills?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(applicant?.skills ?? []).slice(0, 6).map((skill) => (
                <span key={skill} className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-dark-400 dark:text-gray-300">
                  {skill}
                </span>
              ))}
            </div>
          )}

          {application.cover_letter && (
            <div className="mt-3 rounded-xl bg-gray-50 p-3 dark:bg-dark">
              <p className={`text-sm text-gray-600 dark:text-gray-400 ${expanded ? '' : 'line-clamp-2'}`}>
                {application.cover_letter}
              </p>
              {application.cover_letter.length > 140 && (
                <button onClick={() => setExpanded((prev) => !prev)} className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
                  {expanded ? (
                    <>
                      Read less <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      Read more <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {(application.resume_url || application.portfolio_url) && (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
              {application.resume_url && (
                <a href={application.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                  <FileText className="h-3.5 w-3.5" /> View resume
                </a>
              )}
              {application.portfolio_url && (
                <a href={application.portfolio_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> Portfolio
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {application.status !== 'accepted' && application.status !== 'rejected' && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 dark:border-dark-300">
          {ACTIONS.filter((a) => a.status !== application.status).map((action) => (
            <button
              key={action.status}
              onClick={() => act(action.status)}
              disabled={!!busy}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${action.cls}`}
            >
              {busy === action.status ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ManageJobApplications() {
  const { user } = useSession()
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadingApps, setLoadingApps] = useState(false)

  useEffect(() => {
    if (!user) return
    getMyJobs(user.id)
      .then((data) => {
        setJobs(data)
        if (data.length > 0) setSelectedId(data[0].id)
      })
      .catch(() => toast.error('Could not load your jobs'))
      .finally(() => setLoadingJobs(false))
  }, [user])

  const selectedJob = useMemo(() => jobs.find((j) => j.id === selectedId) ?? null, [jobs, selectedId])

  const loadApplications = useCallback(async (jobId: string) => {
    setLoadingApps(true)
    try {
      setApplications(await getApplicationsForJob(jobId))
    } catch {
      setApplications([])
    } finally {
      setLoadingApps(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) loadApplications(selectedId)
  }, [selectedId, loadApplications])

  const handleStatusChange = async (applicationId: string, status: JobApplicationStatus) => {
    try {
      await updateApplicationStatus(applicationId, status)
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, status } : a)))
      notifyJobStatus(applicationId, status)
      toast.success(`Application marked as ${status}`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    }
  }

  const handleToggleActive = async (job: Job) => {
    try {
      await toggleJobActive(job.id, job.is_active)
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, is_active: !j.is_active } : j)))
      toast.success(job.is_active ? 'Job paused' : 'Job activated')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    }
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const job of jobs) map[job.id] = job.applications_count ?? 0
    return map
  }, [jobs])

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Manage Job Applications</h1>
          <p className="mt-1 text-sm text-gray-500">Review and shortlist candidates for your open roles.</p>
        </div>
        <Link to="/jobs/post" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <Plus className="h-4 w-4" /> Post a job
        </Link>
      </div>

      {loadingJobs ? (
        <div className="flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No jobs posted yet"
          description="Post your first job to start receiving applications."
          action={{ label: 'Post a Job', to: '/jobs/post' }}
        />
      ) : (
        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="w-full flex-shrink-0 lg:w-72">
            <div className="flex flex-col gap-2">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => setSelectedId(job.id)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    selectedId === job.id
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 bg-white hover:border-primary/40 dark:border-dark-300 dark:bg-dark-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{job.title}</p>
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${job.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {counts[job.id] ?? 0} applications · <span className="capitalize">{job.job_type?.replace('_', ' ')}</span>
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleActive(job)
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {job.is_active ? 'Pause' : 'Activate'}
                    </button>
                    <Link to={`/jobs/${job.id}`} className="text-xs font-semibold text-gray-400 hover:text-primary">
                      View job
                    </Link>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {selectedJob && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedJob.title}</h2>
                  <span className="text-sm text-gray-500">
                    {applications.length} application{applications.length === 1 ? '' : 's'}
                  </span>
                </div>
                {loadingApps ? (
                  <div className="flex flex-col gap-3">
                    <SkeletonRow />
                    <SkeletonRow />
                  </div>
                ) : applications.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No applications yet"
                    description="Candidates who apply will show up here."
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {applications.map((app) => (
                      <ApplicantCard key={app.id} application={app} onStatusChange={handleStatusChange} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
