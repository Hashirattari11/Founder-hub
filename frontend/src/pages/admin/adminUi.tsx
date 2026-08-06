import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100 ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  icon,
  color = 'text-primary',
  sub,
}: {
  label: string
  value: ReactNode
  icon?: ReactNode
  color?: string
  sub?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {icon && <span className={color}>{icon}</span>}
        {label}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </Card>
  )
}

export type BadgeTone = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'primary' | 'purple'

const TONE_CLASSES: Record<BadgeTone, string> = {
  green: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  gray: 'bg-gray-100 text-gray-600 dark:bg-dark-300 dark:text-gray-400',
  primary: 'bg-primary/10 text-primary',
}

export function Badge({ tone = 'gray', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}

export function statusTone(status: string): BadgeTone {
  const s = status.toLowerCase()
  if (['success', 'active', 'approved', 'resolved', 'open', 'ok', 'published', 'verified'].includes(s)) {
    if (s === 'open') return 'blue'
    return 'green'
  }
  if (['failed', 'rejected', 'banned', 'suspended', 'error', 'canceled', 'cancelled', 'past_due', 'dismissed', 'archived', 'degraded'].includes(s)) {
    return 'red'
  }
  if (['pending', 'draft', 'trialing', 'expired', 'under_review', 'reviewing'].includes(s)) {
    return 'amber'
  }
  return 'gray'
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">{children}</table>
      </div>
    </Card>
  )
}

export function TableHead({ cells }: { cells: (string | ReactNode)[] }) {
  return (
    <thead>
      <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400 dark:border-dark-300">
        {cells.map((c, i) => (
          <th key={i} className="px-4 py-3 font-semibold">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  )
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-gray-400">
        {message}
      </td>
    </tr>
  )
}

export function LoadingBlock({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/30 dark:bg-red-500/10">
      <p className="font-semibold text-red-600 dark:text-red-400">{message}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        This area is restricted to platform administrators.
      </p>
    </div>
  )
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

export function formatMoney(cents: number | null | undefined, currency = 'usd') {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency ?? 'usd').toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function formatDuration(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0 || parts.length === 0) parts.push(`${m}m`)
  return parts.join(' ')
}
