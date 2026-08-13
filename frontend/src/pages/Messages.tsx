import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../lib/errors'
import toast from 'react-hot-toast'
import { MessageSquare } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { ChatList } from '../components/chat/ChatList'
import { ChatWindow } from '../components/chat/ChatWindow'
import { NewMessageModal } from '../components/chat/NewMessageModal'
import { useSession } from '../context/AuthContext'
import {
  getChatOtherProfile,
  getMyChats,
  getOtherParticipantId,
  getUnreadCounts,
  markMessagesRead,
  resolveChatPartner,
  sameUser,
  setActiveChatForRead,
  startChat,
  subscribeToChats,
  subscribeToMessages,
} from '../lib/chat'
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
  const activeChatIdRef = useRef<string | null>(null)
  activeChatIdRef.current = activeChat?.id ?? null

  const clearUnreadForChat = useCallback(
    (chatId: string) => {
      if (!user) return
      setUnreadCounts((prev) => ({ ...prev, [chatId]: 0 }))
      void markMessagesRead(chatId, user.id)
    },
    [user],
  )

  const loadChats = useCallback(async (): Promise<Chat[] | undefined> => {
    if (!user) return undefined
    const id = ++fetchIdRef.current
    setLoadError(null)
    try {
      const data = await getMyChats(user.id)
      if (id !== fetchIdRef.current) return undefined
      setChats(data)
      setLoading(false)
      setActiveChat((prev) => {
        if (!prev) return prev
        const fromList = data.find((c) => c.id === prev.id)
        if (!fromList) return prev
        // Never drop a verified partner profile when the list reload races startChat.
        if (
          prev.other_participant_profile &&
          resolveChatPartner(fromList, user.id)?.profile?.id !==
            prev.other_participant_profile.id
        ) {
          return {
            ...fromList,
            other_participant_id: prev.other_participant_id,
            other_participant_profile: prev.other_participant_profile,
          }
        }
        return fromList
      })
      void getUnreadCounts(data.map((c) => c.id), user.id)
        .then((counts) => {
          if (id !== fetchIdRef.current) return
          const activeId = activeChatIdRef.current
          if (activeId) counts[activeId] = 0
          setUnreadCounts(counts)
        })
        .catch(() => {
          /* badges are best-effort */
        })
      return data
    } catch (error) {
      if (id === fetchIdRef.current) setLoadError(getErrorMessage(error, 'generic'))
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

  // While a chat is open, keep marking incoming messages read immediately.
  useEffect(() => {
    if (!user || !activeChat) {
      setActiveChatForRead(null)
      return
    }
    const chatId = activeChat.id
    setActiveChatForRead(chatId)
    clearUnreadForChat(chatId)
    const interval = window.setInterval(() => clearUnreadForChat(chatId), 4000)
    const unsubscribe = subscribeToMessages(user.id, () => {
      if (activeChatIdRef.current === chatId) clearUnreadForChat(chatId)
    })
    return () => {
      setActiveChatForRead(null)
      window.clearInterval(interval)
      unsubscribe()
    }
  }, [user, activeChat?.id, clearUnreadForChat])

  // Deep link: /messages?user=<uuid> opens (or starts) a conversation.
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    const otherId = params.get('user')
    if (!otherId || !/^[0-9a-f-]{8}(-[0-9a-f-]{4}){3}-[0-9a-f-]{12}$/i.test(otherId)) return
    if (sameUser(otherId, user.id)) {
      toast.error("You can't start a conversation with yourself.")
      return
    }
    window.history.replaceState({}, '', window.location.pathname)
    let cancelled = false
    void (async () => {
      try {
        const chat = await startChat(otherId)
        if (cancelled) return
        setActiveChat(chat)
        clearUnreadForChat(chat.id)
        void loadChats()
      } catch (error) {
        toast.error(getErrorMessage(error, 'generic'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, loadChats])

  const handleSelectChat = async (chat: Chat) => {
    if (!user) return
    let next = chat
    if (!resolveChatPartner(chat, user.id)?.profile) {
      const otherId = getOtherParticipantId(chat, user.id)
      if (otherId) {
        const other = await getChatOtherProfile(chat, user.id)
        if (other) {
          next = {
            ...chat,
            other_participant_id: otherId,
            other_participant_profile: other,
          }
        }
      }
    }
    setActiveChat(next)
    clearUnreadForChat(next.id)
  }

  const handleChatCreated = async (chat: Chat) => {
    setActiveChat(chat)
    if (user) clearUnreadForChat(chat.id)
    void loadChats()
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
            <ErrorBoundary softReset title="Could not load this chat">
              <ChatWindow
                key={activeChat.id}
                chat={activeChat}
                userId={user?.id ?? ''}
                onBack={() => setActiveChat(null)}
                onChatUpdated={() => void loadChats()}
              />
            </ErrorBoundary>
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
