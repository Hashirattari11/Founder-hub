import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Rocket, Eye, EyeOff, Pencil, BarChart3, Trash2, Loader2, Handshake } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { useConfirm } from '../../components/ConfirmDialog'
import { getMyStartups, updateStartup, deleteStartup } from '../../lib/startups'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonRow } from '../../components/dashboard/Skeleton'
import { capitalize, timeAgo } from '../../lib/helpers'
import type { Startup } from '../../types'

export default function MyStartups() {
  const { user } = useSession()
  const { confirm, dialog } = useConfirm()
  const [startups, setStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const data = await getMyStartups(user.id)
      setStartups(data)
    } catch {
      toast.error('Could not load your startups')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const togglePublish = async (startup: Startup) => {
    setBusyId(startup.id)
    try {
      await updateStartup(startup.id, { is_published: !startup.is_published })
      setStartups((prev) =>
        prev.map((s) => (s.id === startup.id ? { ...s, is_published: !startup.is_published } : s)),
      )
      toast.success(startup.is_published ? 'Moved to drafts' : 'Startup published')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (startup: Startup) => {
    const ok = await confirm({
      title: `Delete "${startup.name}"?`,
      message: 'This will permanently delete the startup and all its data. This cannot be undone.',
      confirmLabel: 'Delete Startup',
    })
    if (!ok) return
    setBusyId(startup.id)
    try {
      await deleteStartup(startup.id)
      setStartups((prev) => prev.filter((s) => s.id !== startup.id))
      toast.success('Startup deleted')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">My Startups</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your posts, drafts, and publishing.</p>
        </div>
        <Link
          to="/startups/create"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark"
        >
          <Rocket className="h-4 w-4" />
          New Startup
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : startups.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No startups yet"
          description="Create your first startup to start attracting teammates and investors."
          action={{ label: 'Create a Startup', to: '/startups/create' }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {startups.map((startup) => (
            <div
              key={startup.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary/30 dark:border-dark-300 dark:bg-dark-100"
            >
              <div className="flex items-start gap-4">
                <Avatar src={startup.profiles?.avatar_url} name={startup.name} size="md" className="flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/startups/${startup.id}`} className="truncate font-bold hover:text-primary">
                      {startup.name}
                    </Link>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        startup.is_published
                          ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {startup.is_published ? 'Published' : 'Draft'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {capitalize(startup.industry)} · {capitalize(startup.stage)} · updated {timeAgo(startup.updated_at ?? startup.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">{startup.tagline}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-4 dark:border-dark-300">
                {startup.is_published && (
                  <>
                    <Link
                      to={`/startups/${startup.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                    >
                      <Eye className="h-3.5 w-3.5" /> View
                    </Link>
                    <Link
                      to={`/startups/${startup.id}/analytics`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                    >
                      <BarChart3 className="h-3.5 w-3.5" /> Analytics
                    </Link>
                    <Link
                      to={`/startups/${startup.id}/investors`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                    >
                      <Handshake className="h-3.5 w-3.5" /> Find Investors
                    </Link>
                  </>
                )}
                <Link
                  to={`/startups/${startup.id}/edit`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
                <button
                  onClick={() => togglePublish(startup)}
                  disabled={busyId === startup.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  {busyId === startup.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : startup.is_published ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {startup.is_published ? 'Unpublish' : 'Publish'}
                </button>
                <button
                  onClick={() => remove(startup)}
                  disabled={busyId === startup.id}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {dialog}
    </div>
  )
}
