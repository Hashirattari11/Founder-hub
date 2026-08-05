import { memo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bookmark, BookmarkCheck, MapPin, TrendingUp } from 'lucide-react'
import { Avatar } from '../Avatar'
import type { Job } from '../../types'
import { timeAgo } from '../../lib/helpers'
import {
  JOB_TYPE_BADGE,
  JOB_TYPE_LABELS,
  EXPERIENCE_LABELS,
  formatSalary,
  formatJobLocation,
} from '../../lib/jobUi'

interface JobCardProps {
  job: Job
  match?: number
  saved?: boolean
  onToggleSave?: () => void
  showApply?: boolean
}

function JobCardInner({ job, match, saved, onToggleSave, showApply = true }: JobCardProps) {
  const startup = job.startups
  const type = job.job_type ?? 'full_time'
  const skills = job.skills_required ?? []

  return (
    <div className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 dark:border-dark-300 dark:bg-dark-100">
      {onToggleSave && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onToggleSave()
          }}
          aria-label={saved ? 'Unsave job' : 'Save job'}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:text-primary"
        >
          {saved ? <BookmarkCheck className="h-5 w-5 text-primary" /> : <Bookmark className="h-5 w-5" />}
        </button>
      )}

      <div className="flex items-center gap-3 pr-6">
        <Avatar src={null} name={startup?.name ?? '?'} size="md" className="flex-shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-500">{startup?.name ?? 'FounderHub'}</p>
          <Link
            to={`/jobs/${job.id}`}
            className="block truncate text-base font-bold text-gray-900 transition-colors hover:text-primary dark:text-white"
          >
            {job.title}
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${JOB_TYPE_BADGE[type]}`}>
          {JOB_TYPE_LABELS[type]}
        </span>
        {job.experience_level && (
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600 dark:bg-dark-200 dark:text-gray-300">
            {EXPERIENCE_LABELS[job.experience_level]}
          </span>
        )}
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <MapPin className="h-3 w-3" />
          {formatJobLocation(job)}
        </span>
      </div>

      <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {formatSalary(job)}
      </p>

      {skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {skills.slice(0, 4).map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:border-dark-400 dark:text-gray-300"
            >
              {skill}
            </span>
          ))}
          {skills.length > 4 && (
            <span className="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-xs font-medium text-gray-400">
              +{skills.length - 4} more
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-dark-300">
        <div className="flex items-center gap-3">
          {match !== undefined && match > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
              <TrendingUp className="h-3 w-3" />
              AI Match: {match}%
            </span>
          )}
          <span className="text-xs text-gray-400">{timeAgo(job.created_at)}</span>
        </div>
        <Link
          to={`/jobs/${job.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2"
        >
          {showApply ? 'Apply Now' : 'View'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

export const JobCard = memo(JobCardInner)
