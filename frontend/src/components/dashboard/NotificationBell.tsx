import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Rocket, UserPlus, Check, X, Star, MessageCircle, Inbox } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSession } from '../../context/AuthContext'
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  subscribeToNotifications,
} from '../../lib/notifications'
import { timeAgo } from '../../lib/helpers'
import type { AppNotification } from '../../types'

function NotificationIcon({ notification }: { notification: AppNotification }) {
  const { type, data } = notification
  const status = data?.status as string | undefined

  if (type === 'startup_match') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Rocket className="h-4 w-4" /></span>
  }
  if (type === 'new_application') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><UserPlus className="h-4 w-4" /></span>
  }
  if (type === 'connection_request') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserPlus className="h-4 w-4" /></span>
  }
  if (type === 'new_message') {
    return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><MessageCircle className="h-4 w-4" /></span>
  }
  if (type === 'status_update') {
    const icon = status === 'accepted' ? <Check className="h-4 w-4" /> : status === 'rejected' ? <X className="h-4 w-4" /> : status === 'shortlisted' ? <Star className="h-4 w-4" /> : <Bell className="h-4 w-4" />
    const cls =
      status === 'accepted'
        ? 'bg-green-500/10 text-green-500'
        : status === 'rejected'
          ? 'bg-red-500/10 text-red-500'
          : status === 'shortlisted'
            ? 'bg-amber-500/10 text-amber-500'
            : 'bg-gray-500/10 text-gray-500'
    return <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${cls}`}>{icon}</span>
  }
  return <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-500/10 text-gray-500"><Bell className="h-4 w-4" /></span>
}

export function NotificationBell() {
  const { user } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    getNotifications(user.id).then(setNotifications).catch(() => {})
    getUnreadCount(user.id).then(setUnread).catch(() => {})
    const unsubscribe = subscribeToNotifications(user.id, (n) => {
      setNotifications((prev) => [n, ...prev].slice(0, 10))
      setUnread((prev) => prev + 1)
    })
    return unsubscribe
  }, [user])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handleMarkAllRead = useCallback(async () => {
    if (!user) return
    await markAllNotificationsRead(user.id)
    setUnread(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }, [user])

  const handleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      if (next && unread > 0) handleMarkAllRead()
      return next
    })
  }, [unread, handleMarkAllRead])

  const handleNavigate = (notification: AppNotification) => {
    setOpen(false)
    const startupId = notification.data?.startup_id as string | undefined
    if (startupId) {
      navigate(`/startups/${startupId}`)
      return
    }
    const requesterUsername = notification.data?.requester_username as string | undefined
    if (notification.type === 'connection_request' && requesterUsername) {
      navigate(`/profile/${requesterUsername}`)
      return
    }
    const senderId = notification.data?.sender_id as string | undefined
    if (notification.type === 'new_message' && senderId) {
      navigate(`/messages?user=${senderId}`)
      return
    }
    navigate('/dashboard')
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-dark-300 dark:bg-dark-100"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-dark-300">
              <p className="text-sm font-bold">Notifications</p>
              <button onClick={handleMarkAllRead} className="text-xs font-medium text-primary hover:underline">
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <Inbox className="h-8 w-8 text-gray-300" />
                  <p className="text-sm text-gray-500">No notifications yet</p>
                </div>
              )}
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNavigate(n)}
                  className="flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-gray-50 dark:border-dark-300 dark:hover:bg-dark-200"
                >
                  <NotificationIcon notification={n} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{n.body}</p>
                    <p className="mt-1 text-[11px] text-gray-400">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
