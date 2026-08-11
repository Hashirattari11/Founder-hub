import type { ReactNode } from 'react'
import { useSession } from '../context/AuthContext'
import {
  calculateProfileCompletion,
  isProfileComplete,
} from '../lib/profileCompletion'
import ProfileGate from './ProfileGate'

interface ProfileGateRouteProps {
  children: ReactNode
}

/**
 * Wraps a route (inside ProtectedRoute) and blocks it until the profile
 * completion score reaches the threshold. Existing users are scored from their
 * current data, so established accounts pass automatically.
 */
export default function ProfileGateRoute({ children }: ProfileGateRouteProps) {
  const { profile } = useSession()

  // No profile yet — let the parent ProtectedRoute / loader handle it.
  if (!profile) return null

  const completion = calculateProfileCompletion(profile)
  if (!isProfileComplete(completion)) {
    return <ProfileGate completion={completion} />
  }

  return <>{children}</>
}
