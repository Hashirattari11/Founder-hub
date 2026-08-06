import { api } from './api'
import { supabase } from './supabase'
import type {
  AdminCapTableItem,
  DilutionResult,
  EquityCapTable,
  EquityDashboardResponse,
  EquityHolder,
  EquityHolderType,
  InvestmentRound,
  InvestmentRoundStatus,
  MyCapTableItem,
  RoundType,
  ScheduleType,
  ShareClass,
  ShareClassDef,
  VestingFrequency,
  VestingSchedule,
} from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

export const EQUITY_HOLDER_TYPES: { value: EquityHolderType; label: string }[] = [
  { value: 'founder', label: 'Founder' },
  { value: 'investor', label: 'Investor' },
  { value: 'employee', label: 'Employee' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'esop', label: 'ESOP Pool' },
  { value: 'other', label: 'Other' },
]

export const SHARE_CLASS_TYPES: { value: ShareClass; label: string }[] = [
  { value: 'common', label: 'Common' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'options', label: 'Options' },
  { value: 'warrants', label: 'Warrants' },
]

export const INVESTMENT_ROUND_TYPES: { value: RoundType; label: string }[] = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'series_c', label: 'Series C' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'angel', label: 'Angel' },
  { value: 'grant', label: 'Grant' },
  { value: 'other', label: 'Other' },
]

export const ROUND_STATUSES: { value: InvestmentRoundStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const SCHEDULE_TYPES: { value: ScheduleType; label: string }[] = [
  { value: 'standard', label: 'Standard (1yr cliff, 4yr total)' },
  { value: 'cliff_only', label: 'Cliff only' },
  { value: 'accelerated', label: 'Accelerated' },
  { value: 'custom', label: 'Custom' },
]

export const VESTING_FREQUENCIES: { value: VestingFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getEquityDashboard(startupId: string): Promise<EquityDashboardResponse> {
  return api.get(`/api/equity/${startupId}`, { auth: true })
}

export function getMyCapTables(): Promise<{ startups: MyCapTableItem[] }> {
  return api.get('/api/equity/my', { auth: true })
}

export function getAdminCapTables(): Promise<{ cap_tables: AdminCapTableItem[]; total: number }> {
  return api.get('/api/equity/admin/overview', { auth: true })
}

// ---------------------------------------------------------------------------
// Cap table settings
// ---------------------------------------------------------------------------

export function saveEquityCapTable(
  startupId: string,
  payload: {
    total_shares?: number
    currency?: string
    esop_pool_shares?: number
    default_vesting_cliff_months?: number
    default_vesting_total_months?: number
  },
): Promise<EquityCapTable> {
  return api.post(`/api/equity/${startupId}/cap-table`, payload, { auth: true })
}

// ---------------------------------------------------------------------------
// Share classes
// ---------------------------------------------------------------------------

export interface ShareClassInput {
  name: string
  class_type: ShareClass
  par_value?: number | null
  liquidation_preference?: number | null
  voting_rights?: boolean
  conversion_ratio?: number | null
  notes?: string | null
}

export function addShareClass(startupId: string, payload: ShareClassInput): Promise<ShareClassDef> {
  return api.post(`/api/equity/${startupId}/share-class`, payload, { auth: true })
}

export function updateShareClass(classId: string, payload: Partial<ShareClassInput>): Promise<void> {
  return api.patch(`/api/equity/share-class/${classId}`, payload, { auth: true })
}

export function deleteShareClass(classId: string): Promise<void> {
  return api.delete(`/api/equity/share-class/${classId}`, { auth: true })
}

// ---------------------------------------------------------------------------
// Holders
// ---------------------------------------------------------------------------

export interface VestingInput {
  schedule_type: ScheduleType
  start_date?: string | null
  cliff_months?: number | null
  total_months?: number | null
  vesting_frequency: VestingFrequency
  exercise_price?: number | null
  acceleration_on_sale?: boolean
  notes?: string | null
}

export interface HolderInput {
  name: string
  email?: string | null
  title?: string | null
  holder_type: EquityHolderType
  share_class_id?: string | null
  user_id?: string | null
  shares: number
  equity_percent?: number | null
  investment_amount?: number | null
  investment_date?: string | null
  notes?: string | null
  vesting?: VestingInput | null
}

export function addHolder(startupId: string, payload: HolderInput): Promise<EquityHolder> {
  return api.post(`/api/equity/${startupId}/holder`, payload, { auth: true })
}

export function updateHolder(holderId: string, payload: Partial<HolderInput>): Promise<void> {
  return api.patch(`/api/equity/holder/${holderId}`, payload, { auth: true })
}

export function deleteHolder(holderId: string): Promise<void> {
  return api.delete(`/api/equity/holder/${holderId}`, { auth: true })
}

// ---------------------------------------------------------------------------
// Vesting schedules
// ---------------------------------------------------------------------------

export function addVesting(holderId: string, payload: VestingInput): Promise<VestingSchedule> {
  return api.post(`/api/equity/holder/${holderId}/vesting`, payload, { auth: true })
}

export function updateVesting(vestingId: string, payload: Partial<VestingInput>): Promise<void> {
  return api.patch(`/api/equity/vesting/${vestingId}`, payload, { auth: true })
}

export function deleteVesting(vestingId: string): Promise<void> {
  return api.delete(`/api/equity/vesting/${vestingId}`, { auth: true })
}

// ---------------------------------------------------------------------------
// Investment rounds
// ---------------------------------------------------------------------------

export interface RoundInput {
  round_name: string
  round_type: RoundType
  target_amount?: number | null
  raised_amount?: number | null
  pre_money_valuation?: number | null
  post_money_valuation?: number | null
  new_shares_issued?: number | null
  share_price?: number | null
  status?: InvestmentRoundStatus
  open_date?: string | null
  close_date?: string | null
}

export function addInvestmentRound(startupId: string, payload: RoundInput): Promise<InvestmentRound> {
  return api.post(`/api/equity/${startupId}/round`, payload, { auth: true })
}

export function updateInvestmentRound(roundId: string, payload: Partial<RoundInput>): Promise<void> {
  return api.patch(`/api/equity/round/${roundId}`, payload, { auth: true })
}

export function deleteInvestmentRound(roundId: string): Promise<void> {
  return api.delete(`/api/equity/round/${roundId}`, { auth: true })
}

// ---------------------------------------------------------------------------
// Dilution calculator
// ---------------------------------------------------------------------------

export function runDilution(
  startupId: string,
  payload: { raise_amount: number; pre_money_valuation?: number | null; post_money_valuation?: number | null },
): Promise<DilutionResult> {
  return api.post(`/api/equity/${startupId}/dilution`, payload, { auth: true })
}

// ---------------------------------------------------------------------------
// PDF export
// ---------------------------------------------------------------------------

export async function downloadEquityPdf(startupId: string, startupName: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const res = await fetch(`${API_URL}/api/equity/${startupId}/pdf`, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
  })
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data.detail) detail = data.detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(startupName || 'startup').toLowerCase().replace(/\s+/g, '_')}_cap_table.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
