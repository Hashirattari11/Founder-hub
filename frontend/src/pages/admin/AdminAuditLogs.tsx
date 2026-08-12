import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import toast from 'react-hot-toast'
import { RefreshCw, ScrollText } from 'lucide-react'
import { adminAuditLogs } from '../../api/admin'
import type { AuditLog } from '../../types/admin'
import {
  Badge,
  Card,
  EmptyRow,
  formatDateTime,
  LoadingBlock,
  PageHeader,
  TableHead,
  TableShell,
} from './adminUi'

function jsonPreview(value: Record<string, unknown> | null | undefined) {
  if (!value) return null
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminAuditLogs(action || undefined)
      setLogs(res.logs)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setLoading(false)
    }
  }, [action])

  useEffect(() => {
    load()
  }, [load])

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))).sort(), [logs])

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Every admin action is recorded here for accountability."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setAction('')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            action === ''
              ? 'bg-gradient-brand text-white'
              : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
          }`}
        >
          All
        </button>
        {actions.slice(0, 20).map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              action === a
                ? 'bg-gradient-brand text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock label="Loading audit logs..." />
      ) : (
        <TableShell>
          <TableHead cells={['Admin', 'Action', 'Entity', 'Changes', 'IP', 'When']} />
          <tbody>
            {logs.length === 0 ? (
              <EmptyRow colSpan={6} message="No audit log entries" />
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {log.admin_email ?? log.admin_id?.slice(0, 8) ?? 'system'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="primary">{log.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-300">
                    {log.entity_type}
                    {log.entity_id ? ` · ${log.entity_id.slice(0, 12)}…` : ''}
                  </td>
                  <td className="max-w-[260px] px-4 py-3">
                    <div className="space-y-1 text-[11px]">
                      {jsonPreview(log.old_value) && (
                        <p className="text-gray-400">
                          <span className="font-semibold text-red-400">old</span> {jsonPreview(log.old_value)}
                        </p>
                      )}
                      {jsonPreview(log.new_value) && (
                        <p className="text-gray-400">
                          <span className="font-semibold text-green-400">new</span> {jsonPreview(log.new_value)}
                        </p>
                      )}
                      {!jsonPreview(log.old_value) && !jsonPreview(log.new_value) && (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{log.ip ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(log.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}

      {logs.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="flex items-center gap-2 text-xs text-gray-400">
            <ScrollText className="h-3.5 w-3.5" /> {logs.length} entries shown.
          </p>
        </Card>
      )}
    </div>
  )
}
