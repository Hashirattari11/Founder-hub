import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  trend?: string
  trendUp?: boolean
}

export function StatCard({ icon: Icon, label, value, trend, trendUp }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        {trend && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              trendUp
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'bg-red-500/15 text-red-500'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <p className="mt-4 text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{label}</p>
    </div>
  )
}
