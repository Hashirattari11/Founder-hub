import { supabase } from './supabase'
import { api } from './api'
import { uriToBlob } from './assets'
import type { Chat, ChatMessage, ChatMessageType, ChatProfile, MessageReaction, Profile, RepliedMessage } from '@/types'

export const CHAT_PROFILE_FIELDS = 'id, full_name, username, avatar_url, role, is_online, last_seen'
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

export function getOtherParticipantId(chat: Chat, currentUserId: string): string | null {
  if (chat.participant_1 === currentUserId) return chat.participant_2
  if (chat.participant_2 === currentUserId) return chat.participant_1
  return null
}

function profileForParticipant(
  chat: Chat,
  participantId: string,
): ChatProfile | null | undefined {
  if (chat.participant_1 === participantId) return chat.participant_1_profile
  if (chat.participant_2 === participantId) return chat.participant_2_profile
  return null
}

export function getOtherUser(
  chat: Chat,
  currentUserId: string,
): ChatProfile | null {
  const otherId = getOtherParticipantId(chat, currentUserId)
  if (!otherId || otherId === currentUserId) return null

  const profile = profileForParticipant(chat, otherId)
  if (profile?.id === otherId) return profile
  return null
}

export async function hydrateChatProfiles(chat: Chat): Promise<Chat> {
  const ids = [chat.participant_1, chat.participant_2].filter(Boolean)
  if (ids.length === 0) return chat

  const { data, error } = await supabase
    .from('profiles')
    .select(CHAT_PROFILE_FIELDS)
    .in('id', ids)
  if (error) throw error

  const byId = new Map((data ?? []).map((row) => [row.id as string, row as ChatProfile]))
  return {
    ...chat,
    participant_1_profile: byId.get(chat.participant_1) ?? null,
    participant_2_profile: byId.get(chat.participant_2) ?? null,
  }
}

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
  const rows = (data ?? []) as Chat[]
  return Promise.all(rows.map((row) => hydrateChatProfiles(row)))
}

export async function startChat(receiverId: string): Promise<Chat> {
  if (!receiverId || !/^[0-9a-f-]{36}$/i.test(receiverId)) {
    throw new Error('Invalid recipient — could not start conversation.')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const me = session?.user?.id
  if (me && receiverId === me) {
    throw new Error("You can't start a conversation with yourself.")
  }

  const chat = await api.post<Chat>('/api/chats/start', { receiver_id: receiverId }, { auth: true })
  return hydrateChatProfiles(chat)
}

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

/** Fire-and-forget email + push to the OTHER participant when a message lands. */
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
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: params.chatId,
      sender_id: params.senderId,
      content: params.content,
      type: params.type ?? 'text',
      file_url: params.fileUrl ?? null,
      file_name: params.fileName ?? null,
      file_size: params.fileSize ?? null,
      reply_to_id: params.replyToId ?? null,
      is_forwarded: params.isForwarded ?? false,
    })
    .select(MESSAGE_FIELDS)
    .single()
  if (error) throw error
  const hydrated = await hydrateReplyTos([data as ChatMessage])
  // Notify the other participant (email + push) in the background.
  void notifyMessageParticipant(params.chatId, params.senderId)
  return hydrated[0]
}

export async function editChatMessage(messageId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', messageId)
  if (error) throw error
}

export async function deleteMessageForEveryone(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true, content: null })
    .eq('id', messageId)
  if (error) throw error
}

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

export async function markMessagesRead(chatId: string, userId: string): Promise<void> {
  // SECURITY DEFINER RPC (runs as service role) — the RLS-based update silently
  // failed and left messages unread even after the user opened the chat.
  const { error } = await supabase.rpc('mark_chat_messages_read', {
    p_chat_id: chatId,
    p_user_id: userId,
  })
  if (error) throw error
}

export async function uploadChatAttachment(
  userId: string,
  uri: string,
  fileName: string,
): Promise<{ url: string; size: number; name: string }> {
  const isImage = /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(fileName)
  const bucket = isImage ? 'chat-images' : 'chat-files'
  const ext = (fileName.split('.').pop() ?? 'bin').toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const blob = await uriToBlob(uri)
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType: isImage ? 'image/jpeg' : 'application/octet-stream' })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, size: blob.size, name: fileName }
}

export async function uploadVoiceNote(
  userId: string,
  blob: Blob,
  extension = 'webm',
): Promise<{ url: string; size: number }> {
  const ext = extension.replace(/^\./, '').toLowerCase()
  const contentType = ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : 'audio/webm'
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('chat-voices').upload(path, blob, {
    contentType,
  })
  if (error) throw error
  const { data } = supabase.storage.from('chat-voices').getPublicUrl(path)
  return { url: data.publicUrl, size: blob.size }
}

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

export function subscribeToChatMessages(
  chatId: string,
  userId: string,
  onNew: (msg: ChatMessage) => void,
  onUpdate?: (msg: ChatMessage) => void,
): () => void {
  const channel = supabase
    .channel(`chat-${chatId}`)
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

export function subscribeToTyping(
  chatId: string,
  userId: string,
  onChange: (typing: boolean) => void,
): () => void {
  const channel = supabase
    .channel(`typing-${chatId}`)
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

export async function markChatRead(chatId: string): Promise<void> {
  await api.post(`/api/messages/${chatId}/read`, undefined, { auth: true })
}

export async function uploadChatFile(uri: string, fileName: string): Promise<{ url: string }> {
  const form = new FormData()
  const blob = await uriToBlob(uri)
  form.append('file', blob, fileName)
  return api.post<{ url: string }>('/api/upload/chat-file', form, { auth: true })
}

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

export async function getUnreadCounts(chatIds: string[], userId: string): Promise<Record<string, number>> {
  const entries = await Promise.all(chatIds.map((id) => getUnreadCount(id, userId)))
  const map: Record<string, number> = {}
  chatIds.forEach((id, i) => {
    map[id] = entries[i]
  })
  return map
}

export function subscribeToChats(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`chat-list-${userId}`)
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

export async function searchUsers(query: string, excludeUserId: string, limit = 8): Promise<Profile[]> {
  const q = query.trim()
  let builder = supabase
    .from('profiles')
    .select('*')
    .neq('id', excludeUserId)
    .order('full_name')
    .limit(limit)

  if (q) {
    builder = builder.or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
  }

  const { data, error } = await builder
  if (error) throw error
  return (data ?? []) as Profile[]
}
