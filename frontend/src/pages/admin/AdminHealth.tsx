import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import toast from 'react-hot-toast'
import { Activity, Database, KeyRound, RefreshCw, Server } from 'lucide-react'
import { adminHealth } from '../../api/admin'
import type { HealthResponse } from '../../types/admin'
import { Badge, Card, formatDuration, PageHeader, StatCard, statusTone } from './adminUi'

export default function AdminHealth() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await adminHealth())
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const tableRows = data ? Object.entries(data.tables) : []

  return (
    <div>
      <PageHeader
        title="Health"
        description="Live status of the FounderHub API, database and auth service."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      {!data && loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100" />
          ))}
        </div>
      ) : !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="API status"
              value={
                <span className="flex items-center gap-2">
                  {data.status === 'ok' ? 'Operational' : 'Degraded'}
                  <Badge tone={statusTone(data.status)}>{data.status}</Badge>
                </span>
              }
              icon={<Server className="h-4 w-4" />}
            />
            <StatCard
              label="Uptime"
              value={formatDuration(data.uptime_seconds)}
              icon={<Activity className="h-4 w-4" />}
            />
            <StatCard
              label="Database"
              value={data.database.ok ? 'Connected' : 'Down'}
              sub={`${data.database.latency_ms}ms latency`}
              icon={<Database className="h-4 w-4" />}
            />
            <StatCard
              label="Auth"
              value={data.auth.ok ? 'Connected' : 'Down'}
              sub={`${data.auth.latency_ms}ms latency`}
              icon={<KeyRound className="h-4 w-4" />}
            />
          </div>

          <Card className="mt-6 p-5">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Table row counts</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tableRows.map(([table, count]) => (
                <div key={table} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-dark-300">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{table}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {count < 0 ? 'unreachable' : count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
