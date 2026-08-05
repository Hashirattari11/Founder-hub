import type { Profile, Startup } from '@/types'

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
