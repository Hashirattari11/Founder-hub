import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { CreditCard, RefreshCw } from 'lucide-react'
import { adminSubscriptions } from '../../api/admin'
import type { SubscriptionAdmin } from '../../types/admin'
import { Badge, Card, EmptyRow, formatDate, formatMoney, LoadingBlock, PageHeader, statusTone, TableHead, TableShell } from './adminUi'

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminSubscriptions(status || undefined)
      setSubscriptions(res.subscriptions)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const mrr = subscriptions.filter((s) => s.status === 'active').reduce((acc, s) => acc + s.amount_cents, 0)

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Premium subscriptions and recurring revenue."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <CreditCard className="h-3.5 w-3.5" /> Total subscriptions
          </div>
          <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">{subscriptions.length}</p>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Active</div>
          <p className="mt-2 text-2xl font-extrabold text-green-500">
            {subscriptions.filter((s) => s.status === 'active').length}
          </p>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">MRR (active)</div>
          <p className="mt-2 text-2xl font-extrabold text-primary">{formatMoney(mrr)}</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'active', 'trialing', 'past_due', 'canceled', 'expired'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              status === s
                ? 'bg-gradient-brand text-white shadow-md shadow-primary/20'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
            }`}
          >
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock label="Loading subscriptions..." />
      ) : (
        <TableShell>
          <TableHead cells={['User', 'Plan', 'Status', 'Amount', 'Provider', 'Started', 'Renews']} />
          <tbody>
            {subscriptions.length === 0 ? (
              <EmptyRow colSpan={7} message="No subscriptions" />
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 dark:text-white">{sub.user_id.slice(0, 8)}…</p>
                    <p className="text-xs text-gray-400">{sub.provider_sub_id ?? sub.provider ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="primary">{sub.plan}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(sub.status)}>{sub.status}</Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    {formatMoney(sub.amount_cents, sub.currency)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">{sub.provider ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(sub.started_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(sub.renews_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}
