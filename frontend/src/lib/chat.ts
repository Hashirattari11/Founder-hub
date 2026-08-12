import { supabase } from './supabase'
import { api } from './api'
import { discoverUsers, discoverableToProfile } from './users'
import type { Chat, ChatMessage, ChatMessageType, ChatProfile, MessageReaction, Profile, RepliedMessage } from '../types'

export const CHAT_PROFILE_FIELDS = 'id, full_name, username, avatar_url, role, is_online, last_seen'

/** Unique channel name per subscription call — avoids "cannot add callbacks after subscribe()"
 * when two components subscribe to the same logical stream on one page. */
function uniqueChannel(base: string): string {
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}
export const REPLY_FIELDS =
  'id, content, type, sender_id, file_url, file_name, is_deleted, is_forwarded, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)'
export const MESSAGE_FIELDS = `*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url), reactions:message_reactions(*)`

interface ReplyRow {
  id: string
  content: string | null
  type: string | null
  sender_id: string | null
  file_url: string | null
  file_name: string | null
  is_deleted: boolean | null
  is_forwarded: boolean | null
  sender: Array<{ full_name: string | null; avatar_url: string | null }> | { full_name: string | null; avatar_url: string | null } | null
}

/** Normalize a REPLY_FIELDS row into a RepliedMessage (embed may be object or array). */
function toRepliedMessage(r: ReplyRow): RepliedMessage {
  const rawSender = r.sender ?? null
  const sender = Array.isArray(rawSender) ? (rawSender[0] ?? null) : rawSender
  return {
    id: r.id,
    content: r.content,
    type: (r.type as ChatMessageType) ?? 'text',
    sender_id: r.sender_id ?? '',
    file_url: r.file_url ?? null,
    is_deleted: r.is_deleted ?? false,
    is_forwarded: r.is_forwarded ?? false,
    sender,
  }
}

/**
 * Attach `reply_to` to messages by fetching the referenced messages in one
 * extra query. PostgREST sometimes can't resolve the self-referencing
 * `messages.reply_to_id -> messages.id` embed (stale schema cache), so we
 * avoid the embed entirely and hydrate client-side instead.
 */
async function hydrateReplyTos(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const ids = [...new Set(messages.map((m) => m.reply_to_id).filter(Boolean))] as string[]
  if (ids.length === 0) return messages
  const { data, error } = await supabase.from('messages').select(REPLY_FIELDS).in('id', ids)
  if (error) throw error
  const byId = new Map<string, RepliedMessage>((data ?? []).map((r) => [r.id, toRepliedMessage(r as ReplyRow)]))
  return messages.map((m) =>
    m.reply_to_id ? { ...m, reply_to: byId.get(m.reply_to_id) ?? null } : m,
  )
}

/** Hydrate a single message's reply_to (for realtime INSERTs). */
export async function hydrateReplyTo(msg: ChatMessage): Promise<ChatMessage> {
  if (!msg.reply_to_id) return msg
  const { data, error } = await supabase
    .from('messages')
    .select(REPLY_FIELDS)
    .eq('id', msg.reply_to_id)
    .maybeSingle()
  if (error || !data) return msg
  return { ...msg, reply_to: toRepliedMessage(data as ReplyRow) }
}

/** Return the other participant's profile for a chat. */
export function getOtherUser(
  chat: Chat,
  currentUserId: string,
): ChatProfile | null {
  if (chat.participant_1 === currentUserId) {
    return chat.participant_2_profile ?? null
  }
  if (chat.participant_2 === currentUserId) {
    return chat.participant_1_profile ?? null
  }
  return null
}

/** Attach participant profile rows when a chat payload omits them (e.g. /chats/start). */
export async function hydrateChatProfiles(chat: Chat): Promise<Chat> {
  const missing: string[] = []
  if (!chat.participant_1_profile) missing.push(chat.participant_1)
  if (!chat.participant_2_profile) missing.push(chat.participant_2)
  if (missing.length === 0) return chat

  const { data, error } = await supabase
    .from('profiles')
    .select(CHAT_PROFILE_FIELDS)
    .in('id', missing)
  if (error) throw error

  const byId = new Map((data ?? []).map((row) => [row.id as string, row as ChatProfile]))
  return {
    ...chat,
    participant_1_profile:
      chat.participant_1_profile ?? byId.get(chat.participant_1) ?? null,
    participant_2_profile:
      chat.participant_2_profile ?? byId.get(chat.participant_2) ?? null,
  }
}

