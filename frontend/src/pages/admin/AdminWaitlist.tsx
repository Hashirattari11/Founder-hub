import { useEffect, useMemo, useState } from 'react'
import { Mail, RefreshCw, Search, Users } from 'lucide-react'
import { Badge, Card, PageHeader } from './adminUi'
import { adminListWaitlist } from '../../api/admin'
import type { WaitlistEntry } from '../../api/admin'

export default function AdminWaitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [countryFilter, setCountryFilter] = useState('All')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminListWaitlist({ limit: 500 })
      setEntries(res.waitlist)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the waitlist')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const countries = useMemo(() => {
    const set = new Set(entries.map((e) => e.country).filter(Boolean))
    return ['All', ...[...set].sort()]
  }, [entries])

  const filtered = useMemo(
    () =>
      entries.filter((e) => {
        if (countryFilter !== 'All' && e.country !== countryFilter) return false
        if (query) {
          const hay = `${e.email} ${e.country} ${e.city}`.toLowerCase()
          if (!hay.includes(query.toLowerCase())) return false
        }
        return true
      }),
    [entries, query, countryFilter],
  )

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div>
      <PageHeader
        title="Waitlist"
        description="Email signups from the landing page 'Join the Waitlist' form, including country and city."
        actions={
          <button onClick={() => void load()} className="btn-ghost inline-flex items-center gap-1.5 text-sm">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Summary */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none">{entries.length}</p>
              <p className="mt-1 text-xs text-gray-400">Total signups</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
              <Mail className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none">{countries.length - 1}</p>
              <p className="mt-1 text-xs text-gray-400">Countries represented</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none">{filtered.length}</p>
              <p className="mt-1 text-xs text-gray-400">Showing</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search email, country, city..."
            className="input pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {countries.map((c) => (
            <button
              key={c}
              onClick={() => setCountryFilter(c)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                countryFilter === c
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-300 dark:text-gray-300 dark:hover:bg-dark-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <Card className="overflow-hidden">
        {loading ? (
          <p className="px-4 py-12 text-center text-sm text-gray-400">Loading waitlist...</p>
        ) : error ? (
          <p className="px-4 py-12 text-center text-sm text-red-500">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-gray-400">
            No waitlist signups yet. Share the landing page to grow the list.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400 dark:border-dark-300">
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Country</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">City</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Source</th>
                <th className="px-4 py-3 font-semibold">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-200 dark:hover:bg-dark-200"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-white">{e.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {e.country ? (
                      <Badge tone="blue">{e.country}</Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-300 md:table-cell">
                    {e.city || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-500 dark:text-gray-400 lg:table-cell">{e.source}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{formatDate(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="mt-4 text-xs text-gray-400">
        Showing {filtered.length} of {entries.length} signups. Duplicate emails are automatically rejected.
      </p>
    </div>
  )
}
