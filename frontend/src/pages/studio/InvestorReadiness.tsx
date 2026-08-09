import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, CheckCircle2, Sparkles, Wallet } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { ScoreBar, ScoreRing } from '../../components/studio/ScoreRing'
import { CoverageCard } from '../../components/studio/CoverageCard'
import { StartupPicker } from '../../components/studio/StartupPicker'
import { analyzeInvestorReadiness, getInvestorReadiness } from '../../lib/startupInsights'
import type { ReadinessResponse } from '../../types/startupInsights'

export default function InvestorReadiness() {
  const [startupId, setStartupId] = useState<string | null>(null)
  const [data, setData] = useState<ReadinessResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (id: string, refresh = false) => {
    setLoading(true)
    try {
      const result = refresh ? await analyzeInvestorReadiness(id) : await getInvestorReadiness(id)
      setData(result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not analyze investor readiness')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (startupId) void load(startupId)
  }, [startupId, load])

  const doneCount = data?.checklist.filter((c) => c.done).length ?? 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Wallet size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">AI Investor Readiness</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              How ready is your startup for investors? A data-driven score plus a concrete checklist.
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
                <ScoreRing score={data.score} label="Investor Readiness" />
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

            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Investor readiness checklist
                </h3>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {doneCount} of {data.checklist.length} done
                </span>
              </div>
              <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-dark-300">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{
                    width: `${data.checklist.length ? (doneCount / data.checklist.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <ul className="space-y-2">
                {data.checklist.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-gray-300 dark:text-dark-300" />
                    <span>
                      {c.item}
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500 dark:bg-dark-300 dark:text-gray-400">
                        {c.category}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/business-plan"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                Prepare me for investors <ArrowRight size={16} />
              </Link>
              <Link
                to="/ai-studio/matching"
                state={{ startupId, role: 'investor' }}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-200 dark:hover:bg-dark-300"
              >
                Find matching investors <ArrowRight size={16} />
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
