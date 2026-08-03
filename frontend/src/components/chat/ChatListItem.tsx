import { memo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Avatar } from '../Avatar'
import { ROLE_LABELS } from '../../types'
import type { Chat, Role } from '../../types'
import { getOtherUser } from '../../lib/chat'

interface ChatListItemProps {
  chat: Chat
  currentUserId: string
  active: boolean
  unread: number
  onClick: () => void
}

function ChatListItemInner({ chat, currentUserId, active, unread, onClick }: ChatListItemProps) {
  const other = getOtherUser(chat, currentUserId)
  const name = other?.full_name ?? 'Unknown user'
  const role = other?.role ? ROLE_LABELS[other.role.toLowerCase() as Role] : null
  const preview = chat.last_message ?? 'No messages yet'
  const timeAgo = chat.last_message_at
    ? formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: true })
    : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        active ? 'bg-primary/10' : 'hover:bg-gray-100 dark:hover:bg-dark-200'
      }`}
    >
      <div className="relative flex-shrink-0">
        <Avatar src={other?.avatar_url} name={name} size="sm" />
        {other?.is_online ? (
          <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-dark-100" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{name}</span>
            {role && (
              <span className="flex-shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-dark-200 dark:text-gray-400">
                {role}
              </span>
            )}
          </div>
          {timeAgo && <span className="flex-shrink-0 text-[11px] text-gray-400">{timeAgo}</span>}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
            {preview.length > 40 ? `${preview.slice(0, 40)}…` : preview}
          </p>
          {unread > 0 && (
            <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export const ChatListItem = memo(ChatListItemInner)
