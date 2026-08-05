import { Link } from 'react-router-dom'
import { MessageSquare } from 'lucide-react'
import { useUnreadChatsCount } from '../hooks/useUnreadChatsCount'

export function MessagesButton() {
  const unreadCount = useUnreadChatsCount()

  return (
    <Link
      to="/messages"
      aria-label="Messages"
      className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
    >
      <MessageSquare className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
