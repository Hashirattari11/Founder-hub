import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Activity, BarChart3, CheckCircle2, Cpu, RefreshCw, XCircle } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { adminAiAnalytics, adminAiUsage } from '../../api/admin'
import type { AiAnalyticsResponse, AiUsageLog } from '../../types/admin'
import { Badge, Card, EmptyRow, formatDateTime, LoadingBlock, PageHeader, StatCard, statusTone, TableHead, TableShell } from './adminUi'

const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }

export default function AdminAi() {
  const [tab, setTab] = useState<'analytics' | 'usage'>('analytics')

  return (
    <div>
      <PageHeader
        title="AI Management"
        description="AI usage analytics and per-run logs across the platform."
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            { key: 'analytics', label: 'Analytics', icon: BarChart3 },
            { key: 'usage', label: 'Usage Logs', icon: Activity },
          ] as { key: 'analytics' | 'usage'; label: string; icon: typeof BarChart3 }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-gradient-brand text-white shadow-md shadow-primary/20'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analytics' ? <AiAnalyticsTab /> : <AiUsageTab />}
    </div>
  )
}

function AiAnalyticsTab() {
  const [data, setData] = useState<AiAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await adminAiAnalytics())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load AI analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) return <LoadingBlock label="Loading AI analytics..." />
  if (!data) return null

  const maxRuns = Math.max(1, ...data.by_tool.map((t) => t.runs))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total runs" value={data.total_runs} icon={<Cpu className="h-4 w-4" />} />
        <StatCard label="Successful" value={data.successful_runs} icon={<CheckCircle2 className="h-4 w-4 text-green-500" />} />
        <StatCard label="Failed" value={data.failed_runs} icon={<XCircle className="h-4 w-4 text-red-500" />} />
        <StatCard label="Last 24h" value={data.last_24h} icon={<Activity className="h-4 w-4" />} />
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Runs by tool</h3>
        {data.by_tool.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No AI usage yet.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.by_tool} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.2} />
                <XAxis dataKey="tool" tick={{ ...AXIS_TICK, fontSize: 11 }} interval={0} angle={-20} height={60} textAnchor="end" />
                <YAxis tick={AXIS_TICK} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="runs" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {data.by_tool.slice(0, 8).map((t) => (
                <div key={t.tool}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{t.tool}</span>
                    <span className="text-gray-400">{t.runs} runs</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-dark-300">
                    <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${(t.runs / maxRuns) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Runs by provider</h3>
        {data.by_provider.length === 0 ? (
          <p className="text-sm text-gray-400">No usage yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.by_provider.map((p) => (
              <Badge key={p.provider} tone="blue">
                {p.provider} · {p.runs}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <AiInsightsStats />
    </div>
  )
}

function AiInsightsStats() {
  const [stats, setStats] = useState<{
    matches_total: number
    health_analyses: number
    team_gap_analyses: number
    investor_readiness_analyses: number
  } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/ai-insights/admin/summary', {
          headers: { Authorization: `Bearer ${(await import('../../lib/supabase').then((m) => m.supabase.auth.getSession())).data.session?.access_token ?? ''}` },
        })
        if (res.ok) setStats(await res.json())
      } catch {
        // ignore — stats are best-effort
      }
    })()
  }, [])

  if (!stats) return null
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">AI Startup Insights</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Matches created" value={stats.matches_total} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Health scores" value={stats.health_analyses} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Team gap analyses" value={stats.team_gap_analyses} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Investor readiness" value={stats.investor_readiness_analyses} icon={<Activity className="h-4 w-4" />} />
      </div>
    </Card>
  )
}

function AiUsageTab() {
  const [logs, setLogs] = useState<AiUsageLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminAiUsage(200)
      setLogs(res.logs)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load usage logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">Most recent AI tool runs across the platform.</p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <LoadingBlock label="Loading usage logs..." />
      ) : (
        <TableShell>
          <TableHead cells={['User', 'Tool', 'Provider', 'Status', 'Error', 'When']} />
          <tbody>
            {logs.length === 0 ? (
              <EmptyRow colSpan={6} message="No usage yet" />
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{log.user_name ?? 'Unknown'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{log.tool_slug}</td>
                  <td className="px-4 py-3">
                    <Badge tone="gray">{log.provider ?? '—'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(log.status)}>{log.status}</Badge>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-gray-400">{log.error ? <span className="text-red-500">{log.error}</span> : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(log.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}
