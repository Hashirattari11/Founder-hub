import type { Profile, Startup } from '../types'

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (Number.isNaN(seconds) || seconds < 0) return ''
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function formatDayDivider(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${n >= 10 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`
}

export function isSameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

/**
 * Mirrors the backend matching algorithm so cards can show a live match %.
 * 0–100.
 */
export function calcMatchScore(
  userProfile: Pick<Profile, 'role' | 'skills' | 'city' | 'experience_years'> | null,
  startup: Pick<Startup, 'tech_stack' | 'team_roles_needed' | 'location' | 'remote_friendly'>,
): number {
  if (!userProfile) return 0
  let score = 0

  const userSkills = new Set(userProfile.skills ?? [])
  const startupTech = new Set(startup.tech_stack ?? [])
  const startupRoles = new Set(startup.team_roles_needed ?? [])

  let overlap = 0
  userSkills.forEach((s) => {
    if (startupTech.has(s)) overlap += 1
  })
  score += Math.min(overlap * 10, 40)

  const userRole = (userProfile.role ?? '').toLowerCase()
  if ([...startupRoles].some((r) => r.toLowerCase() === userRole)) score += 30

  if (startup.location && startup.location.toLowerCase() === (userProfile.city ?? '').toLowerCase()) {
    score += 15
  } else if (startup.remote_friendly) {
    score += 10
  }

  const exp = userProfile.experience_years ?? 0
  if (exp >= 3) score += 15
  else if (exp >= 1) score += 8

  return Math.min(score, 100)
}

/**
 * Mirrors the backend investor matching algorithm. 0–100.
 * - Industry overlap: 50
 * - Funding midpoint inside investor range: 30
 * - Stage match: 20
 */
export function calcInvestorMatch(
  investor: Pick<
    Profile,
    'investor_interests' | 'investment_range_min' | 'investment_range_max' | 'investment_stage'
  > | null,
  startup: Pick<Startup, 'industry' | 'funding_needed' | 'stage'>,
): number {
  if (!investor) return 0
  let score = 0

  const interests = (investor.investor_interests ?? []).map((i) => i.toLowerCase())
  const industry = (startup.industry ?? '').toLowerCase()
  if (industry && interests.some((i) => industry.includes(i) || i.includes(industry))) score += 50

  const midpoints: Record<string, number> = {
    Bootstrapped: 0,
    'Under $10K': 5,
    '$10K-$50K': 30,
    '$50K-$100K': 75,
    '$100K-$500K': 300,
    '$500K+': 750,
  }
  const midpoint = midpoints[startup.funding_needed ?? '']
  if (midpoint !== undefined) {
    const low = investor.investment_range_min ?? 0
    const high = investor.investment_range_max ?? 1_000_000
    if (midpoint >= low && midpoint <= high) score += 30
  }

  const stages = (investor.investment_stage ?? []).map((s) => s.toLowerCase())
  const stage = (startup.stage ?? '').toLowerCase()
  if (stage && stages.includes(stage)) score += 20

  return Math.min(score, 100)
}

/** Skills of an applicant that overlap a startup's tech stack. */
export function skillsMatchPercent(  applicantSkills: string[] | null | undefined,
  startupTech: string[] | null | undefined,
): number {
  if (!applicantSkills?.length || !startupTech?.length) return 0
  const tech = new Set(startupTech)
  const overlap = applicantSkills.filter((s) => tech.has(s)).length
  return Math.round((overlap / startupTech.length) * 100)
}

export function capitalize(str: string | null | undefined): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/** Map common Supabase/PostgREST errors to a friendly message. */
export function friendlyDbError(err: unknown): Error {
  let msg = ''
  let code = ''

  if (err instanceof Error) {
    msg = err.message
  } else if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    msg = String(e.message ?? '')
    code = String(e.code ?? '')
    const details = String(e.details ?? '')
    if (msg && details) msg = `${msg} — ${details}`
  } else {
    msg = String(err)
  }

  if (msg.includes('PGRST205') || msg.includes('Could not find the table')) {
    return new Error(
      'Database schema is not set up yet. Run supabase/migrations/setup_all.sql in the Supabase SQL Editor.',
    )
  }
  if (code === '42501' || msg.includes('PGRST42501') || msg.toLowerCase().includes('permission denied')) {
    return new Error('Permission denied for this operation.')
  }
  if (!msg) msg = code ? `Database error (${code})` : 'Request failed. Please try again.'
  return new Error(msg)
}
