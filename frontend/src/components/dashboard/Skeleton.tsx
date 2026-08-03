interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gray-200 dark:bg-dark-200 ${className ?? ''}`}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 p-6 dark:border-dark-300">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-4 h-7 w-16" />
      <Skeleton className="mt-2 h-4 w-24" />
    </div>
  )
}

export function StartupCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 p-6 dark:border-dark-300">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <Skeleton className="mt-5 h-10 w-full rounded-lg" />
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100 ${className ?? ''}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="mt-4 h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-4/5" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100 ${className ?? ''}`}>
      <Skeleton className="h-12 w-12 flex-shrink-0 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-2 h-3 w-2/3" />
      </div>
      <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
    </div>
  )
}

export function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={`h-3 rounded ${className ?? ''}`} />
}