/** All chats for the current user, newest last_message first. */
export async function getMyChats(userId: string): Promise<Chat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select(
      `*,
      participant_1_profile:profiles!chats_participant_1_fkey(${CHAT_PROFILE_FIELDS}),
      participant_2_profile:profiles!chats_participant_2_fkey(${CHAT_PROFILE_FIELDS})`,
    )
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order('last_message_at', { ascending: false })
  if (error) throw error
  return data as Chat[]
}

/** Get (or create) a chat with another user via the backend. */
export async function startChat(receiverId: string): Promise<Chat> {
  if (!receiverId || !/^[0-9a-f-]{36}$/i.test(receiverId)) {
    throw new Error('Invalid recipient — could not start conversation.')
  }
  const chat = await api.post<Chat>('/api/chats/start', { receiver_id: receiverId }, { auth: true })
  return hydrateChatProfiles(chat)
}

/** Messages for a chat, 50 at a time (pass before = oldest message id for the previous page). */
export async function getChatMessages(
  chatId: string,
  beforeMessageId?: string,
): Promise<ChatMessage[]> {
  let query = supabase.from('messages').select(MESSAGE_FIELDS).eq('chat_id', chatId)
  if (beforeMessageId) {
    const { data: anchor } = await supabase
      .from('messages')
      .select('created_at')
      .eq('id', beforeMessageId)
      .maybeSingle()
    if (anchor) query = query.lt('created_at', anchor.created_at)
  }
  const { data, error } = await query.order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return hydrateReplyTos((data ?? []).reverse() as ChatMessage[])
}

/**
 * Fire-and-forget email + push to the OTHER participant when a message lands.
 * Lives inside `sendChatMessage` so EVERY send path (chat input, forwarded
 * messages, web and mobile) triggers it — previously only ChatWindow called
 * `/api/notify/message`, so sends from other entry points never emailed.
 */
async function notifyMessageParticipant(chatId: string, senderId: string): Promise<void> {
  try {
    const { data: chat } = await supabase
      .from('chats')
      .select('participant_1, participant_2')
      .eq('id', chatId)
      .maybeSingle()
    if (!chat) return
    const receiverId =
      chat.participant_1 === senderId ? chat.participant_2 : chat.participant_1
    if (!receiverId || receiverId === senderId) return
    await api.post(
      '/api/notify/message',
      { receiver_id: receiverId, chat_id: chatId },
      { auth: true },
    )
  } catch {
    /* best-effort — never block sending on the notification */
  }
}

/** Insert a new message (the DB trigger updates chats.last_message / last_message_at). */
export async function sendChatMessage(params: {
  chatId: string
  senderId: string
  content: string
  type?: ChatMessageType
  fileUrl?: string | null
  fileName?: string | null
  fileSize?: number | null
  replyToId?: string | null
  isForwarded?: boolean
}): Promise<ChatMessage> {
  const type = params.type ?? 'text'
  const isPlainText =
    type === 'text' &&
    !params.fileUrl &&
    !params.replyToId &&
    !params.isForwarded

  // Text-only messages go through the API so RLS/trigger edge cases cannot block sends.
  if (isPlainText) {
    const msg = await api.post<ChatMessage>(
      `/api/messages/${params.chatId}/send`,
      { content: params.content },
      { auth: true },
    )
    return hydrateReplyTos([msg])[0]
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: params.chatId,
      sender_id: params.senderId,
      content: params.content,
      type,
      file_url: params.fileUrl ?? null,
      file_name: params.fileName ?? null,
      file_size: params.fileSize ?? null,
      reply_to_id: params.replyToId ?? null,
      is_forwarded: params.isForwarded ?? false,
    })
    .select('*')
    .single()
  if (error) throw error

  const { data: senderRow } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', params.senderId)
    .maybeSingle()

  const base = {
    ...(data as ChatMessage),
    sender: senderRow ?? null,
    reactions: [] as MessageReaction[],
  }
  const hydrated = await hydrateReplyTos([base])
  void notifyMessageParticipant(params.chatId, params.senderId)
  return hydrated[0]
}

