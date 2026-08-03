import { useRef } from 'react'
import { Check, CheckCheck, CornerUpRight, MoreVertical, Trash2 } from 'lucide-react'
import { Avatar } from '../Avatar'
import { FileMessage } from './FileMessage'
import { ImageMessage } from './ImageMessage'
import { VoiceMessage } from './VoiceMessage'
import { formatTime } from '../../lib/helpers'
import { messagePreview, summarizeReactions } from '../../lib/chat'
import type { ChatMessage, ChatProfile } from '../../types'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🙌']

function highlightText(text: string, query: string) {
  const q = query.toLowerCase()
  const parts: React.ReactNode[] = []
  let last = 0
  let i = text.toLowerCase().indexOf(q)
  let key = 0
  while (i !== -1) {
    parts.push(text.slice(last, i))
    parts.push(
      <mark key={key++} className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/40">
        {text.slice(i, i + q.length)}
      </mark>,
    )
    last = i + q.length
    i = text.toLowerCase().indexOf(q, last)
  }
  parts.push(text.slice(last))
  return parts
}

interface MessageBubbleProps {
  message: ChatMessage
  isOwn: boolean
  showAvatar: boolean
  currentUserId: string
  other?: ChatProfile | null
  highlight?: string
  onReaction: (messageId: string, emoji: string) => void
  onOpenMenu: (message: ChatMessage, position: { x: number; y: number }) => void
  onEnterSelect: (messageId: string) => void
  selectMode: boolean
  selected: boolean
  onToggleSelect: (messageId: string) => void
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  currentUserId,
  other,
  highlight,
  onReaction,
  onOpenMenu,
  onEnterSelect,
  selectMode,
  selected,
  onToggleSelect,
}: MessageBubbleProps) {
  const reactionGroups = summarizeReactions(message.reactions, currentUserId)
  const pressTimer = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const isDeleted = Boolean(message.is_deleted)

  const clearPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || e.pointerType === 'mouse' || selectMode) return
    clearPress()
    suppressClickRef.current = false
    pressTimer.current = window.setTimeout(() => {
      suppressClickRef.current = true
      onEnterSelect(message.id)
    }, 500)
  }

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (selectMode) onToggleSelect(message.id)
  }

  const openMenuAt = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onOpenMenu(message, { x: rect.right - 8, y: rect.top })
  }

  const renderContent = () => {
    if (isDeleted) {
      return (
        <span className="flex items-center gap-1.5 italic opacity-80">
          <Trash2 className="h-3.5 w-3.5" />
          This message was deleted
        </span>
      )
    }
    switch (message.type) {
      case 'image':
        return <ImageMessage url={message.file_url ?? ''} alt={message.content} />
      case 'file':
        return (
          <FileMessage
            url={message.file_url ?? ''}
            name={message.file_name}
            size={message.file_size}
          />
        )
      case 'voice':
        return <VoiceMessage url={message.file_url ?? ''} />
      default:
        return (
          <span className="whitespace-pre-wrap break-words">
            {highlight && message.content ? highlightText(message.content, highlight) : message.content}
          </span>
        )
    }
  }

  const replySender = message.reply_to?.sender?.full_name ?? 'Message'
  const replyPreview = message.reply_to
    ? message.reply_to.is_deleted
      ? 'This message was deleted'
      : messagePreview(message.reply_to)
    : ''

  return (
    <div
      className={`group flex w-full ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-3' : 'mt-1'}`}
    >
      {selectMode && !isOwn && (
        <button
          type="button"
          onClick={() => onToggleSelect(message.id)}
          aria-label={selected ? 'Deselect' : 'Select'}
          className={`mr-1 mt-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
            selected
              ? 'border-primary bg-primary text-white'
              : 'border-gray-300 bg-white text-transparent dark:border-dark-300 dark:bg-dark-200'
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}

      {!isOwn && (
        <div
          className={`flex-shrink-0 transition-opacity ${showAvatar ? 'opacity-100' : 'opacity-0'}`}
        >
          <Avatar src={other?.avatar_url} name={other?.full_name} size="sm" />
        </div>
      )}

      <div
        className={`flex min-w-0 flex-col ${isOwn ? 'items-end' : 'items-start'} ${isOwn ? 'ml-8' : 'ml-2'} ${isOwn ? 'mr-2' : 'mr-8'}`}
      >
        {!isOwn && showAvatar && (
          <span className="mb-0.5 ml-2 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            {other?.full_name ?? 'Unknown user'}
          </span>
        )}

        <div
          onContextMenu={(e) => {
            if (selectMode) return
            e.preventDefault()
            onOpenMenu(message, { x: e.clientX, y: e.clientY })
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={clearPress}
          onPointerLeave={clearPress}
          onPointerCancel={clearPress}
          onClick={handleClick}
          className={`relative max-w-full select-text rounded-2xl px-3 py-2 text-sm shadow-sm ${
            isOwn
              ? 'rounded-br-md bg-primary text-white'
              : 'rounded-bl-md border border-gray-200 bg-white text-gray-800 dark:border-dark-300 dark:bg-dark-300 dark:text-gray-100'
          } ${selectMode ? 'cursor-pointer' : ''}`}
        >
          {!selectMode && (
            <button
              type="button"
              onClick={openMenuAt}
              aria-label="Message actions"
              className={`absolute right-1 top-1 rounded-md p-0.5 transition-opacity ${
                isOwn
                  ? 'text-white/80 hover:bg-white/15'
                  : 'text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-200'
              } md:opacity-0 md:group-hover:opacity-100`}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          )}

          {message.is_forwarded && !isDeleted && (
            <p
              className={`mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${
                isOwn ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <CornerUpRight className="h-3 w-3" />
              Forwarded
            </p>
          )}

          {message.reply_to && !isDeleted && (
            <div
              className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-left ${
                isOwn ? 'border-white/50 bg-black/10 dark:bg-black/25' : 'border-accent bg-gray-100 dark:bg-dark-200'
              }`}
            >
              <p className={`text-[11px] font-bold ${isOwn ? 'text-white/90' : 'text-accent'}`}>
                {replySender}
              </p>
              <p
                className={`truncate text-xs ${
                  isOwn ? 'text-white/80' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {replyPreview}
              </p>
            </div>
          )}

          {renderContent()}
        </div>

        <div className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-gray-400 dark:text-gray-500">
          <span>{formatTime(message.created_at)}</span>
          {message.edited_at && <span>edited</span>}
          {isOwn && !isDeleted && message.type === 'text' && message.content && (
            message.is_read ? (
              <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )
          )}
        </div>

        {!selectMode && (reactionGroups.length > 0 || !isOwn) && (
          <div className="mt-0.5 flex max-w-full flex-wrap items-center gap-1">
            {reactionGroups.map((group) => (
              <button
                key={group.emoji}
                type="button"
                onClick={() => onReaction(message.id, group.emoji)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  group.mine
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-dark-300 dark:bg-dark-200 dark:hover:bg-dark-300'
                }`}
              >
                <span>{group.emoji}</span>
                <span className="tabular-nums">{group.count}</span>
              </button>
            ))}
            {QUICK_EMOJIS.filter((emoji) => !reactionGroups.some((g) => g.emoji === emoji)).map(
              (emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReaction(message.id, emoji)}
                  aria-label={`React with ${emoji}`}
                  className="rounded-full px-1 text-sm opacity-100 transition-all hover:scale-125 md:opacity-0 md:group-hover:opacity-100"
                >
                  {emoji}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {selectMode && isOwn && (
        <button
          type="button"
          onClick={() => onToggleSelect(message.id)}
          aria-label={selected ? 'Deselect' : 'Select'}
          className={`ml-1 mt-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
            selected
              ? 'border-primary bg-primary text-white'
              : 'border-gray-300 bg-white text-transparent dark:border-dark-300 dark:bg-dark-200'
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
