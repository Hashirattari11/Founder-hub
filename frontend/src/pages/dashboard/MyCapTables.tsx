import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { Link } from 'react-router-dom'
import { BarChart3, Coins, Scale, TrendingUp, Users } from 'lucide-react'
import { getMyCapTables } from '../../lib/equity'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/dashboard/Skeleton'
import { timeAgo } from '../../lib/helpers'
import type { MyCapTableItem } from '../../types'

function formatCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

export default function MyCapTables() {
  const [items, setItems] = useState<MyCapTableItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await getMyCapTables()
      setItems(res.startups ?? [])
    } catch (err) {
      setError(getErrorMessage(err, 'generic'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Equity & Cap Table</h1>
          <p className="mt-1 text-sm text-gray-500">
            Share classes, holders, vesting, and investment rounds across your startups.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No cap tables yet"
          description="Cap tables appear here once you create a startup. Open a startup to set up your equity structure."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <Link
              key={item.startup.id}
              to={`/startups/${item.startup.id}/equity`}
              className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/40 dark:border-dark-300 dark:bg-dark-100"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-bold hover:text-primary">{item.startup.name}</h2>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                      {item.allocated_pct}% allocated
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-sm text-gray-500">{item.startup.tagline}</p>
                </div>
                {item.cap_table?.last_updated && (
                  <span className="text-xs text-gray-400">updated {timeAgo(item.cap_table.last_updated)}</span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-200 pt-4 sm:grid-cols-4 dark:border-dark-300">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-gray-500">Holders</span>
                  <span className="font-bold">{item.holders}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-gray-500">Total shares</span>
                  <span className="font-bold">{item.total_shares.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Coins className="h-4 w-4 text-accent" />
                  <span className="text-gray-500">Valuation</span>
                  <span className="font-bold">{formatCurrency(item.valuation)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-gray-500">ESOP pool</span>
                  <span className="font-bold">{(item.esop_pool_shares ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
