import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { MessageSquare } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { ChatList } from '../components/chat/ChatList'
import { ChatWindow } from '../components/chat/ChatWindow'
import { NewMessageModal } from '../components/chat/NewMessageModal'
import { useSession } from '../context/AuthContext'
import {
  getMyChats,
  getUnreadCounts,
  markChatRead,
  markMessagesRead,
  startChat,
  subscribeToChats,
} from '../lib/chat'
import { friendlyDbError } from '../lib/helpers'
import type { Chat } from '../types'

export default function Messages() {
  const { user, profile } = useSession()
  const [chats, setChats] = useState<Chat[]>([])
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [activeChat, setActiveChat] = useState<Chat | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const fetchIdRef = useRef(0)

  const loadChats = useCallback(async (): Promise<Chat[] | undefined> => {
    if (!user) return undefined
    const id = ++fetchIdRef.current
    setLoadError(null)
    try {
      const data = await getMyChats(user.id)
      if (id !== fetchIdRef.current) return undefined
      setChats(data)
      const counts = await getUnreadCounts(data.map((c) => c.id), user.id)
      if (id !== fetchIdRef.current) return undefined
      setUnreadCounts(counts)
      return data
    } catch (error) {
      if (id === fetchIdRef.current) setLoadError(friendlyDbError(error).message)
      return undefined
    } finally {
      if (id === fetchIdRef.current) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadChats()
  }, [loadChats])

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToChats(user.id, () => {
      void loadChats()
    })
    return unsubscribe
  }, [user, loadChats])

  // Deep link: /messages?user=<uuid> opens (or starts) a conversation.
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    const otherId = params.get('user')
    if (!otherId || !/^[0-9a-f-]{8}(-[0-9a-f-]{4}){3}-[0-9a-f-]{12}$/i.test(otherId)) return
    window.history.replaceState({}, '', window.location.pathname)
    let cancelled = false
    void (async () => {
      try {
        const chat = await startChat(otherId)
        if (cancelled) return
        const data = await loadChats()
        const found = data?.find((c) => c.id === chat.id)
        setActiveChat(found ?? chat)
        setUnreadCounts((prev) => ({ ...prev, [chat.id]: 0 }))
        void markMessagesRead(chat.id, user.id)
        markChatRead(chat.id).catch(() => {})
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not open this conversation')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, loadChats])

  const handleSelectChat = (chat: Chat) => {
    if (!user) return
    setActiveChat(chat)
    setUnreadCounts((prev) => ({ ...prev, [chat.id]: 0 }))
    // Direct supabase RLS update is the reliable path for clearing unread
    // state (backend markChatRead has been flaky); keep both for redundancy.
    void markMessagesRead(chat.id, user.id)
    markChatRead(chat.id).catch(() => {})
  }

  const handleChatCreated = async (chat: Chat) => {
    const data = await loadChats()
    const found = data?.find((c) => c.id === chat.id)
    setActiveChat(found ?? chat)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Messages" backTo="/dashboard" />
      <div className="mx-auto flex h-[calc(100dvh-8rem)] max-w-7xl px-0 pb-24 sm:px-4 lg:h-[calc(100dvh-4rem)] lg:px-6 lg:pb-0">
        {/* Chat list */}
        <aside
          className={`${
            activeChat ? 'hidden md:block' : 'block'
          } w-full flex-shrink-0 border-r border-gray-200 bg-white md:w-80 dark:border-dark-300 dark:bg-dark-100`}
        >
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">Loading conversations...</p>
          ) : loadError ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-red-400" />
              <p className="mt-3 text-sm font-medium text-red-500">Could not load conversations</p>
              <p className="mt-1 break-words text-xs text-gray-400">{loadError}</p>
              <button
                onClick={() => void loadChats()}
                className="btn-ghost mx-auto mt-4 text-xs"
              >
                Try again
              </button>
            </div>
          ) : (
            <ChatList
              chats={chats}
              currentUserId={user?.id ?? ''}
              unreadCounts={unreadCounts}
              activeChatId={activeChat?.id ?? null}
              onSelectChat={handleSelectChat}
              onNewChat={() => setModalOpen(true)}
            />
          )}
        </aside>

        {/* Active chat / placeholder */}
        <section
          className={`${activeChat ? 'block' : 'hidden md:block'} min-w-0 flex-1 md:block`}
        >
          {activeChat ? (
            <ChatWindow
              key={activeChat.id}
              chat={activeChat}
              userId={user?.id ?? ''}
              onBack={() => setActiveChat(null)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
              <MessageSquare className="h-12 w-12" />
              <p className="text-sm font-medium text-gray-500">Select a conversation</p>
              {profile ? (
                <p className="text-sm">Your messages will appear here</p>
              ) : (
                <p className="text-sm">Sign in to see your messages</p>
              )}
            </div>
          )}
        </section>
      </div>

      <NewMessageModal
        open={modalOpen}
        currentUserId={user?.id ?? ''}
        onClose={() => setModalOpen(false)}
        onChatSelected={handleChatCreated}
      />
    </div>
  )
}
