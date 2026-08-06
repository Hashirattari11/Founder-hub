import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Bell, CheckCheck, RefreshCw, Trash2 } from 'lucide-react'
import {
  adminNotificationDelete,
  adminNotificationRead,
  adminNotifications,
  adminNotificationsReadAll,
} from '../../api/admin'
import type { AdminNotification } from '../../types/admin'
import { Badge, Card, formatDateTime, LoadingBlock, PageHeader, statusTone } from './adminUi'

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminNotifications(unreadOnly)
      setNotifications(res.notifications)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [unreadOnly])

  useEffect(() => {
    load()
  }, [load])

  const markRead = async (n: AdminNotification) => {
    try {
      await adminNotificationRead(n.id)
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark read')
    }
  }

  const markAllRead = async () => {
    try {
      await adminNotificationsReadAll()
      setNotifications((prev) => prev.map((x) => ({ ...x, is_read: true })))
      toast.success('All notifications marked as read')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark all read')
    }
  }

  const remove = async (n: AdminNotification) => {
    try {
      await adminNotificationDelete(n.id)
      setNotifications((prev) => prev.filter((x) => x.id !== n.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const unread = notifications.filter((n) => !n.is_read).length

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="System alerts for the admin team."
        actions={
          <>
            <button
              onClick={() => setUnreadOnly((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                unreadOnly
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 text-gray-600 dark:border-dark-300 dark:text-gray-300'
              }`}
            >
              <Bell className="h-3.5 w-3.5" /> Unread only
            </button>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary disabled:opacity-40 dark:border-dark-300 dark:text-gray-300"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </>
        }
      />

      {loading ? (
        <LoadingBlock label="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm text-gray-400">No notifications</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`p-4 transition-opacity ${n.is_read ? 'opacity-70' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{n.title}</p>
                    <Badge tone={n.is_read ? 'gray' : statusTone(n.type)}>
                      {n.is_read ? 'read' : 'unread'}
                    </Badge>
                    <Badge tone="blue">{n.type}</Badge>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{n.body}</p>}
                  {n.data && Object.keys(n.data).length > 0 && (
                    <p className="mt-1 text-xs text-gray-400">{JSON.stringify(n.data)}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">{formatDateTime(n.created_at)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {!n.is_read && (
                    <button
                      onClick={() => markRead(n)}
                      className="rounded-lg p-2 text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-500/10"
                      title="Mark read"
                    >
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => remove(n)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
