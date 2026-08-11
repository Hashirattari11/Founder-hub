import { supabase } from './supabase'

/**
 * Derive a base username from a full name, e.g. "Jane Doe" -> "jane.doe".
 * Falls back to "user" + 3 random digits when nothing usable remains.
 */
export function suggestUsername(fullName: string): string {
  const normalized = fullName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20)
  if (!normalized) return `user${Math.floor(100 + Math.random() * 900)}`
  return normalized
}

/**
 * Check whether a username is already taken. Fails open (returns true when the
 * check itself errors) so the user is never hard-blocked by a DB hiccup.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .maybeSingle()
    return !data
  } catch (err) {
    console.warn('isUsernameAvailable failed, assuming available:', err)
    return true
  }
}

/**
 * Suggest a free username for a full name: try the clean version, then append
 * 1..99, e.g. jane.doe -> jane.doe1 -> jane.doe2 ...
 */
export async function findAvailableUsername(fullName: string): Promise<string> {
  const base = suggestUsername(fullName)
  let candidate = base
  for (let i = 0; i < 100; i++) {
    if (await isUsernameAvailable(candidate)) return candidate
    candidate = i === 0 ? `${base}${i + 1}` : `${base.slice(0, 16)}${i + 1}`
  }
  return `user${Date.now() % 100000}`
}
