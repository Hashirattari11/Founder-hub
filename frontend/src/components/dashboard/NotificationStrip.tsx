import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, X, Star, Rocket, UserPlus, ArrowRight } from 'lucide-react'
import { getNotifications } from '../../lib/notifications'
import { timeAgo } from '../../lib/helpers'
import type { AppNotification } from '../../types'

function FeedIcon({ notification }: { notification: AppNotification }) {
  const { type, data } = notification
  const status = data?.status as string | undefined

  if (type === 'startup_match') {
    return <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Rocket className="h-4 w-4" /></span>
  }
  if (type === 'new_application') {
    return <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent"><UserPlus className="h-4 w-4" /></span>
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
    return <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${cls}`}>{icon}</span>
  }
  return <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-500/10 text-gray-500"><Bell className="h-4 w-4" /></span>
}

export function NotificationStrip({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  useEffect(() => {
    let active = true
    getNotifications(userId, 4)
      .then((data) => {
        if (active) setNotifications(data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [userId])

  if (notifications.length === 0) return null

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Latest activity</h2>
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-dark-300 dark:bg-dark"
          >
            <FeedIcon notification={n} />
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-semibold">{n.title}</p>
              <p className="line-clamp-1 text-xs text-gray-500">{n.body}</p>
              <p className="mt-0.5 text-[11px] text-gray-400">{timeAgo(n.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
