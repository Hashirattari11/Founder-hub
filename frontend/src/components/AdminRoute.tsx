import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useSession } from '../context/AuthContext'
import { isAdminProfile } from '../lib/admin'

interface AdminRouteProps {
  children: ReactNode
}

/** Blocks non-admin users from /admin/* routes. */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, profile, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-dark">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isAdminProfile(profile)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
