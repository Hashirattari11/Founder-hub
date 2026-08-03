import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AnimatePresence, motion } from 'framer-motion'
import { CornerUpRight, Loader2, Search, X } from 'lucide-react'
import { Avatar } from '../Avatar'
import { ROLE_LABELS } from '../../types'
import type { Profile, Role } from '../../types'
import { searchUsers } from '../../lib/chat'

interface ForwardModalProps {
  open: boolean
  currentUserId: string
  count: number
  onForwardTo: (receiverId: string) => Promise<void>
  onClose: () => void
}

export function ForwardModal({
  open,
  currentUserId,
  count,
  onForwardTo,
  onClose,
}: ForwardModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [forwarding, setForwarding] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const users = await searchUsers(query, currentUserId)
        if (active) setResults(users)
      } catch {
        if (active) setResults([])
      } finally {
        if (active) setLoading(false)
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [open, query, currentUserId])

  const handlePick = async (profile: Profile) => {
    if (forwarding) return
    setForwarding(profile.id)
    try {
      await onForwardTo(profile.id)
      toast.success(`Forwarded to ${profile.full_name ?? 'user'}`)
      onClose()
    } catch {
      toast.error('Could not forward the message')
    } finally {
      setForwarding(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50"
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'tween', duration: 0.18 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-dark-300 dark:bg-dark-100"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-dark-300">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <CornerUpRight className="h-4 w-4 text-primary" />
                Forward{count > 1 ? ` ${count} messages` : ' message'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-dark-200 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people by name or username..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto px-2 pb-2">
              {loading ? (
                <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </p>
              ) : results.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">
                  {query ? 'No matching users found' : 'Type to search for people'}
                </p>
              ) : (
                results.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={forwarding === profile.id}
                    onClick={() => handlePick(profile)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-100 disabled:opacity-60 dark:hover:bg-dark-200"
                  >
                    <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {profile.full_name ?? 'Unknown user'}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        @{profile.username ?? 'user'}
                        {profile.role ? ` · ${ROLE_LABELS[profile.role.toLowerCase() as Role]}` : ''}
                      </p>
                    </div>
                    {forwarding === profile.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
