import { useMemo, useState } from 'react'
import { MessageSquarePlus, Search } from 'lucide-react'
import { ChatListItem } from './ChatListItem'
import { resolveChatPartner } from '../../lib/chat'
import type { Chat } from '../../types'

interface ChatListProps {
  chats: Chat[]
  currentUserId: string
  unreadCounts: Record<string, number>
  activeChatId: string | null
  onSelectChat: (chat: Chat) => void
  onNewChat: () => void
}

export function ChatList({
  chats,
  currentUserId,
  unreadCounts,
  activeChatId,
  onSelectChat,
  onNewChat,
}: ChatListProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return chats
    return chats.filter((chat) => {
      const partner = resolveChatPartner(chat, currentUserId)
      const name = (partner?.profile.full_name ?? '').toLowerCase()
      const username = (partner?.profile.username ?? '').toLowerCase()
      return name.includes(q) || username.includes(q)
    })
  }, [chats, search, currentUserId])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-3 dark:border-dark-300">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
          />
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Message
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            {search ? 'No conversations match your search' : 'No conversations yet'}
          </p>
        ) : (
          filtered.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              currentUserId={currentUserId}
              active={chat.id === activeChatId}
              unread={unreadCounts[chat.id] ?? 0}
              onClick={() => onSelectChat(chat)}
            />
          ))
        )}
      </div>
    </div>
  )
}
