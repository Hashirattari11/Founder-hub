import { supabase } from './supabase'
import { api } from './api'
import { calcInvestorMatch, calcMatchScore, friendlyDbError } from './helpers'
import type { Profile, Startup } from '../types'

export interface StartupInsert {
  founder_id?: string | null
  name: string
  tagline: string
  description: string
  industry: string
  stage: string
  team_roles_needed: string[]
  equity_offered: number
  remote_friendly: boolean
  location?: string | null
  funding_needed?: string | null
  tech_stack: string[]
  website_url?: string | null
  pitch_deck_url?: string | null
  is_published: boolean
}

export const FUNDING_MIDPOINTS: Record<string, number> = {
  Bootstrapped: 0,
  'Under $10K': 5,
  '$10K-$50K': 30,
  '$50K-$100K': 75,
  '$100K-$500K': 300,
  '$500K+': 750,
}

export const FUNDING_ORDER = Object.keys(FUNDING_MIDPOINTS)

export interface ExploreOptions {
  search?: string
  industries?: string[]
  stages?: string[]
  roles?: string[]
  remoteOnly?: boolean
  maxFundingMidpoint?: number
  sort?: 'newest' | 'applicants' | 'equity'
  page?: number
  pageSize?: number
}

export interface ExploreResult {
  startups: Startup[]
  total: number
}

const PROFILE_FIELDS = 'full_name, avatar_url, username, bio, linkedin_url'

/**
 * Explore published startups. Server-side filters (industry, stage, full-text
 * search, newest order) are applied first; role / funding / remote / applicant
 * sorting are applied in-memory on the fetched window.
 */
export async function exploreStartups(options: ExploreOptions = {}): Promise<ExploreResult> {
  const {
    search,
    industries = [],
    stages = [],
    sort = 'newest',
    page = 0,
    pageSize = 12,
  } = options

  let query = supabase
    .from('startups')
    .select(`*, profiles!startups_founder_id_fkey(${PROFILE_FIELDS})`)
    .eq('is_published', true)

  if (industries.length > 0) query = query.in('industry', industries)
  if (stages.length > 0) query = query.in('stage', stages)

  if (search && search.trim()) {
    const q = search.trim().replace(/[%_\\]/g, '')
    if (q) {
      query = query.or(`name.ilike.%${q}%,tagline.ilike.%${q}%,description.ilike.%${q}%`)
    }
  }

  if (sort === 'newest') query = query.order('created_at', { ascending: false })
  query = query.limit(200)

  const { data, error } = await query
  if (error) {
    // Fallback query without optional fts column.
    if (error.message?.includes('fts') || error.message?.includes('column')) {
      let fb = supabase.from('startups').select(`*, profiles!startups_founder_id_fkey(${PROFILE_FIELDS})`).eq('is_published', true)
      if (industries.length > 0) fb = fb.in('industry', industries)
      if (stages.length > 0) fb = fb.in('stage', stages)
      if (search?.trim()) {
        const q = search.trim().replace(/[%_\\]/g, '')
        if (q) fb = fb.or(`name.ilike.%${q}%,tagline.ilike.%${q}%,description.ilike.%${q}%`)
      }
      if (sort === 'newest') fb = fb.order('created_at', { ascending: false })
      fb = fb.limit(200)
      const fbData = await fb
      return filterAndPage(fbData.data ?? [], options, page, pageSize)
    }
    throw friendlyDbError(error)
  }

  return filterAndPage(data ?? [], options, page, pageSize)
}

async function filterAndPage(
  all: Startup[],
  options: ExploreOptions,
  page: number,
  pageSize: number,
): Promise<ExploreResult> {
  const {
    roles = [],
    remoteOnly = false,
    maxFundingMidpoint,
    sort = 'newest',
  } = options

  const appCounts = await getApplicantCounts()

  let filtered = all

  if (roles.length > 0) {
    const wanted = roles.map((r) => r.toLowerCase())
    filtered = filtered.filter((s) =>
      (s.team_roles_needed ?? []).some((r) => wanted.includes(r.toLowerCase())),
    )
  }

  if (remoteOnly) {
    filtered = filtered.filter((s) => s.remote_friendly === true)
  }

  if (maxFundingMidpoint !== undefined) {
    filtered = filtered.filter((s) => {
      const mid = FUNDING_MIDPOINTS[s.funding_needed ?? '']
      return mid === undefined || mid <= maxFundingMidpoint
    })
  }

  if (sort === 'applicants') {
    filtered = [...filtered].sort((a, b) => (appCounts[b.id] ?? 0) - (appCounts[a.id] ?? 0))
  } else if (sort === 'equity') {
    filtered = [...filtered].sort((a, b) => (b.equity_offered ?? 0) - (a.equity_offered ?? 0))
  } else {
    filtered = [...filtered].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }

  return {
    startups: filtered.slice(page * pageSize, (page + 1) * pageSize),
    total: filtered.length,
  }
}

let applicantCountCache: Record<string, number> | null = null

