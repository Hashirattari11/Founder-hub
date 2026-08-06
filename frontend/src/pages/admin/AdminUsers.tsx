import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Ban,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import {
  adminBanUser,
  adminChangeRole,
  adminDeleteUser,
  adminListUsers,
  adminResetPassword,
  adminSuspendUser,
  adminUnbanUser,
  adminUnsuspendUser,
  adminVerifyUser,
} from '../../api/admin'
import { isSuperAdminProfile } from '../../lib/admin'
import type { AdminUser } from '../../types/admin'
import { ROLES, ROLE_LABELS } from '../../types'
import {
  Badge,
  Card,
  EmptyRow,
  formatDate,
  LoadingBlock,
  PageHeader,
  TableHead,
  TableShell,
} from './adminUi'

const PAGE_SIZE = 50

interface ReasonModalState {
  kind: 'suspend' | 'ban' | null
  user: AdminUser | null
}

interface RoleModalState {
  user: AdminUser | null
  role: string
  open: boolean
}

interface PasswordModalState {
  user: AdminUser | null
  password: string
  open: boolean
}

export default function AdminUsers() {
  const { profile } = useSession()
  const superAdmin = isSuperAdminProfile(profile)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [verifiedFilter, setVerifiedFilter] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reason, setReason] = useState<ReasonModalState>({ kind: null, user: null })
  const [reasonText, setReasonText] = useState('')
  const [roleModal, setRoleModal] = useState<RoleModalState>({ user: null, role: 'founder', open: false })
  const [passwordModal, setPasswordModal] = useState<PasswordModalState>({ user: null, password: '', open: false })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListUsers({
        search: search || undefined,
        role: roleFilter || undefined,
        verified: verifiedFilter || undefined,
        limit: PAGE_SIZE,
      })
      setUsers(res.users)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter, verifiedFilter])

  useEffect(() => {
    load()
  }, [load])

  const run = async (action: () => Promise<unknown>, successMsg: string, id: string) => {
    setBusyId(id)
    try {
      await action()
      toast.success(successMsg)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = (user: AdminUser) => {
    if (!window.confirm(`Permanently delete ${user.full_name ?? user.email ?? user.id}? This cannot be undone.`)) return
    run(() => adminDeleteUser(user.id), 'User deleted', user.id)
  }

  const submitReason = async () => {
    if (!reason.kind || !reason.user) return
    await run(
      () =>
        reason.kind === 'suspend'
          ? adminSuspendUser(reason.user!.id, reasonText)
          : adminBanUser(reason.user!.id, reasonText),
      reason.kind === 'suspend' ? 'User suspended' : 'User banned',
      reason.user.id,
    )
    setReason({ kind: null, user: null })
    setReasonText('')
  }

  const submitRole = async () => {
    if (!roleModal.user) return
    await run(() => adminChangeRole(roleModal.user!.id, roleModal.role), 'Role updated', roleModal.user.id)
    setRoleModal({ user: null, role: 'founder', open: false })
  }

  const submitPassword = async () => {
    if (!passwordModal.user) return
    if (passwordModal.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    await run(
      () => adminResetPassword(passwordModal.user!.id, passwordModal.password),
      'Password reset',
      passwordModal.user.id,
    )
    setPasswordModal({ user: null, password: '', open: false })
  }

  const filtered = useMemo(() => {
    if (!search) return users
    const q = search.toLowerCase()
    return users.filter(
      (u) =>
        (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.username ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    )
  }, [users, search])

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage every FounderHub account: verification, moderation and roles."
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
            placeholder="Search by name, username or email (Enter)..."
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark-100 dark:text-white"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-dark-300 dark:bg-dark-100 dark:text-white"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          value={verifiedFilter}
          onChange={(e) => setVerifiedFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none dark:border-dark-300 dark:bg-dark-100 dark:text-white"
        >
          <option value="">All verification</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
      </div>

      {loading ? (
        <LoadingBlock label="Loading users..." />
      ) : (
        <TableShell>
          <TableHead
            cells={['User', 'Role', 'Status', 'Joined', 'Actions']}
          />
          <tbody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={5} message="No users found" />
            ) : (
              filtered.map((user) => {
                const busy = busyId === user.id
                return (
                  <tr key={user.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {user.full_name || user.username || 'Unnamed'}
                        {user.is_super_admin && (
                          <span className="ml-1.5 text-[10px] font-bold text-purple-500">SUPER</span>
                        )}
                        {user.is_admin && !user.is_super_admin && (
                          <span className="ml-1.5 text-[10px] font-bold text-primary">ADMIN</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {user.email ?? 'no email'}
                        {user.username ? ` · @${user.username}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="primary">{user.role.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.is_verified && <Badge tone="green">Verified</Badge>}
                        {user.is_premium && <Badge tone="purple">Premium</Badge>}
                        {user.is_banned && <Badge tone="red">Banned</Badge>}
                        {user.is_suspended && <Badge tone="amber">Suspended</Badge>}
                        {!user.is_verified && !user.is_banned && !user.is_suspended && <Badge tone="gray">Active</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          onClick={() => run(() => adminVerifyUser(user.id), 'User verified', user.id)}
                          disabled={busy || user.is_verified}
                          title="Verify"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-40 dark:hover:bg-green-500/10"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        </button>
                        {superAdmin && (
                          <button
                            onClick={() => setRoleModal({ user, role: user.role, open: true })}
                            title="Change primary role (super admin)"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-primary/10 hover:text-primary"
                          >
                            <UserCog className="h-4 w-4" />
                          </button>
                        )}
                        {superAdmin && (
                          <button
                            onClick={() => setPasswordModal({ user, password: '', open: true })}
                            title="Reset password (super admin)"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-primary/10 hover:text-primary"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                        )}
                        {user.is_suspended ? (
                          <button
                            onClick={() => run(() => adminUnsuspendUser(user.id), 'User unsuspended', user.id)}
                            disabled={busy}
                            title="Unsuspend"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setReason({ kind: 'suspend', user })
                              setReasonText('')
                            }}
                            disabled={busy || user.is_banned}
                            title="Suspend"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-40 dark:hover:bg-amber-500/10"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        )}
                        {user.is_banned ? (
                          <button
                            onClick={() => run(() => adminUnbanUser(user.id), 'User unbanned', user.id)}
                            disabled={busy}
                            title="Unban"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-500/10"
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setReason({ kind: 'ban', user })
                              setReasonText('')
                            }}
                            disabled={busy || user.is_suspended}
                            title="Ban"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                        {superAdmin && (
                          <button
                            onClick={() => confirmDelete(user)}
                            disabled={busy}
                            title="Delete (super admin)"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
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

      <p className="mt-3 text-xs text-gray-400">
        {loading || filtered.length === 0 ? '' : `Showing ${filtered.length} of ${users.length} results. Role changes, password resets and deletions require Super Admin.`}
      </p>

      {reason.kind && reason.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {reason.kind === 'suspend' ? `Suspend ${reason.user.full_name ?? reason.user.email ?? 'user'}` : `Ban ${reason.user.full_name ?? reason.user.email ?? 'user'}`}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {reason.kind === 'suspend'
                ? 'Suspended users cannot use the platform until lifted.'
                : 'Banned users are permanently removed from the platform.'}
            </p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={3}
              placeholder="Reason (visible in audit logs)"
              className="mt-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setReason({ kind: null, user: null })}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submitReason}
                className="rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-white"
              >
                Confirm
              </button>
            </div>
          </Card>
        </div>
      )}

      {roleModal.open && roleModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Change primary role</h3>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {roleModal.user.full_name ?? roleModal.user.email} — each account has exactly one primary role.
            </p>
            <select
              value={roleModal.role}
              onChange={(e) => setRoleModal((prev) => ({ ...prev, role: e.target.value }))}
              className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setRoleModal({ user: null, role: 'founder', open: false })}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submitRole}
                className="rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-white"
              >
                Save role
              </button>
            </div>
          </Card>
        </div>
      )}

      {passwordModal.open && passwordModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Reset password</h3>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Set a new password for {passwordModal.user.full_name ?? passwordModal.user.email ?? 'this user'}.
            </p>
            <input
              type="password"
              value={passwordModal.password}
              onChange={(e) => setPasswordModal((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="New password (min 8 chars)"
              className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPasswordModal({ user: null, password: '', open: false })}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={submitPassword}
                className="rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-white"
              >
                Reset password
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
