import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, RefreshCw, Trash2, Users2, XCircle } from 'lucide-react'
import {
  adminAddStartupMember,
  adminListStartups,
  adminListUsers,
  adminRemoveStartupMember,
  adminStartupMembers,
} from '../../api/admin'
import { useConfirm } from '../../components/ConfirmDialog'
import type { AdminStartup, AdminUser, StartupMemberAdmin } from '../../types/admin'
import { Badge, Card, EmptyRow, formatDate, LoadingBlock, PageHeader, TableHead, TableShell } from './adminUi'

const PERMISSIONS = ['owner', 'admin', 'editor', 'viewer'] as const
const PERMISSION_TONES = {
  owner: 'primary',
  admin: 'purple',
  editor: 'blue',
  viewer: 'gray',
} as const

export default function AdminStartupMembers() {
  const { confirm, dialog } = useConfirm()
  const [members, setMembers] = useState<StartupMemberAdmin[]>([])
  const [startups, setStartups] = useState<AdminStartup[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [startupId, setStartupId] = useState('')
  const [permission, setPermission] = useState<string>('viewer')
  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<AdminUser[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [membersRes, startupsRes] = await Promise.all([adminStartupMembers(filter || undefined), adminListStartups()])
      setMembers(membersRes.members)
      setStartups(startupsRes.startups)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load startup members')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const searchUsers = async (q: string) => {
    setUserQuery(q)
    if (!q.trim()) {
      setUserResults([])
      return
    }
    try {
      const res = await adminListUsers({ search: q, limit: 8 })
      setUserResults(res.users)
    } catch {
      setUserResults([])
    }
  }

  const addMember = async () => {
    if (!startupId || !selectedUser) {
      toast.error('Select a startup and a user')
      return
    }
    try {
      await adminAddStartupMember({ startup_id: startupId, user_id: selectedUser.id, permission })
      toast.success('Member added')
      setModalOpen(false)
      setSelectedUser(null)
      setUserQuery('')
      setStartupId('')
      setPermission('viewer')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Add failed')
    }
  }

  const remove = async (m: StartupMemberAdmin) => {
    const ok = await confirm({
      title: 'Remove member?',
      message: 'This will remove this member from the startup.',
      confirmLabel: 'Remove',
    })
    if (!ok) return
    try {
      await adminRemoveStartupMember(m.startup_id, m.user_id)
      setMembers((prev) => prev.filter((x) => x.startup_id !== m.startup_id || x.user_id !== m.user_id))
      toast.success('Member removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed')
    }
  }

  const startupName = (id: string) => startups.find((s) => s.id === id)?.name ?? id.slice(0, 8)

  return (
    <div>
      <PageHeader
        title="Startup Members"
        description="Per-startup Owner / Admin / Editor / Viewer permissions. This never changes a user's primary role."
        actions={
          <>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20"
            >
              <Plus className="h-4 w-4" /> Add member
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('')}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            filter === ''
              ? 'bg-gradient-brand text-white'
              : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
          }`}
        >
          All startups
        </button>
        {startups.slice(0, 6).map((s) => (
          <button
            key={s.id}
            onClick={() => setFilter(filter === s.id ? '' : s.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              filter === s.id
                ? 'bg-gradient-brand text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock label="Loading startup members..." />
      ) : (
        <TableShell>
          <TableHead cells={['Startup', 'User', 'Permission', 'Added', 'Actions']} />
          <tbody>
            {members.length === 0 ? (
              <EmptyRow colSpan={5} message="No members" />
            ) : (
              members.map((m) => (
                <tr key={`${m.startup_id}-${m.user_id}`} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{startupName(m.startup_id)}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{m.user_name ?? m.user_id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">{m.user_id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={PERMISSION_TONES[m.permission]}>{m.permission}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDate(m.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => remove(m)}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                <Users2 className="h-5 w-5 text-primary" /> Add startup member
              </h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-300">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Startup</label>
                <select
                  value={startupId}
                  onChange={(e) => setStartupId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                >
                  <option value="">Select a startup...</option>
                  {startups.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">User</label>
                {selectedUser ? (
                  <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-dark-300 dark:bg-dark">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedUser.full_name || selectedUser.email || selectedUser.username}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedUser(null)
                        setUserResults([])
                        setUserQuery('')
                      }}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      clear
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={userQuery}
                      onChange={(e) => searchUsers(e.target.value)}
                      placeholder="Type a name or email to search..."
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
                    />
                    {userResults.length > 0 && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 dark:border-dark-300">
                        {userResults.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => setSelectedUser(u)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary/5"
                          >
                            <span className="font-medium text-gray-900 dark:text-white">
                              {u.full_name || u.username || 'Unnamed'}
                            </span>
                            <span className="text-xs text-gray-400">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-900 dark:text-white">Permission</label>
                <div className="flex flex-wrap gap-2">
                  {PERMISSIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPermission(p)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        permission === p
                          ? 'bg-primary text-white'
                          : 'border border-gray-200 text-gray-500 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 dark:border-dark-300 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={addMember}
                className="rounded-xl bg-gradient-brand px-5 py-2 text-sm font-semibold text-white"
              >
                Add member
              </button>
            </div>
          </Card>
        </div>
      )}
      {dialog}
    </div>
  )
}
