import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { JobApplyModal } from '../../components/jobs/ApplyModal'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { useSession } from '../../context/AuthContext'
import {
  getJob,
  incrementJobViews,
  hasAppliedToJob,
  toggleSavedJob,
  getSavedJobIds,
  calcJobMatch,
} from '../../lib/jobs'
import { JOB_TYPE_BADGE, JOB_TYPE_LABELS, EXPERIENCE_LABELS, formatSalary, formatJobLocation } from '../../lib/jobUi'
import type { Job } from '../../types'

function RequirementList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useSession()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [applyOpen, setApplyOpen] = useState(false)
  const [applied, setApplied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [match, setMatch] = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setApplied(false)
    getJob(id)
      .then(async (data) => {
        setJob(data)
        if (data) {
          incrementJobViews(id, data.views_count ?? 0)
          if (user) {
            const [hasApplied, savedIds] = await Promise.all([
              hasAppliedToJob(id, user.id),
              getSavedJobIds(user.id),
            ])
            setApplied(hasApplied)
            setSaved(savedIds.has(id))
            if (profile) setMatch(await calcJobMatch(data, profile))
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id, user, profile])

  const handleToggleSave = async () => {
    if (!user || !job) return
    const nowSaved = await toggleSavedJob(user.id, job.id)
    setSaved(nowSaved)
  }

  const handleApplied = useCallback(() => {
    setApplied(true)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="Job Details" backTo="/jobs" backLabel="Back to Jobs" />
        <main className="mx-auto max-w-4xl px-4 pt-10 pb-24 lg:pb-10">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading job…
          </div>
        </main>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="Job Details" backTo="/jobs" backLabel="Back to Jobs" />
        <main className="mx-auto max-w-4xl px-4 pt-10 pb-24 lg:pb-10">
          <EmptyState icon={Briefcase} title="Job not found" description="This job may have been removed." action={{ label: 'Browse jobs', to: '/jobs' }} />
        </main>
      </div>
    )
  }

  const isOwner = user?.id === job.posted_by
  const type = job.job_type ?? 'full_time'
  const requirements = job.requirements ?? []
  const niceToHave = job.nice_to_have ?? []
  const skills = job.skills_required ?? []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Job Details" backTo="/jobs" backLabel="Back to Jobs" />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:px-6 lg:pb-6">
        <Link to="/jobs" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> All jobs
        </Link>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <Avatar src={null} name={job.startups?.name ?? '?'} size="lg" className="flex-shrink-0 rounded-2xl" />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{job.title}</h1>
                    <p className="mt-1 text-sm font-medium text-gray-500">{job.startups?.name ?? 'FounderHub'}</p>
                  </div>
                </div>
                <button
                  onClick={handleToggleSave}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition-colors hover:border-primary hover:text-primary dark:border-dark-300"
                  aria-label={saved ? 'Unsave job' : 'Save job'}
                >
                  {saved ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${JOB_TYPE_BADGE[type]}`}>
                  {JOB_TYPE_LABELS[type]}
                </span>
                {job.experience_level && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-dark-200 dark:text-gray-300">
                    {EXPERIENCE_LABELS[job.experience_level]}
                  </span>
                )}
                {job.industry && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-dark-200 dark:text-gray-300">
                    {job.industry}
                  </span>
                )}
                {!job.is_active && (
                  <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500">
                    Closed
                  </span>
                )}
              </div>

              <div className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">
                {job.description}
              </div>

              {requirements.length > 0 && (
                <div className="mt-8">
                  <RequirementList title="Requirements" items={requirements} />
                </div>
              )}

              {niceToHave.length > 0 && (
                <div className="mt-8">
                  <RequirementList title="Nice to have" items={niceToHave} />
                </div>
              )}

              {skills.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Skills</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600 dark:border-dark-400 dark:text-gray-300"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="w-full flex-shrink-0 lg:w-80">
            <div className="sticky top-24 flex flex-col gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Briefcase className="h-4 w-4" /> Type
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{JOB_TYPE_LABELS[type]}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-500">
                      <MapPin className="h-4 w-4" /> Location
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{formatJobLocation(job)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-500">
                      <TrendingUp className="h-4 w-4" /> Salary
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{formatSalary(job)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Eye className="h-4 w-4" /> Views
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{(job.views_count ?? 0).toLocaleString('en-US')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Users className="h-4 w-4" /> Applicants
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{job.applications_count ?? 0}</span>
                  </div>
                  {job.application_deadline && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-gray-500">
                        <Calendar className="h-4 w-4" /> Deadline
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">
                        {new Date(job.application_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-gray-500">
                      <Clock className="h-4 w-4" /> Posted
                    </span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                {match > 0 && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <div className="text-xs">
                      <p className="font-bold text-primary">AI Match: {match}%</p>
                      <p className="text-gray-500">based on your skills &amp; experience</p>
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-2">
                  {isOwner ? (
                    <Link to="/dashboard/manage-jobs" className="btn-primary flex items-center justify-center gap-2">
                      <Users className="h-4 w-4" /> Manage applications
                    </Link>
                  ) : applied ? (
                    <Link to="/dashboard/job-applications" className="flex items-center justify-center gap-2 rounded-xl bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-600">
                      <CheckCircle2 className="h-4 w-4" /> Applied — view status
                    </Link>
                  ) : job.is_active ? (
                    <button onClick={() => setApplyOpen(true)} className="btn-primary flex items-center justify-center gap-2">
                      <Send className="h-4 w-4" /> Apply now
                    </button>
                  ) : (
                    <button disabled className="cursor-not-allowed rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-400">
                      Applications closed
                    </button>
                  )}
                </div>
              </div>

              {job.profiles && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Posted by</h3>
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar src={job.profiles.avatar_url} name={job.profiles.full_name} size="md" />
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{job.profiles.full_name}</p>
                      <p className="flex items-center gap-1 text-xs text-gray-500">
                        <Globe className="h-3 w-3" /> FounderHub member
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <JobApplyModal job={job} open={applyOpen} onClose={() => setApplyOpen(false)} onApplied={handleApplied} />
    </div>
  )
}
