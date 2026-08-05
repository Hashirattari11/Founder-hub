import { useEffect, useState } from 'react'
import { Mail, Loader2, ShieldAlert } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { api } from '../lib/api'
import { formatDate } from '../lib/helpers'

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
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Email Logs" backTo="/dashboard" />
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-24 sm:px-6 lg:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">Email Logs</h1>
            <p className="text-sm text-gray-500">Every smart email sent by the matching pipeline.</p>
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-500/30 dark:bg-red-500/10">
            <ShieldAlert className="h-8 w-8 text-red-500" />
            <p className="font-semibold text-red-600 dark:text-red-400">{error}</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              This page is for admins only. If you're an admin, make sure the profile has
              <code className="mx-1 rounded bg-gray-200 px-1.5 py-0.5 text-xs">is_admin = true</code>
            </p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Today</p>
                <p className="mt-1 text-2xl font-extrabold text-primary">{today}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">This week</p>
                <p className="mt-1 text-2xl font-extrabold text-primary">{thisWeek}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">By type</p>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(byType).map(([type, count]) => (
                    <p key={type} className="text-sm text-gray-600 dark:text-gray-300">
                      {TYPE_LABELS[type] ?? type}: <span className="font-bold">{count}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-dark-300">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Recipient</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Sent at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                          No emails sent yet. Publish a startup to see matches land here.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                          <td className="px-4 py-3 font-medium">{log.recipient_email}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {TYPE_LABELS[log.email_type] ?? log.email_type}
                          </td>
                          <td className="px-4 py-3">
                            {log.match_score != null ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                                {log.match_score}%
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                log.status === 'sent'
                                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                                  : 'bg-red-500/10 text-red-500'
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{formatDate(log.sent_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
