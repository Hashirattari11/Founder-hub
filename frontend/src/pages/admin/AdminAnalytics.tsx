import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Activity, BarChart3, RefreshCw, TrendingUp, Users } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { adminAnalytics } from '../../api/admin'
import type { AnalyticsResponse } from '../../types/admin'
import { Badge, Card, LoadingBlock, PageHeader, StatCard } from './adminUi'

const AXIS_TICK = { fill: '#9ca3af', fontSize: 12 }

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await adminAnalytics())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) return <LoadingBlock label="Loading analytics..." />
  if (!data) return null

  const registrations = Object.entries(data.users.registrations_by_day)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({ day, count }))

  const requestStats = [...data.request_stats]
    .reverse()
    .map((r) => ({ day: r.day.slice(5), requests: r.requests, errors: r.errors, latency: Math.round(r.avg_latency_ms) }))

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Platform growth, activity and traffic."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={data.users.total} icon={<Users className="h-4 w-4" />} />
        <StatCard label="DAU" value={data.activity.dau} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="MAU" value={data.activity.mau} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Analytics events" value={data.activity.events_total} icon={<BarChart3 className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Users by role</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.users.by_role} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.2} />
              <XAxis type="number" tick={AXIS_TICK} />
              <YAxis type="category" dataKey="role" width={110} tick={{ ...AXIS_TICK, fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Registrations (last 30 days)</h3>
          {registrations.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">No registrations in the last 30 days.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={registrations} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.2} />
                <XAxis dataKey="day" tick={AXIS_TICK} minTickGap={24} />
                <YAxis tick={AXIS_TICK} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mb-1 text-sm font-bold text-gray-900 dark:text-white">API request stats (last 30 days)</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge tone="blue">requests</Badge>
          <Badge tone="red">errors</Badge>
        </div>
        {requestStats.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No request stats recorded yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={requestStats} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.2} />
              <XAxis dataKey="day" tick={AXIS_TICK} minTickGap={24} />
              <YAxis tick={AXIS_TICK} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#fff' }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Line type="monotone" dataKey="requests" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}
