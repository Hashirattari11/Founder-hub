import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Coins, Loader2, Scale, ShieldAlert, Users } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { getAdminCapTables } from '../../lib/equity'
import { formatDate } from '../../lib/helpers'
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
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Cap Table Admin" backTo="/dashboard" />
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-24 sm:px-6 lg:pb-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Scale className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">Cap Table Overview</h1>
            <p className="text-sm text-gray-500">Every equity cap table on FounderHub.</p>
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
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Cap tables</p>
                <p className="mt-1 text-2xl font-extrabold text-primary">{total}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <Users className="h-3.5 w-3.5" /> Equity holders
                </div>
                <p className="mt-1 text-2xl font-extrabold text-primary">{holders}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <BarChart3 className="h-3.5 w-3.5" /> Allocated shares
                </div>
                <p className="mt-1 text-2xl font-extrabold text-primary">{allocatedShares.toLocaleString()}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  <Coins className="h-3.5 w-3.5" /> With valuation
                </div>
                <p className="mt-1 text-2xl font-extrabold text-primary">{valued}</p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-dark-300">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Startup</th>
                      <th className="px-4 py-3 font-semibold">Holders</th>
                      <th className="px-4 py-3 text-right font-semibold">Total shares</th>
                      <th className="px-4 py-3 text-right font-semibold">Allocated</th>
                      <th className="px-4 py-3 text-right font-semibold">Allocated %</th>
                      <th className="px-4 py-3 text-right font-semibold">Valuation</th>
                      <th className="px-4 py-3 font-semibold">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                          No cap tables on the platform yet.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={item.cap_table.id}
                          className="border-b border-gray-100 last:border-0 dark:border-dark-300"
                        >
                          <td className="px-4 py-3">
                            {item.startup ? (
                              <Link
                                to={`/startups/${item.startup.id}/equity`}
                                className="font-semibold hover:text-primary"
                              >
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
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                              {item.allocated_pct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(item.valuation)}</td>
                          <td className="px-4 py-3 text-gray-500">{item.last_updated ? formatDate(item.last_updated) : '—'}</td>
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
