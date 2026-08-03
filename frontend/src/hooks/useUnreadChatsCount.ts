import { useCallback, useEffect, useState } from 'react'
import { useSession } from '../context/AuthContext'
import { getMyChats, getUnreadCounts, subscribeToChats } from '../lib/chat'

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
    const unsubscribe = subscribeToChats(user.id, () => void refresh())
    return unsubscribe
  }, [user, refresh])

  return count
}
