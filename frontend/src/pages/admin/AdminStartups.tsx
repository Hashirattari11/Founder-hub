import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, RefreshCw, Search, Star, Trash2, Eye, EyeOff, CheckCircle2, Rocket } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { adminDeleteStartup, adminListStartups, adminUpdateStartup } from '../../api/admin'
import { isSuperAdminProfile } from '../../lib/admin'
import type { AdminStartup } from '../../types/admin'
import {
  Badge,
  EmptyRow,
  formatDate,
  LoadingBlock,
  PageHeader,
  TableHead,
  TableShell,
} from './adminUi'

export default function AdminStartups() {
  const { realProfile } = useSession()
  const superAdmin = isSuperAdminProfile(realProfile)
  const [startups, setStartups] = useState<AdminStartup[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListStartups({ search: search || undefined, status: status || undefined })
      setStartups(res.startups)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load startups')
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (startup: AdminStartup, key: 'is_featured' | 'is_verified' | 'is_hidden' | 'is_published') => {
    setBusyId(startup.id)
    try {
      const next = !startup[key]
      await adminUpdateStartup(startup.id, { [key]: next })
      setStartups((prev) => prev.map((s) => (s.id === startup.id ? { ...s, [key]: next } : s)))
      toast.success(`${startup.name} updated`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const remove = (startup: AdminStartup) => {
    if (!window.confirm(`Delete "${startup.name}" and all its data? This cannot be undone.`)) return
    setBusyId(startup.id)
    adminDeleteStartup(startup.id)
      .then(() => {
        setStartups((prev) => prev.filter((s) => s.id !== startup.id))
        toast.success('Startup deleted')
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Delete failed'))
      .finally(() => setBusyId(null))
  }

  return (
    <div>
      <PageHeader
        title="Startups"
        description="Moderate every startup listing on the platform."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearch(query)
            }}
            placeholder="Search by name, tagline or industry (Enter)..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark-100 dark:text-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-dark-300 dark:bg-dark-100 dark:text-white"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="featured">Featured</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock label="Loading startups..." />
      ) : (
        <TableShell>
          <TableHead cells={['Startup', 'Owner', 'Status', 'Flags', 'Created', 'Actions']} />
          <tbody>
            {startups.length === 0 ? (
              <EmptyRow colSpan={6} message="No startups found" />
            ) : (
              startups.map((s) => {
                const busy = busyId === s.id
                return (
                  <tr key={s.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.tagline || '—'} {s.industry ? `· ${s.industry}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-300">{s.founder_name || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={s.is_published ? 'green' : 'gray'}>{s.is_published ? 'Published' : 'Draft'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.is_featured && <Badge tone="purple">Featured</Badge>}
                        {s.is_verified && <Badge tone="green">Verified</Badge>}
                        {s.is_hidden && <Badge tone="red">Hidden</Badge>}
                        {!s.is_featured && !s.is_verified && !s.is_hidden && <Badge tone="gray">None</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(s.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggle(s, 'is_featured')}
                          disabled={busy}
                          title={s.is_featured ? 'Remove featured' : 'Feature'}
                          className={`rounded-lg p-1.5 hover:bg-purple-50 disabled:opacity-40 dark:hover:bg-purple-500/10 ${s.is_featured ? 'text-purple-500' : 'text-gray-400'}`}
                        >
                          <Star className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggle(s, 'is_verified')}
                          disabled={busy}
                          title={s.is_verified ? 'Unverify' : 'Verify'}
                          className={`rounded-lg p-1.5 hover:bg-green-50 disabled:opacity-40 dark:hover:bg-green-500/10 ${s.is_verified ? 'text-green-500' : 'text-gray-400'}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggle(s, 'is_hidden')}
                          disabled={busy}
                          title={s.is_hidden ? 'Unhide' : 'Hide'}
                          className={`rounded-lg p-1.5 hover:bg-red-50 disabled:opacity-40 dark:hover:bg-red-500/10 ${s.is_hidden ? 'text-red-500' : 'text-gray-400'}`}
                        >
                          {s.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => toggle(s, 'is_published')}
                          disabled={busy}
                          title={s.is_published ? 'Unpublish' : 'Publish'}
                          className={`rounded-lg p-1.5 hover:bg-primary/10 disabled:opacity-40 ${s.is_published ? 'text-primary' : 'text-gray-400'}`}
                        >
                          <Rocket className="h-4 w-4" />
                        </button>
                        {superAdmin && (
                          <button
                            onClick={() => remove(s)}
                            disabled={busy}
                            title="Delete (super admin)"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}
