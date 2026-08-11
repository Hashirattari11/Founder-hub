import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import {
  FileText,
  Mic,
  Paperclip,
  PencilLine,
  SendHorizonal,
  Smile,
  X,
} from 'lucide-react'
import {
  editChatMessage,
  emitTyping,
  messagePreview,
  sendChatMessage,
  stopTyping,
  uploadChatAttachment,
  uploadVoiceNote,
} from '../../lib/chat'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import { friendlyDbError } from '../../lib/helpers'
import type { ChatMessage } from '../../types'

const EMOJI_LIST = [
  '😀', '😄', '😂', '😅', '😊', '😍', '🥰', '😘', '😎', '🤔',
  '😴', '🥳', '😢', '😭', '🙏', '🙌', '👏', '💪', '👍', '👎',
  '❤️', '🔥', '🎉', '✨', '🚀', '💯', '⭐', '✅', '🎯', '💡',
  '👀', '🤝', '🤯', '🙃', '🤑', '📈',
]

interface ChatInputProps {
  chatId: string
  userId: string
  disabled?: boolean
  replyTo?: ChatMessage | null
  editing?: ChatMessage | null
  onCancelReply: () => void
  onCancelEdit: () => void
  onMessageSent: (msg: ChatMessage) => void
}

export function ChatInput({
  chatId,
  userId,
  disabled,
  replyTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onMessageSent,
}: ChatInputProps) {
  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const typingTimerRef = useRef<number | null>(null)
  const typingActiveRef = useRef(false)
  const voiceRecorder = useVoiceRecorder()

  useEffect(() => {
    return () => {
      stopTyping(chatId, userId).catch(() => {})
    }
  }, [chatId, userId])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }, [text])

  useEffect(() => {
    if (editing) {
      setText(editing.content ?? '')
      textareaRef.current?.focus()
    }
  }, [editing])

  const handleTyping = () => {
    if (!typingActiveRef.current) {
      typingActiveRef.current = true
      emitTyping(chatId, userId).catch(() => {})
    }
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
    typingTimerRef.current = window.setTimeout(() => {
      typingActiveRef.current = false
      stopTyping(chatId, userId).catch(() => {})
    }, 2000)
  }

  const resetTyping = () => {
    typingActiveRef.current = false
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
    stopTyping(chatId, userId).catch(() => {})
  }

  const handleFilePick = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setAttachments((prev) => {
      const next = [...prev, ...Array.from(files)]
      return next.slice(0, 6)
    })
  }

  const handleSend = async () => {
    if (sending || disabled) return

    if (editing) {
      const content = text.trim()
      if (!content) return
      setSending(true)
      try {
        await editChatMessage(editing.id, content)
        setText('')
        onCancelEdit()
        resetTyping()
      } catch (err) {
        toast.error(friendlyDbError(err).message)
      } finally {
        setSending(false)
      }
      return
    }

    const replyToId = replyTo?.id ?? null

    if (attachments.length > 0) {
      setSending(true)
      try {
        for (const file of attachments) {
          const { url, size, name } = await uploadChatAttachment(userId, file)
          const isImage = file.type.startsWith('image/')
          const msg = await sendChatMessage({
            chatId,
            senderId: userId,
            content: isImage ? text.trim() || 'Photo' : text.trim() || name,
            type: isImage ? 'image' : 'file',
            fileUrl: url,
            fileName: name,
            fileSize: size,
            replyToId,
          })
          onMessageSent(msg)
        }
        setAttachments([])
        setText('')
        if (replyTo) onCancelReply()
        resetTyping()
      } catch (err) {
        toast.error(friendlyDbError(err).message)
      } finally {
        setSending(false)
      }
      return
    }

    const content = text.trim()
    if (!content) return
    setSending(true)
    try {
      const msg = await sendChatMessage({ chatId, senderId: userId, content, replyToId })
      onMessageSent(msg)
      setText('')
      if (replyTo) onCancelReply()
      resetTyping()
    } catch (err) {
      toast.error(friendlyDbError(err).message)
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (voiceRecorder.blob && !voiceRecorder.recording) {
      void (async () => {
        try {
          const { url, size } = await uploadVoiceNote(userId, voiceRecorder.blob as Blob)
          const msg = await sendChatMessage({
            chatId,
            senderId: userId,
            content: 'Voice message',
            type: 'voice',
            fileUrl: url,
            fileName: 'voice-note.webm',
            fileSize: size,
            replyToId: replyTo?.id ?? null,
          })
          onMessageSent(msg)
          if (replyTo) onCancelReply()
        } catch (err) {
          toast.error(friendlyDbError(err).message)
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceRecorder.blob, voiceRecorder.recording, chatId, userId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const disabledInput = disabled || sending

  const replyName =
    replyTo && replyTo.sender_id === userId
      ? 'yourself'
      : (replyTo?.sender?.full_name?.split(' ')[0] ?? '')

  return (
    <div className="border-t border-gray-200 px-3 py-3 dark:border-dark-300">
      {/* Reply / edit preview bar */}
      {(replyTo || editing) && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 dark:bg-dark-300">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              {editing ? (
                <>
                  <PencilLine className="h-3.5 w-3.5" />
                  Editing message
                </>
              ) : (
                <>Replying to {replyName || 'message'}</>
              )}
            </p>
            <p className="truncate text-xs text-gray-600 dark:text-gray-300">
              {editing ? (editing.content ?? '') : (replyTo ? messagePreview(replyTo) : '')}
            </p>
          </div>
          <button
            type="button"
            onClick={editing ? onCancelEdit : onCancelReply}
            aria-label={editing ? 'Cancel edit' : 'Cancel reply'}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-dark-200 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((file, i) => (
            <span
              key={`${file.name}-${i}`}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-dark-300 dark:bg-dark-200"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove attachment"
                className="text-gray-400 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Voice recording banner */}
      {voiceRecorder.recording && (
        <div className="mb-2 flex items-center justify-between rounded-xl bg-red-500/10 px-3 py-2">
          <span className="flex items-center gap-2 text-sm font-medium text-red-500">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            Recording {voiceRecorder.formatDuration(voiceRecorder.duration)}
          </span>
          <button
            type="button"
            onClick={voiceRecorder.cancel}
            className="text-xs font-semibold text-gray-500 hover:text-red-500"
          >
            Cancel
          </button>
        </div>
      )}
      {voiceRecorder.error && (
        <p className="mb-2 text-xs text-red-500">{voiceRecorder.error}</p>
      )}

      <div className="flex items-end gap-1.5">
        <button
          type="button"
          onClick={() => setEmojiOpen((v) => !v)}
          disabled={disabledInput}
          aria-label="Emoji"
          className={`rounded-xl p-2.5 transition-colors ${emojiOpen ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-300'}`}
        >
          <Smile className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabledInput}
          aria-label="Attach a file"
          className="rounded-xl p-2.5 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-dark-300"
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileRef}
          name="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilePick(e.target.files)
            e.target.value = ''
          }}
        />

        <textarea
          ref={textareaRef}
          name="message"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            handleTyping()
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={editing ? 'Edit message...' : 'Type a message...'}
          disabled={disabledInput}
          className="max-h-[120px] flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60 dark:border-dark-300 dark:bg-dark dark:text-gray-100"
        />

        {text.trim() || attachments.length > 0 ? (
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={disabledInput}
            aria-label="Send message"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-transform hover:scale-105 disabled:opacity-60"
          >
            {editing ? <PencilLine className="h-5 w-5" /> : <SendHorizonal className="h-5 w-5" />}
          </button>
        ) : (
          <button
            type="button"
            aria-label="Record a voice note (hold)"
            disabled={disabledInput}
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-colors ${
              voiceRecorder.recording
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-dark-300 dark:text-gray-300 dark:hover:bg-dark-300'
            }`}
            onPointerDown={(e) => {
              e.preventDefault()
              if (disabledInput) return
              void voiceRecorder.start()
            }}
            onPointerUp={() => {
              if (voiceRecorder.recording) voiceRecorder.stop()
            }}
            onPointerLeave={() => {
              if (voiceRecorder.recording) voiceRecorder.stop()
            }}
            onPointerCancel={() => voiceRecorder.cancel()}
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Emoji picker */}
      {emojiOpen && (
        <div className="mt-2 grid max-h-48 grid-cols-9 gap-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 dark:border-dark-300 dark:bg-dark-200">
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                setText((prev) => prev + emoji)
                textareaRef.current?.focus()
                handleTyping()
              }}
              className="rounded-lg p-1 text-lg transition-colors hover:bg-gray-100 dark:hover:bg-dark-300"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
