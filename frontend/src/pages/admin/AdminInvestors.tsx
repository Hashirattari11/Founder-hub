import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import toast from 'react-hot-toast'
import { RefreshCw, Search, Wallet } from 'lucide-react'
import { adminListInvestors } from '../../api/admin'
import type { AdminInvestor } from '../../types/admin'
import {
  Badge,
  Card,
  EmptyRow,
  formatDate,
  LoadingBlock,
  PageHeader,
  TableHead,
  TableShell,
} from './adminUi'

function formatRange(min: number | null, max: number | null) {
  const fmt = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`)
  if (min == null && max == null) return '—'
  if (min == null) return `up to ${fmt(max!)}`
  if (max == null) return `${fmt(min)}+`
  return `${fmt(min)} – ${fmt(max)}`
}

export default function AdminInvestors() {
  const [investors, setInvestors] = useState<AdminInvestor[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListInvestors({ search: search || undefined })
      setInvestors(res.investors)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <PageHeader
        title="Investors"
        description="Every investor profile on the platform."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearch(query)
          }}
          placeholder="Search investors (Enter)..."
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark-100 dark:text-white"
        />
      </div>

      {loading ? (
        <LoadingBlock label="Loading investors..." />
      ) : (
        <TableShell>
          <TableHead cells={['Investor', 'Company', 'Check size', 'Stages', 'Status', 'Joined']} />
          <tbody>
            {investors.length === 0 ? (
              <EmptyRow colSpan={6} message="No investors found" />
            ) : (
              investors.map((inv) => (
                <tr key={inv.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {inv.full_name || inv.username || 'Unnamed'}
                    </p>
                    <p className="text-xs text-gray-400">{inv.email ?? ''}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{inv.company || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                      <Wallet className="h-3.5 w-3.5 text-primary" />
                      {formatRange(inv.investment_range_min, inv.investment_range_max)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(inv.investment_stage ?? []).length === 0 ? (
                        <Badge tone="gray">Any</Badge>
                      ) : (
                        (inv.investment_stage ?? []).map((stage) => (
                          <Badge key={stage} tone="blue">
                            {stage}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {inv.is_verified && <Badge tone="green">Verified</Badge>}
                      {inv.is_premium && <Badge tone="purple">Premium</Badge>}
                      {!inv.is_verified && <Badge tone="gray">Unverified</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(inv.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}

      <Card className="mt-4 p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {loading ? '' : `${investors.length} investor profile(s) shown. Investor verification is toggled from the Users page.`}
        </p>
      </Card>
    </div>
  )
}
