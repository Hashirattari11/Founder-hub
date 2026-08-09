import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMyStartups } from '../../lib/startups'
import { useSession } from '../../context/AuthContext'
import type { Startup } from '../../types'

export function StartupPicker({
  startupId,
  onChange,
  onRefresh,
  refreshing,
}: {
  startupId: string | null
  onChange: (id: string) => void
  onRefresh: () => void
  refreshing: boolean
}) {
  const { user } = useSession()
  const [startups, setStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!user) return
    ;(async () => {
      try {
        const data = await getMyStartups(user.id)
        if (!active) return
        setStartups(data)
        if (!startupId && data.length > 0) onChange(data[0].id)
      } catch {
        if (!active) return
        toast.error('Could not load your startups')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const base =
    'w-full rounded-xl border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark dark:text-white'

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Select startup
        </label>
        {loading ? (
          <div className="h-11 animate-pulse rounded-xl bg-gray-200 dark:bg-dark-300" />
        ) : startups.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500 dark:bg-dark dark:text-gray-400">
            You have no startups yet. Create one first to run AI analyses.
          </p>
        ) : (
          <select value={startupId ?? ''} onChange={(e) => onChange(e.target.value)} className={base}>
            {startups.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <button
        onClick={onRefresh}
        disabled={!startupId || refreshing}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Analyzing...' : 'Analyze Again'}
      </button>
    </div>
  )
}
