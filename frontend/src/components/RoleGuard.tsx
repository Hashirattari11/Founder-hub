import { Navigate } from 'react-router-dom'
import { useSession } from '../context/AuthContext'
import type { ReactNode } from 'react'
import type { Role } from '../types'

interface RoleGuardProps {
  children: ReactNode
  roles: Role[]
  redirectTo?: string
}

/** Redirects users who don't have one of the allowed roles. */
export function RoleGuard({ children, roles, redirectTo = '/dashboard' }: RoleGuardProps) {
  const { profile, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    )
  }

  const role = (profile?.role?.toLowerCase() ?? '') as Role
  if (!roles.includes(role)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}

/** Founder-only route guard. */
export function FounderGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard roles={['founder']} redirectTo="/dashboard">
      {children}
    </RoleGuard>
  )
}

/** Investor-only route guard. */
export function InvestorGuard({ children }: { children: ReactNode }) {
  return (
    <RoleGuard roles={['investor']} redirectTo="/dashboard">
      {children}
    </RoleGuard>
  )
}
