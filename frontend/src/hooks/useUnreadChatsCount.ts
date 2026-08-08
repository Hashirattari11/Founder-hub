import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../context/AuthContext'
import { getMyChats, getUnreadCounts, subscribeToChats, subscribeToMessages } from '../lib/chat'

/** Total unread message count across all chats, kept live via realtime. */
export function useUnreadChatsCount(): number {
  const { user } = useSession()
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0)
      return
    }
    try {
      const chats = await getMyChats(user.id)
      const counts = await getUnreadCounts(chats.map((c) => c.id), user.id)
      setCount(Object.values(counts).reduce((a, b) => a + b, 0))
    } catch {
      /* ignore transient errors */
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!user) return
    // Listen to both chats (new chat / last_message_at) and messages
    // (new incoming message + read-state updates) so the badge clears the
    // moment the user reads a conversation instead of going stale.
    const unsubscribeChats = subscribeToChats(user.id, () => void refresh())
    const unsubscribeMessages = subscribeToMessages(user.id, () => void refresh())
    return () => {
      unsubscribeChats()
      unsubscribeMessages()
    }
  }, [user, refresh])

  return count
}
