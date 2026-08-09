import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Activity, AlertTriangle, ArrowRight, Lightbulb, Sparkles, ThumbsUp } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { ScoreBar, ScoreRing } from '../../components/studio/ScoreRing'
import { CoverageCard } from '../../components/studio/CoverageCard'
import { StartupPicker } from '../../components/studio/StartupPicker'
import { analyzeStartupHealth, getStartupHealth } from '../../lib/startupInsights'
import type { HealthResponse } from '../../types/startupInsights'

export default function StartupHealth() {
  const [startupId, setStartupId] = useState<string | null>(null)
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (id: string, refresh = false) => {
    setLoading(true)
    try {
      const result = refresh ? await analyzeStartupHealth(id) : await getStartupHealth(id)
      setData(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load health score')
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
            <Activity size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">AI Startup Health Score</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              A transparent 0–100 score computed from your real startup data — no invented metrics.
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
            <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
            <div className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
          </div>
        )}

        {!loading && data && (
          <div className="mt-8 space-y-6">
            <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
              <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-8 dark:border-dark-300 dark:bg-dark">
                <ScoreRing score={data.score} label="Startup Health" />
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
                <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{data.summary}</p>
                {data.cached ? (
                  <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-dark-300 dark:text-gray-400">
                    <Sparkles size={12} /> Cached result — click "Analyze Again" to refresh
                  </p>
                ) : null}
                <div className="mt-5 space-y-4">
                  {data.categories.map((c) => (
                    <ScoreBar key={c.key} label={c.label} score={c.score} note={c.note} />
                  ))}
                </div>
              </div>
            </div>

            {data.data_coverage ? <CoverageCard coverage={data.data_coverage} /> : null}

            <div className="grid gap-6 md:grid-cols-2">
              {data.strengths.length > 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    <ThumbsUp size={16} /> Strengths
                  </h3>
                  <ul className="space-y-2">
                    {data.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">{s.title}:</span> {s.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.weaknesses.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 dark:border-red-500/20 dark:bg-red-500/10">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400">
                    <AlertTriangle size={16} /> Weaknesses
                  </h3>
                  <ul className="space-y-2">
                    {data.weaknesses.map((w, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">{w.title}:</span> {w.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {data.recommendations.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                  <Lightbulb size={16} className="text-primary" /> Recommended actions
                </h3>
                <ol className="space-y-2">
                  {data.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <span>
                        {r.action}
                        {r.priority === 'high' ? (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600 dark:bg-red-500/15 dark:text-red-400">
                            High
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Link
                to="/startups/create"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-200 dark:hover:bg-dark-300"
              >
                Improve your startup <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {!loading && !data && startupId && (
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">No analysis yet — pick a startup above.</p>
        )}
      </div>
    </div>
  )
}
