import type { Profile } from '@/types'

export function isAdminProfile(profile: Profile | null | undefined): boolean {
  if (!profile) return false
  if (profile.is_admin === true) return true
  const role = (profile.role ?? '').toLowerCase()
  return role === 'administrator' || role === 'admin'
}

export function isSuperAdminProfile(profile: Profile | null | undefined): boolean {
  return !!profile?.is_super_admin
}
