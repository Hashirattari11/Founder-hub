import { supabase } from './supabase'
import { api } from './api'
import type { AppNotification } from '../types'

export interface NotificationPreferences {
  email_enabled: boolean
  push_enabled: boolean
  marketing: boolean
  meeting_emails: boolean
  message_emails: boolean
  investor_emails: boolean
  application_emails: boolean
  admin_alerts: boolean
  community_emails: boolean
  startup_emails: boolean
  job_emails: boolean
  data_room_emails: boolean
  ai_report_emails: boolean
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_enabled: true,
  push_enabled: true,
  marketing: true,
  meeting_emails: true,
  message_emails: true,
  investor_emails: true,
  application_emails: true,
  admin_alerts: true,
  community_emails: true,
  startup_emails: true,
  job_emails: true,
  data_room_emails: true,
  ai_report_emails: true,
}

/** Insert a notification for the current user (RLS allows own inserts). */
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
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data as AppNotification[]
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', notificationId)
  } catch {
    // Best-effort.
  }
}

export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await supabase.from('notifications').update({ deleted_at: new Date().toISOString() }).eq('id', notificationId)
  } catch {
    // Best-effort.
  }
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
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
    .is('deleted_at', null)
  if (error) return 0
  return count ?? 0
}

// ---------------------------------------------------------------------------
// Preferences (server-side, backend /api/notification-preferences)
// ---------------------------------------------------------------------------

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const res = await api.get<{ preferences: NotificationPreferences }>('/api/notification-preferences', { auth: true })
    return { ...DEFAULT_PREFERENCES, ...res.preferences }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export async function saveNotificationPreferences(
  updates: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const res = await api.put<{ preferences: NotificationPreferences }>('/api/notification-preferences', updates, {
    auth: true,
  })
  return res.preferences
}

/** Fetch full paginated notification history from the backend. */
export async function getNotificationHistory(
  limit = 50,
  offset = 0,
): Promise<{ notifications: AppNotification[]; total: number }> {
  const res = await api.get<{ notifications: AppNotification[]; total: number }>(
    `/api/notifications?limit=${limit}&offset=${offset}`,
    { auth: true },
  )
  return res
}

// ---------------------------------------------------------------------------
// Admin email operations
// ---------------------------------------------------------------------------

export type EmailStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'failed'
  | 'bounced'
  | 'blocked'
  | 'cancelled'

export interface EmailQueueRow {
  id: string
  to_email: string
  subject: string
  template: string | null
  status: EmailStatus
  attempts: number
  max_attempts: number
  error: string | null
  message_id: string | null
  http_status: number | null
  last_error_at: string | null
  created_at: string
  updated_at: string
  sent_at: string | null
}

export async function getEmailQueue(status?: string): Promise<{ queue: EmailQueueRow[]; counts: Record<string, number> }> {
  const res = await api.get<{ queue: EmailQueueRow[]; counts: Record<string, number> }>(
    `/api/admin/email-queue${status ? `?status=${status}` : ''}`,
    { auth: true },
  )
  return res
}

export async function retryFailedEmails(): Promise<number> {
  const res = await api.post<{ retried: number }>('/api/admin/email-queue/retry', {}, { auth: true })
  return res.retried
}

export async function sendBroadcast(payload: {
  title: string
  body: string
  send_email: boolean
}): Promise<number> {
  const res = await api.post<{ notified: number }>('/api/admin/broadcast', payload, { auth: true })
  return res.notified
}

export async function getEmailAnalytics(): Promise<{ total: number; sent: number; failed: number; delivery_rate: number }> {
  const res = await api.get<{ total: number; sent: number; failed: number; delivery_rate: number }>(
    '/api/admin/email-analytics',
    { auth: true },
  )
  return res
}

export async function sendTestEmail(
  toEmail: string,
): Promise<{ success: boolean; recipient: string; message_id: string | null; subject: string }> {
  const res = await api.post<{ success: boolean; recipient: string; message_id: string | null; subject: string }>(
    '/api/admin/email/test',
    { to_email: toEmail },
    { auth: true },
  )
  return res
}

/**
 * Subscribe to realtime INSERTs on the notifications table for a user.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  userId: string,
  onNotification: (notification: AppNotification) => void,
): () => void {
  const channel = supabase
    .channel(`notifications-${userId}-${Math.random().toString(36).slice(2, 8)}`)
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