/** Edit the content of one of your own messages. */
export async function editChatMessage(messageId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) throw error
}

/** Soft-delete a message "for everyone" (sender only). */
export async function deleteMessageForEveryone(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true, content: null })
    .eq('id', messageId)
  if (error) throw error
}

/** Soft-delete a message "for me" (hides it from this user's view only). */
export async function deleteMessageForMe(messageId: string, userId: string): Promise<void> {
  const { data, error: readError } = await supabase
    .from('messages')
    .select('deleted_for')
    .eq('id', messageId)
    .maybeSingle()
  if (readError) throw readError
  const current = ((data?.deleted_for as string[] | undefined) ?? []).filter(
    (id: string) => id !== userId,
  )
  const { error } = await supabase
    .from('messages')
    .update({ deleted_for: [...current, userId] })
    .eq('id', messageId)
  if (error) throw error
}

/** Copy a message into another chat (mark it as forwarded). */
export async function sendForwardedMessage(params: {
  chatId: string
  senderId: string
  message: ChatMessage
}): Promise<ChatMessage> {
  return sendChatMessage({
    chatId: params.chatId,
    senderId: params.senderId,
    content: params.message.content ?? 'Attachment',
    type: params.message.type,
    fileUrl: params.message.file_url,
    fileName: params.message.file_name,
    fileSize: params.message.file_size,
    isForwarded: true,
  })
}

/** Friendly text preview for a message (used for quotes, lists, notifications). */
export function messagePreview(message: {
  type?: ChatMessageType
  content?: string | null
  is_deleted?: boolean
}): string {
  if (message.is_deleted) return 'This message was deleted'
  switch (message.type) {
    case 'image':
      return message.content?.trim() ? `📷 ${message.content.trim()}` : '📷 Photo'
    case 'file':
      return `📎 ${message.content?.trim() || 'Attachment'}`
    case 'voice':
      return '🎤 Voice message'
    default:
      return message.content?.trim() || ''
  }
}

/** Mark every message in a chat as read for the current user.
 * Uses the SECURITY DEFINER RPC (runs as service role) because the RLS-based
 * update silently failed — messages stayed unread after opening the chat. */
export async function markMessagesRead(chatId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chat_messages_read', {
    p_chat_id: chatId,
    p_user_id: userId,
  })
  if (error) throw error
}

/** Upload a chat attachment (image → chat-images, otherwise → chat-files). */
export async function uploadChatAttachment(
  userId: string,
  file: File,
): Promise<{ url: string; size: number; name: string }> {
  const isImage = file.type.startsWith('image/')
  const bucket = isImage ? 'chat-images' : 'chat-files'
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type || 'application/octet-stream' })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, size: file.size, name: file.name }
}

