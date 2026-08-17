import { Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import type { ReactNode } from 'react'
import { useSession } from '../context/AuthContext'
import { isAdminProfile } from '../lib/admin'

/** Redirect authenticated users away from login/register pages. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-dark">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    )
  }

  if (user) {
    const dest = isAdminProfile(profile) ? '/admin/dashboard' : '/dashboard'
    return <Navigate to={dest} replace />
  }

  // Login / register / password pages should not appear in search results.
  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {children}
    </>
  )
}
