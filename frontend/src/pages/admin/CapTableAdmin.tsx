import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Coins, Loader2, Users } from 'lucide-react'
import { getAdminCapTables } from '../../lib/equity'
import { AdminAccessDenied, Badge, EmptyRow, PageHeader, StatCard, TableHead, TableShell } from './adminUi'
import { formatDateTime } from './adminUi'
import type { AdminCapTableItem } from '../../types'

function formatCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

export default function CapTableAdmin() {
  const [items, setItems] = useState<AdminCapTableItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAdminCapTables()
      .then((res) => {
        setItems(res.cap_tables ?? [])
        setTotal(res.total ?? 0)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load cap tables'))
      .finally(() => setLoading(false))
  }, [])

  const holders = items.reduce((acc, i) => acc + i.holders, 0)
  const allocatedShares = items.reduce((acc, i) => acc + i.allocated_shares, 0)
  const valued = items.filter((i) => i.valuation != null).length

  return (
    <div>
      <PageHeader
        title="Cap Table Overview"
        description="Every equity cap table on FounderHub."
      />

      {error ? (
        <AdminAccessDenied />
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Cap tables" value={total} />
            <StatCard label="Equity holders" value={holders} icon={<Users className="h-3.5 w-3.5" />} />
            <StatCard label="Allocated shares" value={allocatedShares.toLocaleString()} icon={<BarChart3 className="h-3.5 w-3.5" />} />
            <StatCard label="With valuation" value={valued} icon={<Coins className="h-3.5 w-3.5" />} />
          </div>

          <div className="mt-6">
            <TableShell>
              <TableHead cells={['Startup', 'Holders', 'Total shares', 'Allocated', 'Allocated %', 'Valuation', 'Updated']} />
              <tbody>
                {items.length === 0 ? (
                  <EmptyRow colSpan={7} message="No cap tables on the platform yet." />
                ) : (
                  items.map((item) => (
                    <tr key={item.cap_table.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                      <td className="px-4 py-3">
                        {item.startup ? (
                          <Link to={`/startups/${item.startup.id}/equity`} className="font-semibold hover:text-primary">
                            {item.startup.name}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{item.holders}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.total_shares.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.allocated_shares.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <Badge tone="primary">{item.allocated_pct}%</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.valuation)}</td>
                      <td className="px-4 py-3 text-gray-500">{item.last_updated ? formatDateTime(item.last_updated) : '—'}</td>
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
