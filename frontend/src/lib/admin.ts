import type { Profile } from '../types'

/** True when a profile is a platform admin (admin flag or administrator role). */
export function isAdminProfile(profile: Pick<Profile, 'is_admin' | 'role'> | null | undefined): boolean {
  if (!profile) return false
  if (profile.is_admin) return true
  const role = profile.role?.toLowerCase()
  return role === 'administrator' || role === 'admin'
}

/** True when the user is a super admin (only the env-bootstrapped account). */
export function isSuperAdminProfile(profile: Pick<Profile, 'is_admin' | 'role' | 'is_super_admin'> | null | undefined): boolean {
  if (!profile) return false
  return Boolean(profile.is_super_admin)
}
