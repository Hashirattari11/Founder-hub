import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Radar, ClipboardCheck, Target, RefreshCw, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'

interface DdSummary {
  reports_total: number
  recent_reports: { id: string; startup_id: string; score: number | null; risk_level?: string | null; updated_at?: string }[]
}

interface WrSummary {
  plans: number
  tasks: number
  task_status: Record<string, number>
  insights: number
  recent_ai_calls: { id?: number; tool_slug?: string; status?: string; error?: string | null; duration_ms?: number | null; created_at?: string }[]
}

interface AmSummary {
  total: number
  by_role: Record<string, number>
  saved: number
  dismissed: number
  avg_score: number
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon} {title}
      </h3>
      {children}
    </div>
  )
}

export default function AdminAiFeatures() {
  const [dd, setDd] = useState<DdSummary | null>(null)
  const [wr, setWr] = useState<WrSummary | null>(null)
  const [am, setAm] = useState<AmSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [ddR, wrR, amR] = await Promise.all([
        api.get<DdSummary>('/api/due-diligence/admin/summary', { auth: true }),
        api.get<WrSummary>('/api/war-room/admin/summary', { auth: true }),
        api.get<AmSummary>('/api/ai-matches/admin/summary', { auth: true }),
      ])
      setDd(ddR)
      setWr(wrR)
      setAm(amR)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load AI feature usage')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
        <div className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">AI Features Admin</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Usage and health of Due-Diligence, War Room and AI Matches.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-300"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-300"
          >
            <LayoutDashboard size={15} /> Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Due-Diligence" icon={<ClipboardCheck size={15} className="text-primary" />}>
          <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{dd?.reports_total ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">reports generated</p>
          {(dd?.recent_reports ?? []).length > 0 && (
            <ul className="mt-4 space-y-2 text-xs text-gray-600 dark:text-gray-300">
              {(dd?.recent_reports ?? []).slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{r.startup_id.slice(0, 8)}…</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-primary">{r.score ?? '—'}</span>
                    {r.risk_level && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 uppercase dark:bg-dark-300">
                        {r.risk_level}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="War Room" icon={<Radar size={15} className="text-primary" />}>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{wr?.plans ?? 0}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">plans</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{wr?.tasks ?? 0}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">tasks</p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{wr?.insights ?? 0}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">insights</p>
            </div>
          </div>
          {wr?.task_status && Object.keys(wr.task_status).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {Object.entries(wr.task_status).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-dark-300 dark:text-gray-300"
                >
                  {k}: {v}
                </span>
              ))}
            </div>
          )}
          {(wr?.recent_ai_calls ?? []).length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-3 dark:border-dark-300">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Recent AI calls (war_room_plan)
              </p>
              <ul className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                {(wr?.recent_ai_calls ?? []).slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-center justify-between">
                    <span
                      className={
                        c.status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {c.status}
                    </span>
                    <span>{c.duration_ms ?? '—'} ms</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="AI Matches" icon={<Target size={15} className="text-primary" />}>
          <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{am?.total ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            matches · avg score {am?.avg_score ?? '—'}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {am?.saved ?? 0} saved
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-dark-300 dark:text-gray-300">
              {am?.dismissed ?? 0} dismissed
            </span>
          </div>
          {am?.by_role && Object.keys(am.by_role).length > 0 && (
            <div className="mt-4 space-y-1.5">
              {Object.entries(am.by_role)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs">
                    <span className="capitalize text-gray-600 dark:text-gray-300">{k}</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{v}</span>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
