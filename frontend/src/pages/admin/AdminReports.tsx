import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, RefreshCw, X } from 'lucide-react'
import { adminDismissReport, adminListReports, adminResolveReport } from '../../api/admin'
import type { ReportItem } from '../../types/admin'
import {
  Badge,
  Card,
  EmptyRow,
  formatDateTime,
  LoadingBlock,
  PageHeader,
  TableHead,
  TableShell,
  statusTone,
} from './adminUi'

export default function AdminReports() {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListReports(status || undefined)
      setReports(res.reports)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const review = async (report: ReportItem, action: 'resolve' | 'dismiss') => {
    setBusyId(report.id)
    try {
      if (action === 'resolve') await adminResolveReport(report.id, noteFor === report.id ? note : undefined)
      else await adminDismissReport(report.id, noteFor === report.id ? note : undefined)
      toast.success(action === 'resolve' ? 'Report resolved' : 'Report dismissed')
      setNoteFor(null)
      setNote('')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="User-submitted moderation reports for the platform."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['', 'open', 'under_review', 'resolved', 'dismissed'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              status === s
                ? 'bg-gradient-brand text-white shadow-md shadow-primary/20'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
            }`}
          >
            {s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock label="Loading reports..." />
      ) : (
        <TableShell>
          <TableHead cells={['Reporter', 'Type', 'Target', 'Description', 'Status', 'Actions']} />
          <tbody>
            {reports.length === 0 ? (
              <EmptyRow colSpan={6} message="No reports" />
            ) : (
              reports.map((r) => {
                const noteOpen = noteFor === r.id
                return (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                      {r.reporter_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="amber">{r.report_type.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-300">
                      {r.target_type}
                      {r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ''}
                    </td>
                    <td className="max-w-[260px] px-4 py-3 text-xs text-gray-500 dark:text-gray-300">
                      {r.description || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(r.status)}>{r.status.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'open' || r.status === 'under_review' ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => review(r, 'resolve')}
                              disabled={busyId === r.id}
                              className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-40"
                            >
                              <Check className="h-3.5 w-3.5" /> Resolve
                            </button>
                            <button
                              onClick={() => review(r, 'dismiss')}
                              disabled={busyId === r.id}
                              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-red-300 hover:text-red-500 dark:border-dark-300 dark:text-gray-300"
                            >
                              <X className="h-3.5 w-3.5" /> Dismiss
                            </button>
                            <button
                              onClick={() => {
                                setNoteFor(noteOpen ? null : r.id)
                                setNote('')
                              }}
                              className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-500 dark:border-dark-300 dark:text-gray-400"
                            >
                              Note
                            </button>
                          </div>
                          {noteOpen && (
                            <div className="flex w-full max-w-xs items-center gap-1.5">
                              <input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Admin note..."
                                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                              />
                              <button
                                onClick={() => {
                                  if (note.trim()) review(r, 'resolve')
                                }}
                                className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white"
                              >
                                Save
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">{formatDateTime(r.resolved_at)}</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </TableShell>
      )}

      {reports.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="text-xs text-gray-400">{reports.length} report(s) shown.</p>
        </Card>
      )}
    </div>
  )
}
