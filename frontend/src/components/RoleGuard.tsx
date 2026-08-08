import { Navigate } from 'react-router-dom'
import { useSession } from '../context/AuthContext'
import { hasPermission, canAccess } from '../lib/permissions'
import type { Permission } from '../lib/permissions'
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

/** Permission-based guard — the route renders only when the profile holds the permission. */
export function RequirePermission({
  permission,
  children,
  redirectTo = '/dashboard',
}: {
  permission: Permission
  children: ReactNode
  redirectTo?: string
}) {
  const { profile, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/30 border-t-primary" />
      </div>
    )
  }

  if (!hasPermission(profile, permission)) {
    return <Navigate to={redirectTo} replace />
  }
  return <>{children}</>
}

/** Path-based guard backed by the central permission map (used by the layout). */
export function GuardedOutlet() {
  const { profile, loading } = useSession()
  const path = window.location.pathname

  if (loading) return null

  if (!canAccess(profile, path)) {
    return <Navigate to="/403" replace />
  }
  return null
}
