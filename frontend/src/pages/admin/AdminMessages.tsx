import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import toast from 'react-hot-toast'
import { RefreshCw, Search, X } from 'lucide-react'
import { adminListMessages } from '../../api/admin'
import type { AdminMessageItem } from '../../types/admin'
import {
  Badge,
  EmptyRow,
  formatDateTime,
  LoadingBlock,
  PageHeader,
  TableHead,
  TableShell,
} from './adminUi'

export default function AdminMessages() {
  const [messages, setMessages] = useState<AdminMessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminListMessages({ search: query || undefined })
      setMessages(res.messages)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Recent message metadata across the platform (sender, receiver, read state)."
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQuery(search.trim())
            }}
            placeholder="Search message content..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark-100 dark:text-gray-100"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('')
                setQuery('')
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setQuery(search.trim())}
          className="rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20"
        >
          Search
        </button>
      </div>

      {loading ? (
        <LoadingBlock label="Loading messages..." />
      ) : (
        <TableShell>
          <TableHead cells={['From', 'To', 'Content', 'Type', 'Read', 'Sent']} />
          <tbody>
            {messages.length === 0 ? (
              <EmptyRow colSpan={6} message="No messages" />
            ) : (
              messages.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0 dark:border-dark-300">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                    {m.sender_name ?? m.sender_id ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                    {m.receiver_name ?? m.receiver_id ?? '—'}
                  </td>
                  <td className="max-w-[320px] px-4 py-3">
                    <p className="truncate text-xs text-gray-500 dark:text-gray-300">
                      {m.is_deleted ? <span className="italic text-gray-400">deleted</span> : (m.content || '')}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={m.type === 'text' ? 'gray' : 'blue'}>{(m.type ?? 'text').replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {m.is_deleted ? (
                      <Badge tone="red">deleted</Badge>
                    ) : m.is_read ? (
                      <Badge tone="green">read</Badge>
                    ) : (
                      <Badge tone="amber">unread</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatDateTime(m.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      )}
    </div>
  )
}
