import { api } from './api'
import type {
  HealthResponse,
  MatchRunPayload,
  MatchRunResponse,
  MyMatchesResponse,
  ReadinessResponse,
  StartupMatchesResponse,
  TeamGapsResponse,
} from '../types/startupInsights'

// ---- Startup Health Score -------------------------------------------------

export function getStartupHealth(startupId: string, refresh = false): Promise<HealthResponse> {
  const q = refresh ? '?refresh=true' : ''
  return api.get<HealthResponse>(`/api/ai-insights/startups/${startupId}/health${q}`, { auth: true })
}

export function analyzeStartupHealth(startupId: string): Promise<HealthResponse> {
  return api.post<HealthResponse>(`/api/ai-insights/startups/${startupId}/health`, undefined, { auth: true })
}

// ---- Team Gap Finder ------------------------------------------------------

export function getTeamGaps(startupId: string, refresh = false): Promise<TeamGapsResponse> {
  const q = refresh ? '?refresh=true' : ''
  return api.get<TeamGapsResponse>(`/api/ai-insights/startups/${startupId}/team-gaps${q}`, { auth: true })
}

export function analyzeTeamGaps(startupId: string): Promise<TeamGapsResponse> {
  return api.post<TeamGapsResponse>(`/api/ai-insights/startups/${startupId}/team-gaps`, undefined, { auth: true })
}

// ---- Investor Readiness ---------------------------------------------------

export function getInvestorReadiness(startupId: string, refresh = false): Promise<ReadinessResponse> {
  const q = refresh ? '?refresh=true' : ''
  return api.get<ReadinessResponse>(`/api/ai-insights/startups/${startupId}/investor-readiness${q}`, { auth: true })
}

export function analyzeInvestorReadiness(startupId: string): Promise<ReadinessResponse> {
  return api.post<ReadinessResponse>(`/api/ai-insights/startups/${startupId}/investor-readiness`, undefined, { auth: true })
}

// ---- Explainable Matching -------------------------------------------------

export function runStartupMatching(startupId: string, payload: MatchRunPayload): Promise<MatchRunResponse> {
  return api.post<MatchRunResponse>(`/api/ai-insights/startups/${startupId}/matches`, payload, { auth: true })
}

export function listStartupMatches(startupId: string, role?: string): Promise<StartupMatchesResponse> {
  const q = role ? `?role=${encodeURIComponent(role)}` : ''
  return api.get<StartupMatchesResponse>(`/api/ai-insights/startups/${startupId}/matches${q}`, { auth: true })
}

export function getMyMatches(): Promise<MyMatchesResponse> {
  return api.get<MyMatchesResponse>('/api/ai-insights/matches/me', { auth: true })
}
