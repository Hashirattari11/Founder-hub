import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'
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

export async function updateProfile(userId: string, updates: ProfileUpdate) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
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
