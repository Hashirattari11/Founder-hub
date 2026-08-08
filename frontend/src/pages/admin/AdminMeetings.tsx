import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, RefreshCw, Search, Trash2, Video, Ban, CalendarDays, FileText, Sparkles } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { adminListMeetings, adminUpdateMeeting, adminDeleteMeeting } from '../../api/admin'
import { isSuperAdminProfile } from '../../lib/admin'
import type { AdminMeeting } from '../../types/admin'
import {
  Badge,
  EmptyRow,
  formatDate,
  LoadingBlock,
  PageHeader,
  TableHead,
  TableShell,
} from './adminUi'

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const STATUS_TONES: Record<string, 'green' | 'gray' | 'red' | 'purple'> = {
  completed: 'green',
  scheduled: 'purple',
  cancelled: 'red',
  in_progress: 'gray',
}

export default function AdminMeetings() {
  const { profile } = useSession()
  const superAdmin = isSuperAdminProfile(profile)
  const [meetings, setMeetings] = useState<AdminMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListMeetings({ search: search || undefined, status: status || undefined })
      setMeetings(res.meetings)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => {
    load()
  }, [load])

  const cancel = async (m: AdminMeeting) => {
    if (!window.confirm(`Cancel "${m.title}"? The participants will still see it but it will be marked cancelled.`)) return
    setBusyId(m.id)
    try {
      await adminUpdateMeeting(m.id, { status: 'cancelled' })
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: 'cancelled' } : x)))
      toast.success('Meeting cancelled')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setBusyId(null)
    }
  }

  const remove = (m: AdminMeeting) => {
    if (!window.confirm(`Delete "${m.title}" and all its notes/action items? This cannot be undone.`)) return
    setBusyId(m.id)
    adminDeleteMeeting(m.id)
      .then(() => {
        setMeetings((prev) => prev.filter((x) => x.id !== m.id))
        toast.success('Meeting deleted')
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Delete failed'))
      .finally(() => setBusyId(null))
  }

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Moderate every meeting across the platform."
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
            placeholder="Search by meeting title (Enter)..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark-100 dark:text-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-dark-300 dark:bg-dark-100 dark:text-white"
        >
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock label="Loading meetings..." />
      ) : (
        <TableShell>
          <TableHead cells={['Meeting', 'Organizer', 'Participant', 'Status', 'AI', 'When', 'Actions']} />
          <tbody>
            {meetings.length === 0 ? (
              <EmptyRow colSpan={7} message="No meetings found" />
            ) : (
              meetings.map((m) => {
                const busy = busyId === m.id
                return (
                  <tr key={m.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{m.title}</p>
                      <p className="text-xs text-gray-400">
                        {m.duration_minutes} min · {formatWhen(m.scheduled_at)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-300">{m.organizer_name || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-300">{m.participant_name || '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONES[m.status] ?? 'gray'}>{m.status || 'unknown'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {m.has_summary && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                            <Sparkles className="h-3 w-3" /> Summary
                          </span>
                        )}
                        {m.has_transcript && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            <FileText className="h-3 w-3" /> Transcript
                          </span>
                        )}
                        {!m.has_summary && !m.has_transcript && <Badge tone="gray">None</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {m.meet_link && (
                          <a
                            href={m.meet_link}
                            target="_blank"
                            rel="noreferrer"
                            title="Open room"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-primary/10 hover:text-primary"
                          >
                            <Video className="h-4 w-4" />
                          </a>
                        )}
                        {m.status !== 'cancelled' && (
                          <button
                            onClick={() => cancel(m)}
                            disabled={busy}
                            title="Cancel meeting"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        {m.status === 'cancelled' && (
                          <button
                            onClick={() => {
                              setBusyId(m.id)
                              adminUpdateMeeting(m.id, { status: 'scheduled' })
                                .then(() => {
                                  setMeetings((prev) => prev.map((x) => (x.id === m.id ? { ...x, status: 'scheduled' } : x)))
                                  toast.success('Meeting rescheduled')
                                })
                                .catch((err) => toast.error(err instanceof Error ? err.message : 'Update failed'))
                                .finally(() => setBusyId(null))
                            }}
                            disabled={busy}
                            title="Restore to scheduled"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-40 dark:hover:bg-green-500/10"
                          >
                            <CalendarDays className="h-4 w-4" />
                          </button>
                        )}
                        {superAdmin && (
                          <button
                            onClick={() => remove(m)}
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
