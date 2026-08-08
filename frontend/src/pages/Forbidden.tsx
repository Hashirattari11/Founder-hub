import { Link } from 'react-router-dom'
import { ShieldX, ArrowLeft, Home } from 'lucide-react'

export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center dark:bg-dark">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
        <ShieldX className="h-8 w-8 text-red-500" />
      </div>
      <h1 className="mt-6 text-3xl font-extrabold">Access denied</h1>
      <p className="mt-2 max-w-md text-gray-500">
        This section is only available for your current role. If you think this
        is a mistake, request a role change or contact an administrator.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300"
        >
          <Home className="h-4 w-4" />
          Go Home
        </Link>
      </div>
    </div>
  )
}
