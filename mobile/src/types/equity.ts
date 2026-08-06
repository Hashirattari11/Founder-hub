export type EquityHolderType = 'founder' | 'investor' | 'employee' | 'advisor' | 'esop' | 'other'
export type ShareClassType = 'common' | 'preferred' | 'options' | 'warrants'
export type RoundType = 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c' | 'bridge' | 'angel' | 'grant' | 'other'
export type InvestmentRoundStatus = 'planned' | 'open' | 'closed' | 'cancelled'
export type ScheduleType = 'standard' | 'cliff_only' | 'accelerated' | 'custom'
export type VestingFrequency = 'monthly' | 'quarterly' | 'annually'

export interface ShareClassDef {
  id: string
  cap_table_id: string
  name: string
  class_type: ShareClassType
  par_value: number | null
  liquidation_preference: number | null
  voting_rights: boolean
  conversion_ratio: number | null
  notes: string | null
  created_at: string
}

export interface VestingSchedule {
  id: string
  holder_id: string
  schedule_type: ScheduleType
  start_date: string | null
  cliff_months: number | null
  total_months: number | null
  vesting_frequency: VestingFrequency
  exercise_price: number | null
  acceleration_on_sale: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EquityHolder {
  id: string
  cap_table_id: string
  name: string
  email: string | null
  title: string | null
  holder_type: EquityHolderType
  share_class_id: string | null
  user_id: string | null
  shares: number
  equity_percent: number | null
  investment_amount: number | null
  investment_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  vesting_schedules: VestingSchedule[]
  ownership_pct: number
  vested_shares: number | null
  vested_pct: number
  share_class_name: string | null
  share_class_type: ShareClassType | null
}

export interface InvestmentRound {
  id: string
  cap_table_id: string
  round_name: string
  round_type: RoundType
  target_amount: number | null
  raised_amount: number | null
  pre_money_valuation: number | null
  post_money_valuation: number | null
  new_shares_issued: number | null
  share_price: number | null
  status: InvestmentRoundStatus
  open_date: string | null
  close_date: string | null
  created_at: string
}

export interface EquityCapTable {
  id: string
  startup_id: string
  total_shares: number
  currency: string | null
  esop_pool_shares: number
  default_vesting_cliff_months: number
  default_vesting_total_months: number
  last_updated: string | null
  created_at: string
}

export interface EquitySummary {
  total_shares: number
  allocated_shares: number
  unallocated_shares: number
  allocated_pct: number
  unallocated_pct: number
  by_holder_type: Record<EquityHolderType, { shares: number; pct: number }>
  founder_pct: number
  investor_pct: number
  employee_pct: number
  advisor_pct: number
  esop_pct: number
  other_pct: number
  by_share_class: Record<string, { name: string; class_type: ShareClassType; shares: number; pct: number }>
  esop_pool_shares: number
  valuation: number | null
}

export interface EquityDashboardResponse {
  startup: { id: string; name: string; founder_id: string; tagline: string | null; industry: string | null }
  can_manage: boolean
  cap_table: EquityCapTable | null
  share_classes: ShareClassDef[]
  holders: EquityHolder[]
  rounds: InvestmentRound[]
  summary: EquitySummary
}
