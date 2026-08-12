import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'
import { hasUserConsent } from './consent'
import type { Profile } from '../types'

export interface ProfileUpdate {
  full_name?: string | null
  username?: string | null
  avatar_url?: string | null
  bio?: string | null
  role?: Profile['role']
  skills?: string[] | null
  investor_interests?: string[] | null
  country?: string | null
  city?: string | null
  experience_years?: number | null
  linkedin_url?: string | null
  github_url?: string | null
  portfolio_url?: string | null
  twitter_url?: string | null
  is_open_to_work?: boolean | null
  investment_range_min?: number | null
  investment_range_max?: number | null
  investment_stage?: string[] | null
  portfolio_companies?: string[] | null
  notification_preferences?: Record<string, boolean> | null
  preferred_ai_provider?: string | null
  preferred_ai_model?: string | null
}

export async function getProfileByUsername(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return (data as Profile | null) ?? null
}

export async function trackProfileView(profileId: string, viewerId: string | null): Promise<void> {
  if (!profileId || !viewerId) return
  try {
    await supabase.from('profile_views').insert({ profile_id: profileId, viewer_id: viewerId })
  } catch {
    // Non-critical tracking — ignore failures.
  }
}

export interface PeopleSearchResult {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  role: Profile['role']
  skills: string[] | null
  city: string | null
  country: string | null
  is_open_to_work: boolean | null
  created_at: string | null
}

/** Escape `%`, `_`, and `\` for PostgREST ilike patterns. */
function escapeIlike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** Browse people by role (Investor / Developer / Marketer / Designer). */
export async function searchProfilesByRole(role: Profile['role'], opts?: { query?: string; excludeUserId?: string }): Promise<PeopleSearchResult[]> {
  const select =
    'id, full_name, username, avatar_url, bio, role, skills, city, country, is_open_to_work, created_at'

  let builder = supabase.from('profiles').select(select).eq('role', role)
  if (opts?.excludeUserId) builder = builder.neq('id', opts.excludeUserId)
  // Only list onboarded members (username set) for consistent discovery.
  builder = builder.not('username', 'is', null)

  const q = opts?.query?.trim()
  const safe = q ? escapeIlike(q.replace(/[%,.]/g, ' ').trim()) : ''

  if (safe) {
    builder = builder.or(`full_name.ilike.%${safe}%,username.ilike.%${safe}%`)
  }

  builder = builder.order('created_at', { ascending: false }).limit(safe ? 120 : 60)
  const { data, error } = await builder
  if (error) throw error

  let results = (data as PeopleSearchResult[]) ?? []

  // Skills live in a text[] column — PostgREST array filters require exact
  // element matches and break on spaces/special chars. Match client-side instead.
  if (safe) {
    const needle = safe.toLowerCase()
    const textIds = new Set(results.map((p) => p.id))

    let skillPool = supabase.from('profiles').select(select).eq('role', role)
    if (opts?.excludeUserId) skillPool = skillPool.neq('id', opts.excludeUserId)
    const { data: pool, error: poolError } = await skillPool
      .order('created_at', { ascending: false })
      .limit(120)
    if (poolError) throw poolError

    for (const p of (pool as PeopleSearchResult[]) ?? []) {
      if (textIds.has(p.id)) continue
      if ((p.skills ?? []).some((s) => s.toLowerCase().includes(needle))) {
        results.push(p)
        textIds.add(p.id)
      }
    }
  }

  return results.slice(0, 60)
}

async function assertOwnProfile(userId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user?.id || session.user.id !== userId) {
    throw new Error("You don't have access to this.")
  }
  return session.user.id
}

export async function updateProfile(userId: string, updates: ProfileUpdate) {
  await assertOwnProfile(userId)

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data as Profile
}

/** Create or update the signed-in user's profile (onboarding / complete-profile). */
export async function saveOwnProfile(userId: string, updates: ProfileUpdate) {
  await assertOwnProfile(userId)

  if (updates.username) {
    const consented = await hasUserConsent(userId)
    if (!consented) {
      throw new Error('Please accept the Terms of Service and Privacy Policy to create your account.')
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates })
    .select('*')
    .single()
  if (error) throw error
  return data as Profile
}

export async function isUsernameAvailable(username: string, excludeUserId?: string) {
  if (!username) return false
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  return !data || data.id === excludeUserId
}

const AVATAR_BUCKET = 'avatars'

export function getAvatarPublicUrl(path: string) {
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function uploadAvatar(userId: string, file: File) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 512,
    useWebWorker: true,
  })

  const ext = (compressed.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  const path = `${userId}/avatar-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, compressed, {
    cacheControl: '3600',
    upsert: true,
    contentType: compressed.type,
  })
  if (error) throw error

  return getAvatarPublicUrl(path)
}

export async function saveAvatar(userId: string, file: File) {
  const avatarUrl = await uploadAvatar(userId, file)
  const profile = await updateProfile(userId, { avatar_url: avatarUrl })
  return { avatarUrl, profile }
}
