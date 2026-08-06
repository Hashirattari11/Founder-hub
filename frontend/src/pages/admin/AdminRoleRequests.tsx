import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, RefreshCw, X } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { adminApproveRoleRequest, adminListRoleRequests, adminRejectRoleRequest } from '../../api/admin'
import { isSuperAdminProfile } from '../../lib/admin'
import type { RoleRequest } from '../../types/admin'
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

export default function AdminRoleRequests() {
  const { profile } = useSession()
  const superAdmin = isSuperAdminProfile(profile)
  const [requests, setRequests] = useState<RoleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListRoleRequests(status || undefined)
      setRequests(res.requests)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load role requests')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const review = async (req: RoleRequest, action: 'approve' | 'reject') => {
    if (action === 'approve') {
      if (!window.confirm(`Approve this request and change ${req.user_name ?? 'this user'}'s primary role to "${req.requested_role}"?`)) return
    }
    setBusyId(req.id)
    try {
      if (action === 'approve') {
        await adminApproveRoleRequest(req.id)
        toast.success('Request approved')
      } else {
        await adminRejectRoleRequest(req.id)
        toast.success('Request rejected')
      }
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Review failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Role Requests"
        description="Users requesting to change their single primary role."
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
        {['', 'pending', 'approved', 'rejected', 'cancelled'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              status === s
                ? 'bg-gradient-brand text-white shadow-md shadow-primary/20'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
            }`}
          >
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {!superAdmin && (
        <Card className="mb-4 p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Only the Super Admin can approve or reject role requests.
          </p>
        </Card>
      )}

      {loading ? (
        <LoadingBlock label="Loading role requests..." />
      ) : (
        <TableShell>
          <TableHead cells={['User', 'From', 'Requested', 'Reason', 'Status', 'Reviewed', 'Actions']} />
          <tbody>
            {requests.length === 0 ? (
              <EmptyRow colSpan={7} message="No role requests" />
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    {req.user_name ?? req.user_id}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="gray">{(req.from_role ?? 'unknown').replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="primary">{req.requested_role.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="max-w-[260px] px-4 py-3 text-xs text-gray-500 dark:text-gray-300">
                    {req.reason || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(req.status)}>{req.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(req.reviewed_at)}</td>
                  <td className="px-4 py-3">
                    {req.status === 'pending' && superAdmin ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => review(req, 'approve')}
                          disabled={busyId === req.id}
                          className="flex items-center gap-1 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => review(req, 'reject')}
                          disabled={busyId === req.id}
                          className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40 dark:border-red-500/30 dark:hover:bg-red-500/10"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">
                        {req.admin_note ? `Note: ${req.admin_note}` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}
