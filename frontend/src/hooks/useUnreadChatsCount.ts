import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../context/AuthContext'
import { getAllUnreadCounts, getActiveChatForRead, subscribeToChats, subscribeToMessages } from '../lib/chat'

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
      const counts = await getAllUnreadCounts()
      const activeId = getActiveChatForRead()
      if (activeId) counts[activeId] = 0
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

  // Backstops for the realtime stream: refresh when the tab regains focus
  // and on a 30s interval, so a stale badge never sticks around.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    const interval = window.setInterval(() => void refresh(), 30_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      window.clearInterval(interval)
    }
  }, [refresh])

  return count
}
