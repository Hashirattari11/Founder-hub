import type { Profile } from '../types'

export interface CompletionArea {
  label: string
  done: boolean
}

export interface ProfileCompletion {
  percent: number
  missing: string[]
  areas: CompletionArea[]
}

export const PROFILE_COMPLETION_THRESHOLD = 80

/** Non-empty check that tolerates arrays and comma-separated strings. */
function hasValue(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'number') return true
  if (typeof value === 'boolean') return true
  return false
}

function hasAny(profile: Partial<Profile>, keys: (keyof Profile)[]): boolean {
  return keys.some((key) => hasValue(profile[key]))
}

function listCount(profile: Partial<Profile>, key: keyof Profile, min: number): boolean {
  const value = profile[key]
  if (Array.isArray(value)) return value.length >= min
  if (typeof value === 'string') return value.split(',').filter(Boolean).length >= min
  return false
}

/**
 * Weighted profile-completion score (out of 100). Existing users are scored
 * from their current data, so someone with name + username + role + bio +
 * skills + links passes the 80% gate without touching onboarding.
 */
export function calculateProfileCompletion(profile: Partial<Profile>): ProfileCompletion {
  const p = profile as Partial<Profile>
  const areas: CompletionArea[] = [
    { label: 'Add your full name', done: hasValue(p.full_name) },
    { label: 'Choose a username', done: hasValue(p.username) },
    { label: 'Pick your role', done: hasValue(p.role) },
    { label: 'Add a bio', done: hasValue(p.bio) },
    { label: 'Upload a profile photo', done: hasValue(p.avatar_url) },
    { label: 'Add at least 3 skills', done: listCount(p, 'skills', 3) },
    { label: 'Add your location', done: hasAny(p, ['country', 'city']) },
    { label: 'Add years of experience', done: hasValue(p.experience_years) },
    { label: 'Link a social profile', done: hasAny(p, ['linkedin_url', 'github_url', 'portfolio_url', 'twitter_url']) },
    {
      label: p.role === 'investor' ? 'Add your investing interests' : 'Set your availability',
      done:
        p.role === 'investor'
          ? hasValue(p.investor_interests)
          : p.is_open_to_work === true,
    },
  ]

  const weights = [15, 15, 10, 15, 10, 10, 5, 5, 10, 5]
  let achieved = 0
  areas.forEach((area, i) => {
    if (area.done) achieved += weights[i]
  })

  return {
    percent: Math.min(100, Math.round(achieved)),
    missing: areas.filter((a) => !a.done).map((a) => a.label),
    areas,
  }
}

export function isProfileComplete(completion: ProfileCompletion): boolean {
  return completion.percent >= PROFILE_COMPLETION_THRESHOLD
}
