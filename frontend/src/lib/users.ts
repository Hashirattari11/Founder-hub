import { supabase } from './supabase'
import type { Profile } from '../types'

/** Canonical discoverable user — profiles.id === auth.users.id */
export interface DiscoverableUser {
  userId: string
  profileId: string
  fullName: string | null
  username: string | null
  avatarUrl: string | null
  role: Profile['role']
  bio: string | null
}

function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Human-readable label; never returns "Unknown User" for a valid profile row. */
export function profileDisplayName(
  p:
    | Pick<Profile, 'full_name' | 'username'>
    | Pick<DiscoverableUser, 'fullName' | 'username'>,
): string {
  const fullName = 'fullName' in p ? p.fullName : p.full_name
  const username = p.username
  if (fullName?.trim()) return fullName.trim()
  if (username?.trim()) return `@${username.replace(/^@/, '')}`
  return 'Member'
}

export function discoverableToProfile(u: DiscoverableUser): Profile {
  return {
    id: u.userId,
    full_name: u.fullName,
    username: u.username,
    avatar_url: u.avatarUrl,
    role: u.role,
    bio: u.bio,
  } as Profile
}

/**
 * Central user discovery for messaging, people search, and profile pickers.
 * Identity is always profiles.id (same as auth.users.id).
 */
export async function discoverUsers(opts: {
  query?: string
  excludeUserId?: string
  role?: Profile['role']
  limit?: number
  /** When true (default), only onboarded users with a username appear. */
  onboardedOnly?: boolean
}): Promise<DiscoverableUser[]> {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 60)
  const select = 'id, full_name, username, avatar_url, role, bio'

  let builder = supabase.from('profiles').select(select)
  if (opts.excludeUserId) builder = builder.neq('id', opts.excludeUserId)
  if (opts.role) builder = builder.eq('role', opts.role.toLowerCase())
  if (opts.onboardedOnly !== false) builder = builder.not('username', 'is', null)

  const q = opts.query?.trim()
  const safe = q ? escapeIlike(q.replace(/[%,.]/g, ' ').trim()) : ''

  if (safe) {
    builder = builder.or(`full_name.ilike.%${safe}%,username.ilike.%${safe}%`)
  } else {
    builder = builder.not('full_name', 'is', null)
  }

  const { data, error } = await builder.order('full_name', { ascending: true }).limit(limit)
  if (error) throw error

  const rows = (data ?? []).map((row) => ({
    userId: row.id as string,
    profileId: row.id as string,
    fullName: row.full_name as string | null,
    username: row.username as string | null,
    avatarUrl: row.avatar_url as string | null,
    role: row.role as Profile['role'],
    bio: row.bio as string | null,
  }))

  if (import.meta.env.DEV && safe) {
    console.debug('[discoverUsers]', safe, rows.map((r) => ({ id: r.userId, name: profileDisplayName(r) })))
  }

  return rows
}

export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data as Profile | null) ?? null
}
