import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, Lightbulb, Sparkles } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { exploreStartups } from '../../lib/startups'
import { getStartupHealth } from '../../lib/startupInsights'
import { ScoreRing, ScoreBar } from '../../components/studio/ScoreRing'
import { CoverageCard } from '../../components/studio/CoverageCard'
import type { HealthResponse } from '../../types/startupInsights'
import type { Startup } from '../../types'

export default function StartupAnalyzer() {
  const { user } = useSession()
  const [startups, setStartups] = useState<Startup[]>([])
  const [startupId, setStartupId] = useState<string | null>(null)
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const loadHealth = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const result = await getStartupHealth(id)
      setData(result)
    } catch {
      toast.error('Could not analyze this startup')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load all published startups, auto-select the first one.
  useEffect(() => {
    let active = true
    if (!user) return
    ;(async () => {
      try {
        const result = await exploreStartups({ page: 0, pageSize: 200 })
        if (!active) return
        setStartups(result.startups)
        if (result.startups.length > 0) {
          setStartupId(result.startups[0].id)
          void loadHealth(result.startups[0].id)
        }
      } catch {
        if (!active) return
        toast.error('Could not load startups')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const onSelect = (id: string) => {
    setStartupId(id)
    setData(null)
    void loadHealth(id)
  }

  const base =
    'w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark dark:text-white'

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles size={22} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">AI Startup Analyzer</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Analyze any startup's health — score, strengths, weaknesses, and what to improve.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Select startup to analyze
          </label>
          {startups.length === 0 && !loading ? (
            <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500 dark:bg-dark dark:text-gray-400">
              No published startups to analyze yet.
            </p>
          ) : (
            <select value={startupId ?? ''} onChange={(e) => onSelect(e.target.value)} className={base}>
              {startups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

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
                  <Sparkles size={12} /> Cached result — refreshes when the founder updates their startup
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
                <h3 className="mb-3 text-sm font-bold text-emerald-700 dark:text-emerald-400">Strengths</h3>
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
                <h3 className="mb-3 text-sm font-bold text-red-700 dark:text-red-400">Weaknesses</h3>
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
              to="/explore"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-200 dark:hover:bg-dark-300"
            >
              Explore more startups <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      {!loading && !data && startupId && (
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">No analysis available yet — pick a startup above.</p>
      )}
    </div>
  )
}
