import { CheckCircle2, XCircle } from 'lucide-react'
import type { DataCoverage } from '../../types/startupInsights'

const FIELD_LABELS: Record<string, string> = {
  description: 'Description',
  tagline: 'Tagline',
  industry: 'Industry',
  stage: 'Stage',
  tech_stack: 'Tech stack',
  team_roles_needed: 'Needed roles',
  founder_profile: 'Founder profile',
  team_members: 'Team members',
  applications: 'Applications',
  business_plan: 'Business plan',
  data_room: 'Data room',
  cap_table: 'Cap table',
  pitch_deck: 'Pitch deck',
}

export function CoverageCard({ coverage }: { coverage?: DataCoverage }) {
  if (!coverage) return null
  const missing = (coverage.missing ?? []).filter((f) => FIELD_LABELS[f])
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-dark-300 dark:bg-dark">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        Data used for this analysis
      </h3>
      {coverage.available.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {coverage.available.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
            >
              <CheckCircle2 size={12} />
              {FIELD_LABELS[f] ?? f}
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">No data available yet.</p>
      )}
      {missing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {missing.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-dark-300 dark:text-gray-300"
            >
              <XCircle size={12} />
              {FIELD_LABELS[f] ?? f}
            </span>
          ))}
        </div>
      )}
      {coverage.insufficient ? (
        <p className="mt-3 rounded-xl bg-amber-100 p-3 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
          Not enough data for a reliable score yet. Add the missing details, then analyze again.
        </p>
      ) : null}
    </div>
  )
}
