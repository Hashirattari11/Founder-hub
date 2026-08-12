import { supabase } from './supabase'

export const TERMS_VERSION = '1.0'
export const PRIVACY_VERSION = '1.0'

export interface UserConsent {
  user_id: string
  terms_accepted: boolean
  privacy_accepted: boolean
  accepted_at: string | null
  terms_version: string
  privacy_version: string
}

export async function hasUserConsent(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_consents')
    .select('terms_accepted, privacy_accepted')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return false
  return Boolean(data?.terms_accepted && data?.privacy_accepted)
}

export async function recordUserConsent(userId: string): Promise<void> {
  const { error } = await supabase.from('user_consents').upsert(
    {
      user_id: userId,
      terms_accepted: true,
      privacy_accepted: true,
      accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}
