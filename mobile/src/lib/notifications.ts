import { supabase } from './supabase'
import type { AppNotification } from '@/types'

export async function insertNotification(input: {
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
}): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  try {
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
    })
  } catch {
    // Notifications are best-effort.
  }
}

export async function getNotifications(userId: string, limit = 10): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as AppNotification[]
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
  } catch {
    // Best-effort.
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) return 0
  return count ?? 0
}

export function subscribeToNotifications(
  userId: string,
  onNotification: (notification: AppNotification) => void,
): () => void {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotification(payload.new as AppNotification)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
