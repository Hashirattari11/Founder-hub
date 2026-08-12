import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  Copy,
  CornerUpRight,
  Pencil,
  ReplyAll,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Avatar } from '../Avatar'
import { useConfirm } from '../ConfirmDialog'
import { ChatInput } from './ChatInput'
import { MessageBubble } from './MessageBubble'
import { MessageActionsMenu } from './MessageActionsMenu'
import type { MenuAction } from './MessageActionsMenu'
import { ForwardModal } from './ForwardModal'
import { TypingIndicator } from './TypingIndicator'
import { supabase } from '../../lib/supabase'
import {
  deleteMessageForEveryone,
  deleteMessageForMe,
  getChatMessages,
  getChatOtherProfile,
  resolveChatPartner,
  hydrateReplyTo,
  markMessagesRead,
  messagePreview,
  sendForwardedMessage,
  startChat,
  subscribeToChatMessages,
  subscribeToTyping,
  toggleReaction,
} from '../../lib/chat'
import { formatDayDivider, isSameDay, timeAgo } from '../../lib/helpers'
import { profileDisplayName } from '../../lib/users'
import { playMessageSound } from '../../lib/sound'
import type { Chat, ChatMessage, ChatProfile } from '../../types'

interface ChatWindowProps {
  chat: Chat
  userId: string
  onBack: () => void
}

interface MenuState {
  message: ChatMessage
  x: number
  y: number
}

