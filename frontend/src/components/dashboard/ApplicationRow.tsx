import { Avatar } from '../Avatar'
import type { Application } from '../../data/mock'

const statusStyles: Record<Application['status'], string> = {
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  shortlisted: 'bg-green-500/15 text-green-600 dark:text-green-400',
  rejected: 'bg-red-500/15 text-red-500',
}

interface ApplicationRowProps {
  application: Application
}

export function ApplicationRow({ application }: ApplicationRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-primary/30 dark:border-dark-300 dark:bg-dark-100">
      <Avatar name={application.applicant} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{application.applicant}</p>
        <p className="truncate text-xs text-gray-500">
          {application.role} · {application.startup}
        </p>
      </div>

      <div className="hidden items-center gap-2 sm:flex">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-200">
            <div
              className="h-full rounded-full bg-gradient-brand"
              style={{ width: `${application.match}%` }}
            />
          </div>
          <span className="text-xs font-bold text-primary">{application.match}%</span>
        </div>
      </div>

      <span
        className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusStyles[application.status]}`}
      >
        {application.status}
      </span>
    </div>
  )
}
