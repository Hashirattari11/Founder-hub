export type PlanStage = 'idea' | 'mvp' | 'traction' | 'growth' | 'scale'

export type BusinessModel =
  | 'saas'
  | 'marketplace'
  | 'ecommerce'
  | 'subscription'
  | 'ads'
  | 'agency'
  | 'hardware'
  | 'consulting'
  | 'fintech'
  | 'other'

export interface BusinessPlanSection {
  key: string
  title: string
  content: string
}

export interface PitchDeckSlide {
  key: string
  title: string
  bullets: string[]
  note?: string
}

export interface ExpenseBreakdown {
  salaries: number
  marketing: number
  infrastructure_tools: number
  operations: number
  other: number
  total: number
}

export interface UseOfFundsItem {
  label: string
  percent: number
  amount: number
}

export interface FinancialProjection {
  monthly_revenue: number[]
  monthly_expenses: number[]
  monthly_cash_flow: number[]
  cumulative_cash: number[]
  growth_pct: number[]
  expense_breakdown: ExpenseBreakdown
  monthly_budget: number
  break_even_month: number | null
  runway_months: number | null
  burn_rate: number
  funding_requirement: number
  use_of_funds: UseOfFundsItem[]
  year1_revenue: number
  year2_revenue: number
  year3_revenue: number
  key_assumptions: string[]
}

export interface TeamRecommendation {
  role: string
  seniority: string
  count: number
  remote_ok: boolean
  reason: string
}

export interface ReadinessScore {
  label: string
  score: number
  max: number
}

export interface InvestorReadiness {
  scores: ReadinessScore[]
  overall: number
  label: string
  summary: string
}

export interface AiRecommendations {
  missing_features: string[]
  weaknesses: string[]
  improvements: string[]
  risks: string[]
  scaling_plan: string[]
  internationalization: string[]
}

export interface BusinessPlanInputs {
  startup_name: string
  idea: string
  industry: string
  country: string
  target_audience: string
  stage: PlanStage
  funding_goal: number
  budget: number
  team_size: number
  business_model: BusinessModel
}

export interface BusinessPlanRecord {
  id: string
  user_id: string
  startup_name: string
  idea: string
  inputs: BusinessPlanInputs
  business_plan: BusinessPlanSection[]
  pitch_deck: PitchDeckSlide[]
  financial_projection: FinancialProjection
  team_recommendations: TeamRecommendation[]
  investor_readiness: InvestorReadiness
  ai_recommendations: AiRecommendations
  share_token: string | null
  is_public: boolean
  provider: string
  created_at: string
  updated_at: string
}

export interface BusinessPlanSummary {
  id: string
  startup_name: string
  industry?: string
  stage?: string
  created_at: string
  updated_at: string
  readiness?: number
  readiness_label?: string
  is_public: boolean
  share_token: string | null
  provider: string
}

export interface GeneratePlanPayload {
  startup_name: string
  idea: string
  industry?: string
  country?: string
  target_audience?: string
  stage: PlanStage
  funding_goal?: number
  budget?: number
  team_size?: number
  business_model?: BusinessModel
}
