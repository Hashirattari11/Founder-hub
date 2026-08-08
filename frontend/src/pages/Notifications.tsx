import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Bell,
  Rocket,
  UserPlus,
  Check,
  X,
  Star,
  MessageCircle,
  Inbox,
  Heart,
  Repeat,
  Handshake,
  Wallet,
  CalendarClock,
  CheckCheck,
  Trash2,
} from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { useSession } from '../context/AuthContext'
import {
  getNotificationHistory,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  subscribeToNotifications,
} from '../lib/notifications'
import { timeAgo } from '../lib/helpers'
import type { AppNotification } from '../types'

function NotificationIcon({ notification }: { notification: AppNotification }) {
  const { type, data } = notification
  const status = data?.status as string | undefined

  if (type === 'startup_match') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Rocket className="h-4 w-4" /></span>
  }
  if (type === 'new_application' || type === 'connection_request' || type === 'new_follower') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><UserPlus className="h-4 w-4" /></span>
  }
  if (type === 'message_received' || type === 'new_message') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><MessageCircle className="h-4 w-4" /></span>
  }
  if (type === 'post_like') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500"><Heart className="h-4 w-4" /></span>
  }
  if (type === 'post_comment') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500"><MessageCircle className="h-4 w-4" /></span>
  }
  if (type === 'post_repost') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><Repeat className="h-4 w-4" /></span>
  }
  if (type === 'status_update' || type === 'application_accepted' || type === 'application_rejected' || type === 'application_shortlisted') {
    const icon = status === 'accepted' || type.includes('accepted') ? <Check className="h-4 w-4" /> : status === 'rejected' || type.includes('rejected') ? <X className="h-4 w-4" /> : status === 'shortlisted' ? <Star className="h-4 w-4" /> : <Bell className="h-4 w-4" />
    const cls =
      status === 'accepted' || type.includes('accepted')
        ? 'bg-green-500/10 text-green-500'
        : status === 'rejected' || type.includes('rejected')
          ? 'bg-red-500/10 text-red-500'
          : status === 'shortlisted'
            ? 'bg-amber-500/10 text-amber-500'
            : 'bg-gray-500/10 text-gray-500'
    return <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${cls}`}>{icon}</span>
  }
  if (type === 'cofounder_request' || type === 'cofounder_accepted') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500/10 text-purple-500"><Handshake className="h-4 w-4" /></span>
  }
  if (type === 'investor_request' || type === 'investor_interested' || type.includes('investor')) {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-500"><Wallet className="h-4 w-4" /></span>
  }
  if (type === 'meeting_invite' || type === 'meeting_accepted' || type === 'meeting_reminder' || type === 'meeting_rescheduled') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500"><CalendarClock className="h-4 w-4" /></span>
  }
  if (type === 'meeting_cancelled' || type === 'role_rejected') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500"><X className="h-4 w-4" /></span>
  }
  if (type === 'role_approved' || type === 'startup_approved') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-500"><Check className="h-4 w-4" /></span>
  }
  return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-500/10 text-gray-500"><Bell className="h-4 w-4" /></span>
}

export default function NotificationsPage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE = 50

  const load = useCallback(
    async (start: number, append: boolean) => {
      if (!user) return
      const setLoadingFn = start === 0 ? setLoading : setLoadingMore
      setLoadingFn(true)
      try {
        const res = await getNotificationHistory(PAGE, start)
        setTotal(res.total)
        setNotifications((prev) => (append ? [...prev, ...res.notifications] : res.notifications))
        setOffset(start + res.notifications.length)
      } catch {
        if (!append) setNotifications([])
      } finally {
        setLoadingFn(false)
      }
    },
    [user],
  )

  useEffect(() => {
    load(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToNotifications(user.id, (n) => {
      setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]))
      setTotal((t) => t + 1)
    })
    return unsubscribe
  }, [user])

  const handleMarkAllRead = async () => {
    if (!user) return
    await markAllNotificationsRead(user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    toast.success('All notifications marked as read')
  }

  const handleRead = async (n: AppNotification) => {
    if (!n.is_read) {
      await markNotificationRead(n.id)
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    }
    const url = (n.data?.url as string) ?? ''
    if (url.startsWith('/')) {
      navigate(url)
      return
    }
    const postId = n.data?.post_id as string | undefined
    const startupId = n.data?.startup_id as string | undefined
    const meetingId = n.data?.meeting_id as string | undefined
    const senderId = n.data?.sender_id as string | undefined
    if (postId && (n.type === 'post_like' || n.type === 'post_comment' || n.type === 'post_repost')) {
      navigate(`/community/post/${postId}`)
      return
    }
    if (meetingId && (n.type.startsWith('meeting') || n.type === 'action_item')) {
      navigate(`/meetings/${meetingId}`)
      return
    }
    if (startupId) {
      navigate(`/startups/${startupId}`)
      return
    }
    if (senderId && n.type.includes('message')) {
      navigate(`/messages?user=${senderId}`)
      return
    }
    navigate('/dashboard')
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteNotification(id)
    setNotifications((prev) => prev.filter((x) => x.id !== id))
    setTotal((t) => Math.max(0, t - 1))
  }

  const unread = notifications.filter((n) => !n.is_read).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Notifications" />
      <main className="mx-auto max-w-3xl px-4 pt-8 pb-24 sm:px-6 lg:pb-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">Notifications</h1>
              <p className="text-sm text-gray-500">
                {unread > 0 ? `${unread} unread · ` : ''}
                {total} total
              </p>
            </div>
          </div>
          {unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-dark-300 dark:bg-dark-100">
            <Inbox className="h-10 w-10 text-gray-300" />
            <p className="font-semibold">Nothing here yet</p>
            <p className="text-sm text-gray-500">You'll see matches, applications, meetings and messages here.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleRead(n)}
                className={`group flex cursor-pointer items-start gap-3 border-b border-gray-100 px-4 py-4 transition-colors last:border-0 hover:bg-gray-50 dark:border-dark-300 dark:hover:bg-dark-200 ${
                  n.is_read ? '' : 'bg-primary/[0.03]'
                }`}
              >
                <NotificationIcon notification={n} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${n.is_read ? 'text-gray-600 dark:text-gray-300' : 'font-semibold'}`}>{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                <button
                  onClick={(e) => handleDelete(e, n.id)}
                  aria-label="Delete notification"
                  className="mt-0.5 rounded-md p-1.5 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-dark-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {offset < total && (
              <div className="p-4 text-center">
                <button
                  onClick={() => load(offset, true)}
                  disabled={loadingMore}
                  className="btn-secondary mx-auto disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : `Load more (${total - offset} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
