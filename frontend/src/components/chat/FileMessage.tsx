import { Download, FileText } from 'lucide-react'
import { formatFileSize } from '../../lib/helpers'

export function FileMessage({
  url,
  name,
  size,
}: {
  url: string
  name?: string | null
  size?: number | null
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-xl border border-black/5 bg-white/70 p-2.5 pr-3 transition-colors hover:bg-white dark:border-white/10 dark:bg-black/20 dark:hover:bg-black/30"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block max-w-[220px] truncate text-sm font-medium">
          {name ?? 'Attachment'}
        </span>
        {size ? (
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {formatFileSize(size)}
          </span>
        ) : null}
      </span>
      <Download className="h-4 w-4 flex-shrink-0 text-gray-400" />
    </a>
  )
}
