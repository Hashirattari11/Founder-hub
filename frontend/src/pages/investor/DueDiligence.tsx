import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import toast from 'react-hot-toast'
import { ClipboardCheck, RefreshCw, Lock, FileText, ShieldAlert, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSession } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { exploreStartups } from '../../lib/startups'
import { ScoreRing, ScoreBar } from '../../components/studio/ScoreRing'
import { CoverageCard } from '../../components/studio/CoverageCard'
import type { Startup } from '../../types'
import type { DataCoverage } from '../../types/startupInsights'

interface DDSection {
  title: string
  score: number
  max: number
  note?: string
}

interface DDReport {
  id?: string
  insufficient?: boolean
  cached?: boolean
  score: number | null
  risk_level?: string | null
  summary?: string
  why_score?: string
  sector_notes?: string
  sections?: DDSection[]
  strengths?: { title: string; detail: string }[]
  weaknesses?: { title: string; detail: string; impact?: string }[]
  risks?: { title: string; detail: string; severity?: string }[]
  missing_info?: string[]
  questions?: string[]
  next_steps?: string[]
  data_coverage?: DataCoverage
  last_analyzed?: string
  has_dd_access?: boolean
  dd_access_status?: string | null
  data_room_score?: number | null
}

const riskColor: Record<string, string> = {
  LOW: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  HIGH: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
}

export default function DueDiligence() {
  const { user } = useSession()
  const [startups, setStartups] = useState<Startup[]>([])
  const [startupId, setStartupId] = useState<string | null>(null)
  const [report, setReport] = useState<DDReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [requesting, setRequesting] = useState(false)

  const loadReport = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const result = await api.get<DDReport>(`/api/due-diligence/startups/${id}/reports`, { auth: true })
      setReport(result)
    } catch {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [])

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
          void loadReport(result.startups[0].id)
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
    setReport(null)
    void loadReport(id)
  }

  const generate = async () => {
    if (!startupId) return
    setGenerating(true)
    try {
      const result = await api.post<DDReport>(`/api/due-diligence/startups/${startupId}/reports`, {}, { auth: true })
      setReport(result)
      toast.success(result.insufficient ? 'Data coverage report ready' : 'Due-diligence report generated')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setGenerating(false)
    }
  }

  const requestAccess = async () => {
    if (!startupId) return
    setRequesting(true)
    try {
      const result = await api.post<{ request_status: string }>(`/api/due-diligence/startups/${startupId}/request-access`, {}, { auth: true })
      setReport((r) => (r ? { ...r, dd_access_status: result.request_status } : r))
      toast.success('Access request sent to the founder')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setRequesting(false)
    }
  }

  const base =
    'w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark dark:text-white'

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardCheck size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">AI Due-Diligence</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Investor-grade analysis of any startup — score, risk, and what to verify before investing.
            </p>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-300"
        >
          <LayoutDashboard size={15} /> Back to Dashboard
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Select startup
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
        <button
          onClick={generate}
          disabled={generating || !startupId}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <RefreshCw size={16} className={generating ? 'animate-spin' : ''} />
          {generating ? 'Analyzing…' : report ? 'Refresh Analysis' : 'Generate Report'}
        </button>
      </div>

      {loading && (
        <div className="mt-8 space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
          <div className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
        </div>
      )}

      {!loading && report && (
        <div className="mt-8 space-y-6">
          {report.insufficient ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-500/30 dark:bg-amber-500/10">
              <div className="mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <ShieldAlert size={18} />
                <h2 className="font-bold">Not enough data to score yet</h2>
              </div>
              <p className="text-sm text-amber-700/90 dark:text-amber-300/90">{report.summary}</p>
              {report.data_coverage && <CoverageCard coverage={report.data_coverage} />}
            </div>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
                <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-8 dark:border-dark-300 dark:bg-dark">
                  <ScoreRing score={report.score} label="Due-Diligence Score" />
                  {report.risk_level && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        riskColor[report.risk_level] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {report.risk_level} risk
                    </span>
                  )}
                  {report.cached && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cached result</p>
                  )}
                  {report.last_analyzed && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last analyzed: {new Date(report.last_analyzed).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
                  <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-white">Summary</h2>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{report.summary}</p>
                  {report.why_score && (
                    <>
                      <h3 className="mt-4 mb-1 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        Why this score
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{report.why_score}</p>
                    </>
                  )}
                  {report.sector_notes && (
                    <p className="mt-3 text-xs italic text-gray-500 dark:text-gray-400">{report.sector_notes}</p>
                  )}

                  {report.has_dd_access ? (
                    <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <Lock size={12} /> Data Room access granted
                    </span>
                  ) : (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {report.dd_access_status === 'pending' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                          Access request pending founder approval
                        </span>
                      ) : (
                        <button
                          onClick={requestAccess}
                          disabled={requesting}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                        >
                          <Lock size={12} /> Request Data Room access
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Section Scores
                  </h3>
                  <div className="space-y-3">
                    {(report.sections ?? []).map((s) => (
                      <ScoreBar key={s.title} label={s.title} score={s.score} note={s.note} />
                    ))}
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Strengths
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      {(report.strengths ?? []).map((s) => (
                        <li key={s.title}>
                          <span className="font-semibold text-gray-800 dark:text-gray-100">{s.title}.</span>{' '}
                          {s.detail}
                        </li>
                      ))}
                      {(report.strengths ?? []).length === 0 && <li>None identified yet.</li>}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Weaknesses
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      {(report.weaknesses ?? []).map((w) => (
                        <li key={w.title}>
                          <span className="font-semibold text-gray-800 dark:text-gray-100">{w.title}.</span>{' '}
                          {w.detail}
                        </li>
                      ))}
                      {(report.weaknesses ?? []).length === 0 && <li>None identified yet.</li>}
                    </ul>
                  </div>
                </div>
              </div>

              {report.risks && report.risks.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-500/30 dark:bg-red-500/10">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                    Key Risks
                  </h3>
                  <ul className="space-y-2 text-sm text-red-700/90 dark:text-red-300/90">
                    {report.risks.map((r) => (
                      <li key={r.title}>
                        <span className="font-semibold">{r.title}.</span> {r.detail}
                        {r.severity && (
                          <span className="ml-2 rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-bold uppercase dark:bg-red-500/20">
                            {r.severity}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Missing Information
                  </h3>
                  <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                    {(report.missing_info ?? []).map((m) => (
                      <li key={m} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" /> {m}
                      </li>
                    ))}
                    {(report.missing_info ?? []).length === 0 && <li>Nothing missing.</li>}
                  </ul>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Questions to Ask
                  </h3>
                  <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
                    {(report.questions ?? []).map((q) => (
                      <li key={q} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" /> {q}
                      </li>
                    ))}
                    {(report.questions ?? []).length === 0 && <li>No open questions.</li>}
                  </ul>
                </div>
              </div>

              {report.next_steps && report.next_steps.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <FileText size={14} /> Recommended Next Steps
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {report.next_steps.map((n) => (
                      <li key={n} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" /> {n}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!loading && !report && !generating && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-dark-300">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Select a startup and generate its due-diligence report. Scores are computed only from real data —
            nothing is invented.
          </p>
        </div>
      )}
    </div>
  )
}
