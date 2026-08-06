import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Save, ShieldAlert } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { adminLoginLogs, adminSecuritySettings } from '../../api/admin'
import { isSuperAdminProfile } from '../../lib/admin'
import type { LoginLog } from '../../types/admin'
import { Badge, Card, EmptyRow, formatDateTime, LoadingBlock, PageHeader, statusTone, TableHead, TableShell } from './adminUi'

export default function AdminSecurity() {
  const { profile } = useSession()
  const superAdmin = isSuperAdminProfile(profile)
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(true)
  const [twoFactor, setTwoFactor] = useState(false)
  const [maxAttempts, setMaxAttempts] = useState(5)
  const [lockoutMinutes, setLockoutMinutes] = useState(15)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminLoginLogs(100)
      setLogs(res.logs)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load login logs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveSettings = async () => {
    setSaving(true)
    try {
      await adminSecuritySettings({
        two_factor_required: twoFactor,
        max_login_attempts: Math.max(1, maxAttempts),
        lockout_minutes: Math.max(1, lockoutMinutes),
      })
      toast.success('Security settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Security"
        description="Login activity, lockout policy and 2FA requirements."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <Card className="mb-6 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Authentication policy</h3>
            <p className="text-xs text-gray-400">Applies platform-wide. Super Admin only.</p>
          </div>
          {superAdmin && (
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-dark-300">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Require 2FA</span>
            <input
              type="checkbox"
              checked={twoFactor}
              disabled={!superAdmin}
              onChange={(e) => setTwoFactor(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-4 py-3 dark:border-dark-300">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Max login attempts</span>
            <input
              type="number"
              min={1}
              value={maxAttempts}
              disabled={!superAdmin}
              onChange={(e) => setMaxAttempts(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-right outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
            />
          </label>
          <label className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 px-4 py-3 dark:border-dark-300">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Lockout minutes</span>
            <input
              type="number"
              min={1}
              value={lockoutMinutes}
              disabled={!superAdmin}
              onChange={(e) => setLockoutMinutes(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-right outline-none focus:border-primary dark:border-dark-300 dark:bg-dark dark:text-white"
            />
          </label>
        </div>

        {!superAdmin && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-500">
            <ShieldAlert className="h-3.5 w-3.5" /> Only the Super Admin can change these values.
          </p>
        )}
      </Card>

      <h3 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Recent login activity</h3>

      {loading ? (
        <LoadingBlock label="Loading login logs..." />
      ) : (
        <TableShell>
          <TableHead cells={['Email', 'Status', 'Device', 'IP', 'User agent', 'When']} />
          <tbody>
            {logs.length === 0 ? (
              <EmptyRow colSpan={6} message="No login activity recorded" />
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{log.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(log.status)}>{log.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">{log.device ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-300">{log.ip ?? '—'}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-gray-400">{log.user_agent ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(log.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}
