import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import {
  AdminAccessDenied,
  Badge,
  Card,
  EmptyRow,
  PageHeader,
  TableHead,
  TableShell,
} from './admin/adminUi'
import { formatDateTime } from './admin/adminUi'

interface EmailLogRow {
  id: string
  startup_id: string | null
  recipient_email: string
  email_type: string
  match_score: number | null
  status: string
  sent_at: string
}

const TYPE_LABELS: Record<string, string> = {
  investor_match: 'Investor match',
  developer_match: 'Talent match',
  new_application: 'New application',
  status_update: 'Status update',
  message: 'Message',
  connection: 'Connection',
}

export default function EmailLogs() {
  const [logs, setLogs] = useState<EmailLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get<{ logs: EmailLogRow[] }>('/api/admin/email-logs', { auth: true })
      .then((res) => setLogs(res.logs ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load email logs'),
      )
      .finally(() => setLoading(false))
  }, [])

  const today = logs.filter((l) => new Date(l.sent_at).toDateString() === new Date().toDateString()).length
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const thisWeek = logs.filter((l) => new Date(l.sent_at).getTime() >= weekAgo).length
  const byType = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.email_type] = (acc[l.email_type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <PageHeader
        title="Email Logs"
        description="Every smart email sent by the matching pipeline."
      />

      {error ? (
        <AdminAccessDenied />
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Today</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">{today}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">This week</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">{thisWeek}</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">By type</p>
              <div className="mt-1 space-y-0.5">
                {Object.entries(byType).map(([type, count]) => (
                  <p key={type} className="text-sm text-gray-600 dark:text-gray-300">
                    {TYPE_LABELS[type] ?? type}: <span className="font-bold">{count}</span>
                  </p>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-6">
            <TableShell>
              <TableHead cells={['Recipient', 'Type', 'Score', 'Status', 'Sent at']} />
              <tbody>
                {logs.length === 0 ? (
                  <EmptyRow colSpan={5} message="No emails sent yet. Publish a startup to see matches land here." />
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                      <td className="px-4 py-3 font-medium">{log.recipient_email}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {TYPE_LABELS[log.email_type] ?? log.email_type}
                      </td>
                      <td className="px-4 py-3">
                        {log.match_score != null ? (
                          <Badge tone="primary">{log.match_score}%</Badge>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={log.status === 'sent' ? 'green' : 'red'}>{log.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDateTime(log.sent_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableShell>
          </div>
        </>
      )}
    </div>
  )
}
