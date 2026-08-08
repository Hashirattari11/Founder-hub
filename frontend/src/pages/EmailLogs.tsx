import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, RefreshCw, Send, Mail, MailCheck, MailX, RotateCcw, Zap } from 'lucide-react'
import { api } from '../lib/api'
import {
  getEmailQueue,
  retryFailedEmails,
  sendBroadcast,
  getEmailAnalytics,
  sendTestEmail,
  type EmailQueueRow,
} from '../lib/notifications'
import {
  AdminAccessDenied,
  Badge,
  Card,
  EmptyRow,
  PageHeader,
  StatCard,
  TableHead,
  TableShell,
  formatDateTime,
} from './admin/adminUi'

interface EmailLogRow {
  id: string
  startup_id: string | null
  recipient_email: string
  email_type: string
  match_score: number | null
  status: string
  subject?: string | null
  template?: string | null
  sent_at: string
}

const TYPE_LABELS: Record<string, string> = {
  investor_match: 'Investor match',
  developer_match: 'Talent match',
  new_application: 'New application',
  status_update: 'Status update',
  message: 'Message',
  connection: 'Connection',
  broadcast: 'Broadcast',
  meeting_invite: 'Meeting invite',
  meeting_reminder: 'Meeting reminder',
  meeting_cancelled: 'Meeting cancelled',
  application_accepted: 'Application accepted',
  application_rejected: 'Application rejected',
  role_approved: 'Role approved',
  role_rejected: 'Role rejected',
  startup_approved: 'Startup approved',
  investor_interested: 'Investor interested',
  test_email: 'Test email',
}

const emailTone = (status: string): 'green' | 'red' | 'amber' | 'blue' | 'gray' => {
  switch (status) {
    case 'sent':
    case 'delivered':
      return 'green'
    case 'opened':
    case 'clicked':
      return 'blue'
    case 'queued':
      return 'amber'
    case 'sending':
      return 'blue'
    case 'bounced':
    case 'blocked':
      return 'amber'
    case 'failed':
      return 'red'
    default:
      return 'gray'
  }
}

const QUEUE_STATUSES: { status: string; dot: string }[] = [
  { status: 'queued', dot: 'bg-amber-400' },
  { status: 'sending', dot: 'bg-blue-400' },
  { status: 'sent', dot: 'bg-green-500' },
  { status: 'delivered', dot: 'bg-green-500' },
  { status: 'opened', dot: 'bg-blue-500' },
  { status: 'clicked', dot: 'bg-purple-500' },
  { status: 'failed', dot: 'bg-red-500' },
  { status: 'bounced', dot: 'bg-amber-500' },
  { status: 'blocked', dot: 'bg-amber-500' },
]

