import { supabase } from './supabase'
import { api } from './api'
import type { InvestorMatch, InvestorMatchResult, InvestorMatchStatus, InvestorProfile } from '../types'

export interface InvestorProfilePayload {
  investment_thesis?: string | null
  portfolio_companies?: string[] | null
  check_size_min?: number | null
  check_size_max?: number | null
  preferred_industries?: string[] | null
  preferred_stages?: string[] | null
  preferred_locations?: string[] | null
  value_add?: string | null
  total_investments?: number | null
  is_active: boolean
}

export async function getInvestorProfile(userId: string): Promise<InvestorProfile | null> {
  const { data, error } = await supabase
    .from('investor_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function saveInvestorProfile(userId: string, payload: InvestorProfilePayload): Promise<InvestorProfile> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user?.id || session.user.id !== userId) {
    throw new Error("You don't have access to this.")
  }

  const { data, error } = await supabase
    .from('investor_profiles')
    .upsert({ user_id: userId, ...payload }, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function findInvestors(
  startupId: string,
): Promise<{ matches: InvestorMatchResult[]; total: number }> {
  return api.post(`/api/investor-match/find/${startupId}`, undefined, { auth: true })
}

export async function getStartupInvestorMatches(startupId: string): Promise<{ matches: InvestorMatch[] }> {
  return api.get(`/api/investor-match/my-matches/${startupId}`, { auth: true })
}

export async function sendInvestorRequest(
  startupId: string,
  investorId: string,
  message: string,
): Promise<{ success: boolean; match_id: string }> {
  return api.post('/api/investor-match/request', { startup_id: startupId, investor_id: investorId, message }, { auth: true })
}

export async function updateInvestorMatchStatus(
  matchId: string,
  status: InvestorMatchStatus,
): Promise<{ success: boolean; status: InvestorMatchStatus }> {
  return api.patch(`/api/investor-match/${matchId}/status`, { status }, { auth: true })
}
