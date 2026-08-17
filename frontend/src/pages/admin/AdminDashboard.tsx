import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import {
  Activity,
  AlertTriangle,
  Bell,
  CreditCard,
  Rocket,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { adminOverview } from '../../api/admin'
import type { AdminOverviewResponse } from '../../types/admin'
import { Badge, Card, formatMoney, PageHeader, StatCard, statusTone } from './adminUi'
import { Seo } from '../../components/Seo'

export default function AdminDashboard() {
  const [data, setData] = useState<AdminOverviewResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [live, setLive] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await adminOverview())
      setError('')
    } catch (err) {
      setError(getErrorMessage(err, 'generic'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Live auto-refresh: poll every 30s while visible and enabled.
  useEffect(() => {
    if (!live) return
    let interval: ReturnType<typeof setInterval>
    const start = () => {
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') load()
      }, 30_000)
    }
    start()
    const onVisibility = () => {
      clearInterval(interval)
      start()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [live, load])

  const stats = data && [
    { label: 'Total users', value: data.users.total, icon: <Users className="h-4 w-4" />, sub: `${data.users.new_7d} new in 7 days` },
    { label: 'Startups', value: data.startups.total, icon: <Rocket className="h-4 w-4" />, sub: `${data.startups.published} published` },
    { label: 'Investors', value: data.investors, icon: <Wallet className="h-4 w-4" /> },
    { label: 'Pending role requests', value: data.role_requests.pending, icon: <UserPlus className="h-4 w-4" /> },
    { label: 'Open reports', value: data.reports.open, icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> },
    { label: 'Unread notifications', value: data.notifications.unread, icon: <Bell className="h-4 w-4" /> },
    { label: 'Active subscriptions', value: data.subscriptions.active, icon: <CreditCard className="h-4 w-4" />, sub: formatMoney(data.subscriptions.mrr_cents) + ' MRR' },
    { label: 'Requests today', value: data.request_stats.today?.requests ?? 0, icon: <Activity className="h-4 w-4" />, sub: `${data.request_stats.today?.avg_latency_ms ?? 0}ms avg latency` },
  ]

  if (error) {
    return (
      <div>
        <PageHeader title="Admin Dashboard" />
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="font-semibold text-red-600 dark:text-red-400">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <Seo title="Admin Dashboard — FounderHub" />
      <PageHeader
        title="Admin Dashboard"
        description="Platform-wide overview of users, startups, revenue and activity."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLive((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                live
                  ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400'
                  : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300'
              }`}
              title={live ? 'Live auto-refresh is on (30s)' : 'Live auto-refresh is off'}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-green-500' : 'bg-gray-400'}`} />
              Live
            </button>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        }
      />

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats?.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} sub={s.sub} />
          ))}
        </div>
      )}

      {data?.request_stats.today && (
        <Card className="mt-6 p-5">
          <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Today's API traffic</h3>
          <div className="flex flex-wrap gap-4">
            <Badge tone={statusTone('ok')}>
              {data.request_stats.today.requests} requests
            </Badge>
            <Badge tone={statusTone(data.request_stats.today.errors > 0 ? 'failed' : 'ok')}>
              {data.request_stats.today.errors} errors
            </Badge>
            <Badge tone="blue">{data.request_stats.today.avg_latency_ms}ms avg latency</Badge>
          </div>
        </Card>
      )}
    </div>
  )
}
