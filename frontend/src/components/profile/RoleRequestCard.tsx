import { useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import toast from 'react-hot-toast'
import { ArrowRight, BadgeCheck, Clock, Loader2, Send, ShieldCheck, X } from 'lucide-react'
import { ROLES, ROLE_LABELS } from '../../types'
import type { Role } from '../../types'
import { useSession } from '../../context/AuthContext'
import {
  createRoleRequest,
  getMyRoleRequests,
  cancelRoleRequest,
} from '../../lib/roleRequests'
import type { RoleRequest } from '../../lib/roleRequests'

const STATUS_STYLES: Record<RoleRequest['status'], { label: string; cls: string }> = {
  pending: { label: 'Pending review', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-600 dark:bg-dark-200 dark:text-gray-400' },
}

export default function RoleRequestCard({ currentRole }: { currentRole: Role | null }) {
  const { refreshProfile } = useSession()
  const [requests, setRequests] = useState<RoleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [targetRole, setTargetRole] = useState<Role>('founder')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    try {
      const rows = await getMyRoleRequests()
      setRequests(rows)
      const justApproved = rows[0]?.status === 'approved'
      if (justApproved) {
        // Role became effective server-side — refresh the live profile so the
        // dashboard, nav and permissions update without a manual reload.
        await refreshProfile()
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'generic'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // While a request is pending, poll so an admin decision appears live
  // (the profile realtime subscription covers the role change itself).
  useEffect(() => {
    const hasPending = requests.some((r) => r.status === 'pending')
    if (!hasPending) return
    const timer = window.setInterval(() => void load(), 8000)
    return () => window.clearInterval(timer)
  }, [requests])

  const pending = requests.find((r) => r.status === 'pending')
  const latest = requests[0]

  const submit = async () => {
    if (!targetRole || targetRole === currentRole) return
    setSubmitting(true)
    try {
      await createRoleRequest(targetRole, reason.trim())
      toast.success('Role change request submitted for review')
      setOpen(false)
      setReason('')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error, 'generic'))
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await cancelRoleRequest(id)
      toast.success('Request cancelled')
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error, 'generic'))
    }
  }

  const eligibleRoles = ROLES.filter((r) => r !== 'administrator' && r !== currentRole)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">Your role</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Roles shape your dashboard, matching and permissions. Role changes are reviewed by our team.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-dark-300 dark:bg-dark">
        <div>
          <p className="text-sm font-semibold">
            {currentRole ? ROLE_LABELS[currentRole] : 'Not set'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Current role</p>
        </div>
        {!pending && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost text-sm">
            {open ? 'Cancel' : 'Request change'}
          </button>
        )}
      </div>

      {pending && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                Requesting: {ROLE_LABELS[pending.requested_role as Role] ?? pending.requested_role}
              </span>
            </div>
            <button
              type="button"
              onClick={() => cancel(pending.id)}
              className="text-xs font-semibold text-amber-700 underline hover:text-amber-900 dark:text-amber-400"
            >
              Cancel
            </button>
          </div>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES.pending.cls}`}>
            {STATUS_STYLES.pending.label}
          </span>
        </div>
      )}

      {latest && latest.status !== 'pending' && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-dark-300 dark:bg-dark">
          <div className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Last request — {ROLE_LABELS[latest.requested_role as Role] ?? latest.requested_role}:
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[latest.status].cls}`}>
              {STATUS_STYLES[latest.status].label}
            </span>
          </div>
          {latest.admin_note && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Note: {latest.admin_note}</p>
          )}
        </div>
      )}

      {open && !pending && (
        <div className="mt-4 flex flex-col gap-4 border-t border-gray-200 pt-4 dark:border-dark-300">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Request to switch to
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {eligibleRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setTargetRole(role)}
                  className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    targetRole === role
                      ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/30'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark dark:text-gray-300'
                  }`}
                >
                  {ROLE_LABELS[role]}
                  {targetRole === role && <ArrowRight className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Why are you switching?</span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              placeholder="Tell us a bit about your new focus (optional)"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !targetRole || targetRole === currentRole}
            className="btn-primary w-full disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit request
          </button>
          <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <X className="h-3.5 w-3.5" />
            Changes apply only after an admin approves your request.
          </p>
        </div>
      )}

      {loading && <div className="mt-3 h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-dark-200" />}
    </div>
  )
}
