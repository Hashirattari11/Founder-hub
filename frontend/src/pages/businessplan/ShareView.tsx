import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FileText, Loader2, Rocket, ShieldCheck } from 'lucide-react'
import { getSharedBusinessPlan } from '../../lib/businessPlan'
import {
  FinancialsTab,
  PitchTab,
  ReadinessRing,
  RecommendationsTab,
  SectionBody,
  TeamTab,
} from './Viewer'
import type { BusinessPlanRecord } from '../../types/businessPlan'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'plan', label: 'Business Plan' },
  { key: 'pitch', label: 'Pitch Deck' },
  { key: 'financials', label: 'Financials' },
  { key: 'team', label: 'Team' },
  { key: 'recommendations', label: 'Recommendations' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function BusinessPlanShareView() {
  const { token } = useParams<{ token: string }>()
  const [plan, setPlan] = useState<BusinessPlanRecord | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const data = await getSharedBusinessPlan(token)
        setPlan(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load this business plan')
      } finally {
        setLoading(false)
      }
    })()
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 dark:from-dark dark:via-dark-100 dark:to-dark">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 p-6 dark:from-dark dark:via-dark-100 dark:to-dark">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center dark:border-red-500/30 dark:bg-dark-100">
          <p className="text-4xl">🔒</p>
          <h1 className="mt-3 text-lg font-bold">Link not available</h1>
          <p className="mt-1 text-sm text-gray-500">{error || 'This business plan could not be found.'}</p>
          <Link to="/" className="btn-primary mt-5">
            Go to FounderHub
          </Link>
        </div>
      </div>
    )
  }

  const readiness = plan.investor_readiness

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-fuchsia-50 dark:from-dark dark:via-dark-100 dark:to-dark">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
            <Rocket className="h-3.5 w-3.5" />
            Shared on FounderHub
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{plan.startup_name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500 sm:text-base">{plan.idea}</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-1.5 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 dark:border-dark-300 dark:bg-dark-100">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? 'bg-gradient-brand text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-dark-300 dark:hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <ReadinessRing score={readiness.overall} label={readiness.label} />
                <p className="flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{readiness.summary}</p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {readiness.scores.map((s) => (
                  <div key={s.label}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-600 dark:text-gray-300">{s.label}</span>
                      <span className="font-bold">{s.score}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-dark-300">
                      <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              This plan is shared read-only via a private link.
            </p>
          </div>
        )}
        {tab === 'plan' && (
          <div className="space-y-3">
            {plan.business_plan.map((section, idx) => (
              <details
                key={section.key}
                className="group overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100"
                open={idx === 0}
              >
                <summary className="flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {idx + 1}
                    </span>
                    <span className="font-bold">{section.title}</span>
                  </span>
                  <FileText className="h-4 w-4 text-gray-300 group-open:hidden dark:text-dark-300" />
                </summary>
                <div className="border-t border-gray-100 px-5 py-4 dark:border-dark-300">
                  <SectionBody content={section.content} />
                </div>
              </details>
            ))}
          </div>
        )}
        {tab === 'pitch' && <PitchTab plan={plan} />}
        {tab === 'financials' && <FinancialsTab plan={plan} />}
        {tab === 'team' && <TeamTab plan={plan} />}
        {tab === 'recommendations' && <RecommendationsTab plan={plan} />}
      </div>
    </div>
  )
}
