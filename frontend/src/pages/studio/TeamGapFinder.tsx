import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, Handshake, Sparkles, Users } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { CoverageCard } from '../../components/studio/CoverageCard'
import { StartupPicker } from '../../components/studio/StartupPicker'
import { analyzeTeamGaps, getTeamGaps } from '../../lib/startupInsights'
import type { TeamGapsResponse } from '../../types/startupInsights'

const CRITICALITY_STYLE: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
}

export default function TeamGapFinder() {
  const [startupId, setStartupId] = useState<string | null>(null)
  const [data, setData] = useState<TeamGapsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (id: string, refresh = false) => {
    setLoading(true)
    try {
      const result = refresh ? await analyzeTeamGaps(id) : await getTeamGaps(id)
      setData(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not analyze team gaps')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (startupId) void load(startupId)
  }, [startupId, load])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">AI Team Gap Finder</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              See which roles your team is missing — then find matching people with one click.
            </p>
          </div>
        </div>

        <StartupPicker
          startupId={startupId}
          onChange={setStartupId}
          onRefresh={() => {
            setRefreshing(true)
            if (startupId) void load(startupId, true)
          }}
          refreshing={refreshing}
        />

        {loading && (
          <div className="mt-8 space-y-4">
            <div className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
            <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
          </div>
        )}

        {!loading && data && (
          <div className="mt-8 space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark">
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{data.summary}</p>
              {data.cached ? (
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-dark-300 dark:text-gray-400">
                  <Sparkles size={12} /> Cached result — click "Analyze Again" to refresh
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Current team ({data.present_roles.length})
              </h3>
              {data.present_roles.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No team roles detected yet — invite members or complete the founder profile.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.present_roles.map((r) => (
                    <span
                      key={r.role}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                    >
                      {r.role.replace('_', ' ')} ({r.member_count})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {data.data_coverage ? <CoverageCard coverage={data.data_coverage} /> : null}

            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Team gaps ({data.gaps.length})
              </h3>
              {data.gaps.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                  No critical gaps detected. Keep growing!
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {data.gaps.map((g) => (
                    <div
                      key={g.role}
                      className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white">{g.label}</h4>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CRITICALITY_STYLE[g.criticality] ?? CRITICALITY_STYLE.low}`}
                        >
                          {g.criticality}
                        </span>
                      </div>
                      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">{g.why}</p>
                      {g.suggested_skills.length > 0 && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {g.suggested_skills.map((s) => (
                            <span
                              key={s}
                              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-dark-300 dark:text-gray-300"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {g.responsibilities.length > 0 && (
                        <ul className="mb-3 space-y-1">
                          {g.responsibilities.slice(0, 3).map((r) => (
                            <li key={r} className="text-xs text-gray-500 dark:text-gray-400">
                              • {r}
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        to="/ai-studio/matching"
                        state={{ startupId, role: g.role }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
                      >
                        <Handshake size={14} /> {g.next_action}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Link
              to="/ai-studio/matching"
              state={{ startupId }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-200 dark:hover:bg-dark-300"
            >
              Open AI Matching <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {!loading && !data && startupId && (
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">No analysis yet — pick a startup above.</p>
        )}
      </div>
    </div>
  )
}
