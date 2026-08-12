import { CircleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

interface ErrorMessageProps {
  title?: string
  message: string
  onRetry?: () => void
  backHref?: string
  backLabel?: string
  className?: string
}

export function ErrorMessage({
  title = 'Something went wrong',
  message,
  onRetry,
  backHref = '/',
  backLabel = 'Go back',
  className = '',
}: ErrorMessageProps) {
  return (
    <div
      className={`flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-500/30 dark:bg-red-500/10 ${className}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
        <CircleAlert className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{message}</p>
      <div className="mt-6 flex w-full flex-col gap-3">
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-primary w-full">
            Try Again
          </button>
        )}
        <Link to={backHref} className={onRetry ? 'btn-ghost w-full' : 'btn-primary w-full'}>
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
