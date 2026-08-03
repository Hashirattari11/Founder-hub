import { memo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bookmark, BookmarkCheck, TrendingUp } from 'lucide-react'
import { Avatar } from '../Avatar'
import type { Startup } from '../../types'
import { capitalize } from '../../lib/helpers'

interface StartupCardProps {
  startup: Startup
  match?: number
  showFunding?: boolean
  compact?: boolean
  saved?: boolean
  onToggleSave?: () => void
  showFounder?: boolean
}

function StartupCardInner({
  startup,
  match,
  showFunding,
  compact,
  saved,
  onToggleSave,
  showFounder = true,
}: StartupCardProps) {
  const founder = startup.profiles

  return (
    <div
      className={`relative flex flex-col rounded-2xl border border-gray-200 bg-white transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 dark:border-dark-300 dark:bg-dark-100 ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      {onToggleSave && (
        <button
          onClick={(e) => {
            e.preventDefault()
            onToggleSave()
          }}
          aria-label={saved ? 'Unsave startup' : 'Save startup'}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition-colors hover:text-primary"
        >
          {saved ? (
            <BookmarkCheck className="h-5 w-5 text-primary" />
          ) : (
            <Bookmark className="h-5 w-5" />
          )}
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className={`font-bold ${compact ? 'text-base' : 'text-lg'} leading-tight`}>
            {startup.name}
          </h3>
          {startup.tagline && (
            <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{startup.tagline}</p>
          )}
        </div>
        {match !== undefined && match > 0 && (
          <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
            <TrendingUp className="h-3 w-3" />
            {match}% match
          </span>
        )}
      </div>

      {startup.description && (
        <p className={`${compact ? 'mt-2 line-clamp-2 text-sm' : 'mt-3 line-clamp-2 text-sm leading-relaxed'} text-gray-600 dark:text-gray-400`}>
          {startup.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {startup.industry && (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {startup.industry}
          </span>
        )}
        {startup.stage && (
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
            {capitalize(startup.stage)}
          </span>
        )}
        {showFunding && startup.funding_needed && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-dark-200 dark:text-gray-300">
            {startup.funding_needed}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(startup.team_roles_needed ?? []).slice(0, 3).map((role) => (
          <span
            key={role}
            className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 dark:border-dark-400 dark:text-gray-300"
          >
            {role}
          </span>
        ))}
        {(startup.team_roles_needed ?? []).length > 3 && (
          <span className="rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-400">
            +{(startup.team_roles_needed ?? []).length - 3} more
          </span>
        )}
      </div>

      <div
        className={`mt-4 flex items-center justify-between border-t border-gray-200 text-sm dark:border-dark-300 ${
          compact ? 'pt-3' : 'pt-4'
        }`}
      >
        <div className="flex items-center gap-3 text-gray-500">
          {showFounder && founder && (
            <span className="flex items-center gap-1.5">
              <Avatar src={founder.avatar_url} name={founder.full_name} size="sm" className="h-6 w-6 text-[9px]" />
              <span className="hidden max-w-24 truncate text-xs sm:inline">
                {founder.full_name}
              </span>
            </span>
          )}
          {startup.equity_offered != null && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-600 dark:text-green-400">
              {startup.equity_offered}% equity
            </span>
          )}
        </div>
        <Link
          to={`/startups/${startup.id}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2"
        >
          View Details
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

export const StartupCard = memo(StartupCardInner)