export function ChatWindow({ chat, userId, onBack }: ChatWindowProps) {
  const { confirm, dialog } = useConfirm()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)
  const [liveStatus, setLiveStatus] = useState<{
    is_online: boolean
    last_seen: string | null
  } | null>(null)

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [forwardOpen, setForwardOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [resolvedChat, setResolvedChat] = useState(chat)
  const [resolvedOther, setResolvedOther] = useState<ChatProfile | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const nearBottomRef = useRef(true)
  const other = resolvedOther ?? resolveChatPartner(resolvedChat, userId)?.profile ?? null
  const displayOther = liveStatus && other ? { ...other, ...liveStatus } : other

  // Hide messages the current user deleted "for me".
  const visibleMessages = useMemo(() => {
    const seen = new Set<string>()
    return messages.filter((m) => {
      if (seen.has(m.id)) return false
      seen.add(m.id)
      return !(m.deleted_for ?? []).includes(userId)
    })
  }, [messages, userId])

  const searchedMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return visibleMessages
    return visibleMessages.filter((m) =>
      (m.content ?? '').toLowerCase().includes(q) ||
      (m.reply_to?.content ?? '').toLowerCase().includes(q),
    )
  }, [visibleMessages, searchQuery])

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const showDesktopNotification = useCallback((title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    try {
      new Notification(title, { body })
    } catch {
      /* notifications unavailable */
    }
  }, [])

  // Always load the other participant by UUID — never trust embeds.
  useEffect(() => {
    let cancelled = false
    setResolvedChat(chat)
    setResolvedOther(null)
    void getChatOtherProfile(chat, userId).then((profile) => {
      if (!cancelled) {
        setResolvedOther(profile)
        if (profile) {
          setResolvedChat((prev) => ({
            ...prev,
            other_participant_id: profile.id,
            other_participant_profile: profile,
          }))
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [chat, userId])

  // Initial load
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setMessages([])
    setOtherTyping(false)
    setLiveStatus(null)
    setReplyTo(null)
    setEditingMsg(null)
    setSelectMode(false)
    setSelectedIds(new Set())
    setSearchOpen(false)
    setSearchQuery('')
    nearBottomRef.current = true

    getChatMessages(chat.id)
      .then((msgs) => {
        if (cancelled) return
        setMessages(msgs)
        setHasMore(msgs.length >= 50)
        setLoading(false)
        requestAnimationFrame(() => scrollToBottom(false))
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    markMessagesRead(chat.id, userId).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [chat.id, userId, scrollToBottom])

  // Live messages + typing
  useEffect(() => {
    const cleanupMessages = subscribeToChatMessages(
      chat.id,
      userId,
      (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        if (msg.reply_to_id) {
          void hydrateReplyTo(msg)
            .then((hydrated) => {
              setMessages((prev) =>
                prev.map((m) => (m.id === msg.id ? hydrated : m)),
              )
            })
            .catch(() => {})
        }
        if (msg.sender_id !== userId) {
          markMessagesRead(chat.id, userId).catch(() => {})
          if (!document.hasFocus()) {
            showDesktopNotification(
              displayOther?.full_name ?? 'New message',
              messagePreview(msg),
            )
            playMessageSound()
          }
        }
        if (nearBottomRef.current) requestAnimationFrame(() => scrollToBottom(true))
      },
      (msg) => {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
      },
    )
    const cleanupTyping = subscribeToTyping(chat.id, userId, setOtherTyping)
    return () => {
      cleanupMessages()
      cleanupTyping()
    }
  }, [chat.id, userId, displayOther?.full_name, scrollToBottom, showDesktopNotification])

  // Live online status for the other participant
  useEffect(() => {
    if (!other?.id) return
    const channel = supabase
      .channel(`presence-${other.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${other.id}`,
        },
        (payload) => {
          const row = payload.new as { is_online: boolean; last_seen: string | null }
          setLiveStatus({ is_online: row.is_online, last_seen: row.last_seen })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [other?.id])

  // Live reactions for the open chat
  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${chat.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const next = payload.new as { message_id: string; user_id: string; emoji: string; created_at: string } | null
          const prev = payload.old as { message_id: string; user_id: string } | null
          const messageId = next?.message_id ?? prev?.message_id
          const reactingUserId = next?.user_id ?? prev?.user_id
          if (!messageId || !reactingUserId) return
          setMessages((curr) => {
            if (!curr.some((m) => m.id === messageId)) return curr
            return curr.map((m) => {
              if (m.id !== messageId) return m
              let reactions = m.reactions ?? []
              if (payload.eventType === 'DELETE') {
                reactions = reactions.filter((r) => r.user_id !== reactingUserId)
              } else if (next && !reactions.some((r) => r.user_id === reactingUserId)) {
                reactions = [
                  ...reactions,
                  { message_id: messageId, user_id: reactingUserId, emoji: next.emoji, created_at: next.created_at },
                ]
              } else if (next) {
                reactions = reactions.map((r) =>
                  r.user_id === reactingUserId ? { ...r, emoji: next.emoji } : r,
                )
              }
              return { ...m, reactions }
            })
          })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [chat.id])

  // Ask for notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  const loadOlder = async () => {
    const oldest = visibleMessages[0]
    if (!oldest || loadingOlder) return
    setLoadingOlder(true)
    const prevScrollHeight = scrollRef.current?.scrollHeight ?? 0
    try {
      const older = await getChatMessages(chat.id, oldest.id)
      if (older.length === 0) {
        setHasMore(false)
        return
      }
      setMessages((prev) => [
        ...older.filter((o) => !prev.some((p) => p.id === o.id)),
        ...prev,
      ])
      setHasMore(older.length >= 50)
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop =
            scrollRef.current.scrollHeight - prevScrollHeight
        }
      })
    } finally {
      setLoadingOlder(false)
    }
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (el.scrollTop < 40 && hasMore) void loadOlder()
  }

  const handleMessageSent = useCallback(
    (msg: ChatMessage) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      requestAnimationFrame(() => scrollToBottom(true))
      // Email + push notification to the other participant is fired inside
      // sendChatMessage (lib/chat.ts) so every send path is covered.
    },
    [scrollToBottom],
  )

  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleReaction(messageId, userId, emoji)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          const existing = (m.reactions ?? []).find((r) => r.user_id === userId)
          let reactions = m.reactions ?? []
          if (existing) {
            if (existing.emoji === emoji) {
              reactions = reactions.filter((r) => r.user_id !== userId)
            } else {
              reactions = reactions.map((r) =>
                r.user_id === userId ? { ...r, emoji } : r,
              )
            }
          } else {
            reactions = [
              ...reactions,
              {
                message_id: messageId,
                user_id: userId,
                emoji,
                created_at: new Date().toISOString(),
              },
            ]
          }
          return { ...m, reactions }
        }),
      )
    } catch {
      /* reaction failed silently */
    }
  }

  // ---- Message actions ----
  const handleCopy = (msg: ChatMessage) => {
    const text =
      msg.type === 'text' ? (msg.content ?? '') : (msg.file_url ?? '')
    void navigator.clipboard.writeText(text).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Could not copy'),
    )
  }

  const handleEdit = (msg: ChatMessage) => {
    if (msg.type !== 'text' || !msg.content) return
    setReplyTo(null)
    setEditingMsg(msg)
    scrollToBottom(true)
  }

  const handleDelete = async (msg: ChatMessage, scope: 'everyone' | 'me') => {
    if (scope === 'everyone') {
      const ok = await confirm({
        title: 'Delete for everyone?',
        message: 'This will delete the message for everyone in the chat.',
        confirmLabel: 'Delete',
      })
      if (!ok) return
    }
    try {
      if (scope === 'everyone') await deleteMessageForEveryone(msg.id)
      else await deleteMessageForMe(msg.id, userId)
    } catch {
      toast.error('Could not delete the message')
    }
  }

  const handleEnterSelect = (messageId: string) => {
    setSelectMode(true)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.add(messageId)
      return next
    })
  }

  const handleToggleSelect = (messageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleForward = async (receiverId: string) => {
    const targets = selectMode
      ? visibleMessages.filter((m) => selectedIds.has(m.id))
      : menu
        ? [menu.message]
        : []
    if (targets.length === 0) return
    const chatForTarget = await startChat(receiverId)
    for (const m of targets) {
      await sendForwardedMessage({ chatId: chatForTarget.id, senderId: userId, message: m })
    }
  }

  const handleDeleteSelected = async () => {
    const targets = visibleMessages.filter((m) => selectedIds.has(m.id))
    if (targets.length === 0) return
    if (targets.length > 1) {
      const ok = await confirm({
        title: `Delete ${targets.length} messages?`,
        message: 'This will permanently delete the selected messages.',
        confirmLabel: 'Delete',
      })
      if (!ok) return
    }
    for (const m of targets) {
      if (m.sender_id === userId) await deleteMessageForEveryone(m.id)
      else await deleteMessageForMe(m.id, userId)
    }
    exitSelectMode()
  }

  const buildMenuActions = (): MenuAction[] => {
    if (!menu) return []
    const msg = menu.message
    const isOwn = msg.sender_id === userId
    const actions: MenuAction[] = [
      { label: 'Reply', icon: <ReplyAll className="h-4 w-4" />, onClick: () => setReplyTo(msg) },
      { label: 'Copy', icon: <Copy className="h-4 w-4" />, onClick: () => handleCopy(msg) },
      { label: 'Forward', icon: <CornerUpRight className="h-4 w-4" />, onClick: () => setForwardOpen(true) },
    ]
    if (isOwn && msg.type === 'text' && msg.content && !msg.is_deleted) {
      actions.push({
        label: 'Edit',
        icon: <Pencil className="h-4 w-4" />,
        onClick: () => handleEdit(msg),
      })
    }
    actions.push({
      label: 'Select',
      icon: <CheckSquare className="h-4 w-4" />,
      onClick: () => handleEnterSelect(msg.id),
    })
    if (isOwn && !msg.is_deleted) {
      actions.push({
        label: 'Delete for everyone',
        icon: <Trash2 className="h-4 w-4" />,
        danger: true,
        onClick: () => void handleDelete(msg, 'everyone'),
      })
    }
    actions.push({
      label: 'Delete for me',
      icon: <Trash2 className="h-4 w-4" />,
      danger: true,
      onClick: () => void handleDelete(msg, 'me'),
    })
    return actions
  }

  const lastSeen = displayOther?.last_seen ? timeAgo(displayOther.last_seen) : ''
  const selectedCount = selectedIds.size

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-dark-300">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to conversations"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 md:hidden dark:border-dark-300 dark:text-gray-300"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {selectMode ? (
          <div className="flex flex-1 items-center justify-between gap-3">
            <span className="text-sm font-semibold">
              {selectedCount} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setForwardOpen(true)}
                disabled={selectedCount === 0}
                aria-label="Forward selected"
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-dark-300"
              >
                <CornerUpRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSelected()}
                disabled={selectedCount === 0}
                aria-label="Delete selected"
                className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-40"
              >
                <Trash2 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={exitSelectMode}
                aria-label="Cancel selection"
                className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        ) : searchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                name="search-in-chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search in chat..."
                className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark dark:text-gray-100"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false)
                setSearchQuery('')
              }}
              aria-label="Close search"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                if (displayOther?.username) window.location.href = `/profile/${displayOther.username}`
              }}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="relative flex-shrink-0">
                <Avatar src={displayOther?.avatar_url} name={displayOther?.full_name} size="sm" />
                {displayOther?.is_online ? (
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white dark:ring-dark-100" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {displayOther ? profileDisplayName(displayOther) : 'Member'}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {displayOther?.is_online
                    ? 'Online'
                    : lastSeen
                      ? `Last seen ${lastSeen}`
                      : 'Offline'}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (other?.id) window.location.href = `/meetings?with=${other.id}`
              }}
              aria-label="Schedule a meeting"
              title="Schedule a meeting"
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-300"
            >
              <CalendarDays className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search in chat"
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-300"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onBack}
              aria-label="Close chat"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 md:flex dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-300"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        )}
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-1 overflow-y-auto bg-gray-50 p-3 sm:p-4 dark:bg-dark"
      >
        {searchOpen && searchQuery.trim() && (
          <div className="flex items-center justify-center py-1">
            <span className="rounded-full bg-primary/10 px-3 py-0.5 text-[11px] font-medium text-primary">
              {searchedMessages.length} match{searchedMessages.length === 1 ? '' : 'es'}
            </span>
          </div>
        )}

        {loadingOlder && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-gray-400">Loading older messages…</span>
          </div>
        )}

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-gray-400">Loading messages…</span>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              This is the beginning of your conversation
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-400">
              Say hi 👋 and start the conversation
            </p>
          </div>
        ) : searchedMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-gray-400">No messages match “{searchQuery}”</span>
          </div>
        ) : (
          searchedMessages.map((msg, i) => {
            const prev = searchedMessages[i - 1]
            const newDay = !prev || !isSameDay(prev.created_at, msg.created_at)
            const firstOfGroup = !prev || prev.sender_id !== msg.sender_id
            return (
              <Fragment key={msg.id}>
                {newDay && (
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full bg-gray-100 px-3 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-dark-300 dark:text-gray-400">
                      {formatDayDivider(msg.created_at)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={msg.sender_id === userId}
                  showAvatar={firstOfGroup}
                  currentUserId={userId}
                  other={displayOther}
                  highlight={searchQuery.trim() || undefined}
                  onReaction={handleReaction}
                  onOpenMenu={(message, position) => setMenu({ message, x: position.x, y: position.y })}
                  onEnterSelect={handleEnterSelect}
                  selectMode={selectMode}
                  selected={selectedIds.has(msg.id)}
                  onToggleSelect={handleToggleSelect}
                />
              </Fragment>
            )
          })
        )}

        {otherTyping && (
          <div className="mt-2">
            <TypingIndicator name={displayOther?.full_name} />
          </div>
        )}
      </div>

      {/* Bottom: input or select-mode toolbar */}
      {selectMode ? (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-dark-300">
          <button
            type="button"
            onClick={exitSelectMode}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-dark-300"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForwardOpen(true)}
              disabled={selectedCount === 0}
              className="btn-ghost disabled:opacity-40"
            >
              <CornerUpRight className="h-4 w-4" />
              Forward
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteSelected()}
              disabled={selectedCount === 0}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      ) : (
        <ChatInput
          chatId={chat.id}
          userId={userId}
          replyTo={replyTo}
          editing={editingMsg}
          onCancelReply={() => setReplyTo(null)}
          onCancelEdit={() => setEditingMsg(null)}
          onMessageSent={handleMessageSent}
        />
      )}

      {/* Context menu */}
      {menu && (
        <MessageActionsMenu
          x={menu.x}
          y={menu.y}
          actions={buildMenuActions()}
          onClose={() => setMenu(null)}
        />
      )}

      {/* Forward modal */}
      <ForwardModal
        open={forwardOpen}
        currentUserId={userId}
        count={selectMode ? selectedCount : menu ? 1 : 0}
        onForwardTo={handleForward}
        onClose={() => setForwardOpen(false)}
      />
      {dialog}
    </div>
  )
}
