// Types for the AI Startup Insights features (Health, Team Gaps,
// Investor Readiness, Explainable Matching) — mirrors the backend responses.

export interface CategoryScore {
  key: string
  label: string
  score: number
  max: number
  note: string
}

export interface DataCoverage {
  available: string[]
  missing: string[]
  insufficient: boolean
}

export interface StrengthWeakness {
  title: string
  detail: string
  impact?: string
}

export interface Recommendation {
  action: string
  priority: string
}

export interface HealthResponse {
  insufficient: boolean
  cached: boolean
  data_coverage?: DataCoverage
  score: number | null
  categories: CategoryScore[]
  strengths: StrengthWeakness[]
  weaknesses: StrengthWeakness[]
  recommendations: Recommendation[]
  summary: string
  provider?: string | null
  id?: string
}

export interface PresentRole {
  role: string
  member_count: number
}

export interface TeamGap {
  role: string
  label: string
  criticality: string
  why: string
  suggested_skills: string[]
  responsibilities: string[]
  next_action: string
  priority: number
}

export interface TeamGapsResponse {
  insufficient: boolean
  cached: boolean
  data_coverage?: DataCoverage
  summary: string
  present_roles: PresentRole[]
  gaps: TeamGap[]
}

export interface ReadinessResponse {
  insufficient: boolean
  cached: boolean
  data_coverage?: DataCoverage
  score: number | null
  categories: CategoryScore[]
  strengths: StrengthWeakness[]
  weaknesses: StrengthWeakness[]
  checklist: { item: string; done: boolean; category: string }[]
  summary: string
}

export interface MatchScoreItem {
  category: string
  label: string
  weight: number
  score: number
  max: number
  note: string
}

export interface MatchReason {
  factor: string
  detail: string
  weight: number
  contribution: number
}

export interface MatchConcern {
  factor: string
  detail: string
}

export interface AIMatch {
  id: string
  startup_id: string
  target_user_id: string
  role: string
  score: number
  scores: MatchScoreItem[]
  reasons: MatchReason[]
  concerns: MatchConcern[]
  created_at: string
}

export interface MatchRunPayload {
  roles?: string[]
  weights?: Record<string, number>
  min_score?: number
}

export interface MatchRunResponse {
  startup_id: string
  total_scored: number
  matches_kept: number
  min_score: number
  roles: string[]
  matches: AIMatch[]
}

export interface MatchedUser {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  role: string | null
  bio: string | null
  company: string | null
  city: string | null
  skills: string[] | null
  experience_years: number | null
  is_open_to_work: boolean | null
}

export interface StartupMatchRow {
  match: AIMatch
  user?: MatchedUser | null
}

export interface StartupMatchesResponse {
  startup_id: string
  matches: StartupMatchRow[]
}

export interface MyMatchItem {
  match: AIMatch
  startup: {
    id: string
    name: string
    tagline: string | null
    industry: string | null
    stage: string | null
    location: string | null
    remote_friendly: boolean | null
    is_verified: boolean | null
    team_roles_needed: string[] | null
  } | null
}

export interface MyMatchesResponse {
  matches: MyMatchItem[]
}