/** Upload a voice note blob to chat-voices. */
export async function uploadVoiceNote(
  userId: string,
  blob: Blob,
): Promise<{ url: string; size: number }> {
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`
  const { error } = await supabase.storage.from('chat-voices').upload(path, blob, {
    contentType: 'audio/webm',
  })
  if (error) throw error
  const { data } = supabase.storage.from('chat-voices').getPublicUrl(path)
  return { url: data.publicUrl, size: blob.size }
}

/** Tell the other user we're typing (auto-cleared after 2s of inactivity). */
export async function emitTyping(chatId: string, userId: string): Promise<void> {
  await supabase.from('typing_status').upsert({
    user_id: userId,
    chat_id: chatId,
    is_typing: true,
    updated_at: new Date().toISOString(),
  })
}

export async function stopTyping(chatId: string, userId: string): Promise<void> {
  await supabase
    .from('typing_status')
    .update({ is_typing: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('chat_id', chatId)
}

/** Live messages for one chat. Marks messages read when the other user sends. */
export function subscribeToChatMessages(
  chatId: string,
  userId: string,
  onNew: (msg: ChatMessage) => void,
  onUpdate?: (msg: ChatMessage) => void,
): () => void {
  const channel = supabase
    .channel(uniqueChannel(`chat-${chatId}`))
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      (payload) => {
        const msg = payload.new as ChatMessage
        onNew(msg)
        if (msg.sender_id !== userId) markMessagesRead(chatId, userId).catch(() => {})
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      (payload) => onUpdate?.(payload.new as ChatMessage),
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

/** Live typing indicator for the other user in a chat. */
export function subscribeToTyping(
  chatId: string,
  userId: string,
  onChange: (typing: boolean) => void,
): () => void {
  const channel = supabase
    .channel(uniqueChannel(`typing-${chatId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_status' }, (payload) => {
      const row = (payload.new ?? payload.old) as
        | { user_id: string; chat_id: string; is_typing: boolean }
        | null
      if (!row) return
      if (row.user_id === userId || row.chat_id !== chatId) return
      onChange(row.is_typing)
    })
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

/** Add / change / remove a reaction on a message (toggle). */
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('emoji')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    if (existing.emoji === emoji) {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
    } else {
      await supabase
        .from('message_reactions')
        .update({ emoji })
        .eq('message_id', messageId)
        .eq('user_id', userId)
    }
  } else {
    await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: userId, emoji })
  }
}

/** Group reactions by emoji with counts, keeping the current user's own emoji on top. */
export function summarizeReactions(
  reactions: MessageReaction[] | null | undefined,
  userId: string,
): Array<{ emoji: string; count: number; mine: boolean }> {
  const map = new Map<string, { emoji: string; count: number; mine: boolean }>()
  for (const r of reactions ?? []) {
    const entry = map.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false }
    entry.count += 1
    if (r.user_id === userId) entry.mine = true
    map.set(r.emoji, entry)
  }
  return [...map.values()].sort(
    (a, b) => Number(b.mine) - Number(a.mine) || b.count - a.count,
  )
}

/** Mark all messages in a chat as read for the current user (backend). */
export async function markChatRead(chatId: string): Promise<void> {
  await api.post(`/api/messages/${chatId}/read`, undefined, { auth: true })
}

/** Upload a chat attachment; returns the public URL. */
export async function uploadChatFile(file: File): Promise<{ url: string }> {
  const form = new FormData()
  form.append('file', file)
  return api.post<{ url: string }>('/api/upload/chat-file', form, { auth: true })
}

/** Unread message count for one chat (messages sent by the other user). */
export async function getUnreadCount(chatId: string, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('chat_id', chatId)
    .eq('is_read', false)
    .neq('sender_id', userId)
  if (error) return 0
  return count ?? 0
}

/** Unread counts for many chats. */
export async function getUnreadCounts(chatIds: string[], userId: string): Promise<Record<string, number>> {
  const entries = await Promise.all(chatIds.map((id) => getUnreadCount(id, userId)))
  const map: Record<string, number> = {}
  chatIds.forEach((id, i) => {
    map[id] = entries[i]
  })
  return map
}

/** Subscribe to chat changes so the list stays fresh. Returns an unsubscribe fn. */
export function subscribeToChats(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`chat-list-${userId}`))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chats', filter: `participant_1=eq.${userId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chats', filter: `participant_2=eq.${userId}` },
      onChange,
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

/** Subscribe to message changes (new messages + read-state updates) so the
 * unread badge stays live. RLS on the `messages` table scopes deliveries to
 * chats the current user participates in. Returns an unsubscribe fn. */
export function subscribeToMessages(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(uniqueChannel(`chat-msg-${userId}`))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onChange)
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}

/** Debounced user search for messaging — delegates to canonical discoverUsers. */
export async function searchUsers(query: string, excludeUserId: string, limit = 12): Promise<Profile[]> {
  const rows = await discoverUsers({ query, excludeUserId, limit, onboardedOnly: true })
  return rows.map(discoverableToProfile)
}