export default function EmailLogs() {
  const [logs, setLogs] = useState<EmailLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [queue, setQueue] = useState<EmailQueueRow[]>([])
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({})
  const [analytics, setAnalytics] = useState({ total: 0, sent: 0, failed: 0, delivery_rate: 0 })
  const [queueLoading, setQueueLoading] = useState(false)

  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [bTitle, setBTitle] = useState('')
  const [bBody, setBBody] = useState('')
  const [bEmail, setBEmail] = useState(true)
  const [bSending, setBSending] = useState(false)

  const [testOpen, setTestOpen] = useState(false)
  const [tEmail, setTEmail] = useState('')
  const [tSending, setTSending] = useState(false)

  const loadLogs = () => {
    api
      .get<{ logs: EmailLogRow[] }>('/api/admin/email-logs', { auth: true })
      .then((res) => setLogs(res.logs ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load email logs'),
      )
      .finally(() => setLoading(false))
  }

  const loadQueue = async () => {
    setQueueLoading(true)
    try {
      const res = await getEmailQueue()
      setQueue(res.queue)
      setQueueCounts(res.counts)
    } catch {
      // best effort
    } finally {
      setQueueLoading(false)
    }
  }

  const loadAnalytics = async () => {
    try {
      const res = await getEmailAnalytics()
      setAnalytics(res)
    } catch {
      // best effort
    }
  }

  useEffect(() => {
    loadLogs()
    loadQueue()
    loadAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRetry = async () => {
    const count = await retryFailedEmails()
    toast.success(`Re-queued ${count} failed emails`)
    loadQueue()
  }

  const handleBroadcast = async () => {
    if (!bTitle.trim() || !bBody.trim()) {
      toast.error('Title and body are required')
      return
    }
    setBSending(true)
    try {
      const count = await sendBroadcast({ title: bTitle, body: bBody, send_email: bEmail })
      toast.success(`Broadcast sent to ${count} users`)
      setBroadcastOpen(false)
      setBTitle('')
      setBBody('')
      loadLogs()
      loadQueue()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Broadcast failed')
    } finally {
      setBSending(false)
    }
  }

  const handleTestEmail = async () => {
    if (!tEmail.trim()) {
      toast.error('Enter a recipient email')
      return
    }
    setTSending(true)
    try {
      const res = await sendTestEmail(tEmail.trim())
      toast.success(`Test email sent to ${res.recipient}`)
      setTestOpen(false)
      setTEmail('')
      loadLogs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test email failed')
    } finally {
      setTSending(false)
    }
  }

  const today = logs.filter((l) => new Date(l.sent_at).toDateString() === new Date().toDateString()).length
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const thisWeek = logs.filter((l) => new Date(l.sent_at).getTime() >= weekAgo).length

  if (error) return <AdminAccessDenied />

  return (
    <div>
      <PageHeader
        title="Email Operations"
        description="Transactional email logs, queue monitor and broadcasts."
        actions={
          <>
            <button onClick={() => { loadQueue(); loadLogs(); loadAnalytics() }} className="btn-secondary">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button onClick={() => setTestOpen((v) => !v)} className="btn-secondary">
              <Zap className="h-4 w-4" /> Test Email
            </button>
            <button onClick={() => setBroadcastOpen((v) => !v)} className="btn-primary">
              <Send className="h-4 w-4" /> Broadcast
            </button>
          </>
        }
      />

      {/* Analytics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total sent" value={analytics.total} icon={<Mail className="h-4 w-4" />} color="text-primary" />
        <StatCard label="Delivered" value={analytics.sent} icon={<MailCheck className="h-4 w-4" />} color="text-green-500" />
        <StatCard label="Failed" value={analytics.failed} icon={<MailX className="h-4 w-4" />} color="text-red-500" />
        <StatCard label="Delivery rate" value={`${analytics.delivery_rate}%`} icon={<MailCheck className="h-4 w-4" />} color="text-emerald-500" />
        <StatCard label="Today" value={today} sub={`${thisWeek} this week`} icon={<Mail className="h-4 w-4" />} color="text-blue-500" />
      </div>

      {/* Test email composer */}
      {testOpen && (
        <Card className="mt-6 p-5">
          <p className="text-sm font-bold">Send a test transactional email</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Verifies Brevo delivery to any address. Shows up in the delivery logs below.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="email"
              value={tEmail}
              onChange={(e) => setTEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="input min-w-64 flex-1"
            />
            <button onClick={handleTestEmail} disabled={tSending} className="btn-primary disabled:opacity-60">
              {tSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Send test
            </button>
            <button onClick={() => setTestOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </Card>
      )}

      {/* Broadcast composer */}
      {broadcastOpen && (
        <Card className="mt-6 p-5">
          <p className="text-sm font-bold">Send broadcast to all users</p>
          <div className="mt-4 space-y-3">
            <input
              value={bTitle}
              onChange={(e) => setBTitle(e.target.value)}
              placeholder="Subject / title"
              className="input"
              maxLength={200}
            />
            <textarea
              value={bBody}
              onChange={(e) => setBBody(e.target.value)}
              placeholder="Message body"
              className="input min-h-24"
              rows={4}
            />
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={bEmail} onChange={(e) => setBEmail(e.target.checked)} />
              Also send as email
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setBroadcastOpen(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleBroadcast} disabled={bSending} className="btn-primary disabled:opacity-60">
                {bSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Queue monitor */}
      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold">Email queue</p>
          <div className="flex flex-wrap items-center gap-2">
            {QUEUE_STATUSES.map(({ status, dot }) => (
              <span key={status} className="flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 text-xs dark:border-dark-300">
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                <span className="capitalize">{status}</span>
                <span className="font-bold">{queueCounts[status] ?? 0}</span>
              </span>
            ))}
            <button onClick={handleRetry} className="btn-secondary text-xs">
              <RotateCcw className="h-3.5 w-3.5" /> Retry failed
            </button>
          </div>
        </div>

        {queueLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="overflow-hidden">
            <TableShell>
              <TableHead cells={['To', 'Subject', 'Status', 'Attempts', 'Error', 'Created']} />
              <tbody>
                {queue.length === 0 ? (
                  <EmptyRow colSpan={6} message="The email queue is empty." />
                ) : (
                  queue.slice(0, 20).map((q) => (
                    <tr key={q.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                      <td className="px-4 py-3 font-medium">{q.to_email}</td>
                      <td className="max-w-52 truncate px-4 py-3 text-gray-600 dark:text-gray-300">{q.subject}</td>
                      <td className="px-4 py-3">
                        <Badge tone={emailTone(q.status)}>{q.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{q.attempts}/{q.max_attempts}</td>
                      <td className="max-w-40 truncate px-4 py-3 text-gray-500">
                        {q.error
                          ? `${q.error}${q.http_status ? ` (HTTP ${q.http_status})` : ''}`
                          : q.status === 'sent'
                            ? 'Accepted by Brevo'
                            : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDateTime(q.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableShell>
          </Card>
        )}
      </div>

      {/* Sent logs */}
      <div className="mt-8">
        <p className="mb-3 text-sm font-bold">Delivery logs</p>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Card className="overflow-hidden">
            <TableShell>
              <TableHead cells={['Recipient', 'Type', 'Status', 'Sent at']} />
              <tbody>
                {logs.length === 0 ? (
                  <EmptyRow colSpan={4} message="No emails sent yet. Publish a startup or send a broadcast to see logs land here." />
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                      <td className="px-4 py-3 font-medium">{log.recipient_email}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {TYPE_LABELS[log.email_type] ?? TYPE_LABELS[log.template ?? ''] ?? log.email_type ?? log.template}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={emailTone(log.status)}>{log.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDateTime(log.sent_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableShell>
          </Card>
        )}
      </div>
    </div>
  )
}