export async function getApplicantCounts(): Promise<Record<string, number>> {
  if (applicantCountCache) return applicantCountCache
  const { data, error } = await supabase
    .from('applications')
    .select('startup_id')
  if (error) return {}
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.startup_id] = (counts[row.startup_id] ?? 0) + 1
  }
  applicantCountCache = counts
  return counts
}

export function clearApplicantCountCache() {
  applicantCountCache = null
}

export async function getStartupById(id: string): Promise<Startup | null> {
  const { data, error } = await supabase
    .from('startups')
    .select(`*, profiles!startups_founder_id_fkey(${PROFILE_FIELDS})`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw friendlyDbError(error)
  return data as Startup | null
}

export async function createStartup(payload: StartupInsert): Promise<Startup> {
  const { data, error } = await supabase
    .from('startups')
    .insert(payload)
    .select()
    .single()
  if (error) throw friendlyDbError(error)
  clearApplicantCountCache()
  return data as Startup
}

export async function updateStartup(id: string, payload: Partial<StartupInsert>): Promise<Startup> {
  const { data, error } = await supabase
    .from('startups')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw friendlyDbError(error)
  clearApplicantCountCache()
  return data as Startup
}

export async function deleteStartup(id: string): Promise<void> {
  const { error } = await supabase.from('startups').delete().eq('id', id)
  if (error) throw friendlyDbError(error)
  clearApplicantCountCache()
}

export async function getMyStartups(founderId: string): Promise<Startup[]> {
  const { data, error } = await supabase
    .from('startups')
    .select('*')
    .eq('founder_id', founderId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Startup[]
}

export async function trackStartupView(startupId: string, viewerId: string | null): Promise<void> {
  if (!viewerId) return
  try {
    await supabase.from('startup_views').insert({ startup_id: startupId, viewer_id: viewerId })
  } catch {
    // Non-critical tracking — ignore failures.
  }
}

export async function getRecentlyViewed(userId: string, limit = 3): Promise<Startup[]> {
  const { data, error } = await supabase
    .from('startup_views')
    .select(`startup_id, viewed_at, startups!inner(*, profiles!startups_founder_id_fkey(${PROFILE_FIELDS}))`)
    .eq('viewer_id', userId)
    .eq('startups.is_published', true)
    .order('viewed_at', { ascending: false })
    .limit(30)
  if (error) throw error
  const seen = new Set<string>()
  const out: Startup[] = []
  for (const row of data ?? []) {
    if (!row.startup_id || seen.has(row.startup_id)) continue
    seen.add(row.startup_id)
    out.push(row.startups as unknown as Startup)
    if (out.length >= limit) break
  }
  return out
}

export interface StartupViewRow {
  id: string
  viewer_id: string | null
  viewed_at: string
}

export async function getStartupViews(startupId: string): Promise<StartupViewRow[]> {
  const { data, error } = await supabase
    .from('startup_views')
    .select('id, viewer_id, viewed_at')
    .eq('startup_id', startupId)
    .order('viewed_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as StartupViewRow[]
}

export async function isStartupSaved(userId: string, startupId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_startups')
    .select('startup_id')
    .eq('user_id', userId)
    .eq('startup_id', startupId)
    .maybeSingle()
  if (error) return false
  return !!data
}

export async function saveStartup(userId: string, startupId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_startups')
    .insert({ user_id: userId, startup_id: startupId })
  if (error) throw error
}

export async function unsaveStartup(userId: string, startupId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_startups')
    .delete()
    .eq('user_id', userId)
    .eq('startup_id', startupId)
  if (error) throw error
}

export async function getSavedStartups(userId: string): Promise<Startup[]> {
  const { data, error } = await supabase
    .from('saved_startups')
    .select(`startup_id, startups!inner(*, profiles!startups_founder_id_fkey(${PROFILE_FIELDS}))`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row: { startup_id: string; startups: unknown[] }) => row.startups as unknown as Startup)
}

/** Trigger the AI matching pipeline for a published startup. */
export async function notifyMatchedUsers(startupId: string): Promise<void> {
  try {
    await api.post<{ notified: number }>(
      `/api/notify-startup-published/${startupId}`,
      undefined,
      { auth: true },
    )
  } catch (err) {
    console.log('Notify users for startup:', startupId, err)
  }
}

/** Startups a user should see first (match score desc). */
export async function getRecommendedStartups(
  profile: Pick<Profile, 'role' | 'skills' | 'city' | 'experience_years'>,
  limit = 3,
): Promise<Startup[]> {
  const { startups } = await exploreStartups({ page: 0, pageSize: 200 })
  const scored = startups
    .map((s) => ({ startup: s, score: calcMatchScore(profile, s) }))
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.startup)
}

/** Investor-scored startup recommendations with live match scores. */
export async function getInvestorRecommendations(
  profile: Pick<
    Profile,
    'investor_interests' | 'investment_range_min' | 'investment_range_max' | 'investment_stage'
  >,
  limit = 6,
): Promise<{ startup: Startup; score: number }[]> {
  const { startups } = await exploreStartups({ page: 0, pageSize: 200 })
  return startups
    .map((s) => ({ startup: s, score: calcInvestorMatch(profile, s) }))
    .filter((s) => s.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
