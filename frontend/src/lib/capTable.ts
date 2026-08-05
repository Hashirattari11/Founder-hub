import { api } from './api'
import type {
  CapTable,
  CapTableEntry,
  CapTableResponse,
  FundingRound,
  HolderType,
  ShareClass,
} from '../types'

export const HOLDER_TYPES: { value: HolderType; label: string }[] = [
  { value: 'founder', label: 'Founder' },
  { value: 'investor', label: 'Investor' },
  { value: 'employee', label: 'Employee' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'esop', label: 'ESOP Pool' },
  { value: 'other', label: 'Other' },
]

export const SHARE_CLASSES: { value: ShareClass; label: string }[] = [
  { value: 'common', label: 'Common' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'options', label: 'Options' },
  { value: 'warrants', label: 'Warrants' },
]

export const ROUND_TYPES: { value: string; label: string }[] = [
  { value: 'pre_seed', label: 'Pre-Seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'angel', label: 'Angel' },
  { value: 'grant', label: 'Grant' },
]

export interface EntryInput {
  holder_name: string
  holder_type: HolderType
  shares: number
  share_class: ShareClass
  investment_amount?: number | null
  investment_date?: string | null
  vesting_start?: string | null
  vesting_cliff_months?: number | null
  vesting_total_months?: number | null
  notes?: string | null
}

export async function getCapTable(startupId: string): Promise<CapTableResponse> {
  return api.get<CapTableResponse>(`/api/cap-table/${startupId}`, { auth: true })
}

export async function saveCapTable(startupId: string, payload: { total_shares?: number; currency?: string }): Promise<CapTable> {
  return api.post<CapTable>(`/api/cap-table/${startupId}`, payload, { auth: true })
}

export async function addEntry(startupId: string, payload: EntryInput): Promise<CapTableEntry> {
  return api.post<CapTableEntry>(`/api/cap-table/${startupId}/entry`, payload, { auth: true })
}

export async function updateEntry(entryId: string, payload: Partial<EntryInput>): Promise<void> {
  await api.patch<{ success: boolean }>(`/api/cap-table/entry/${entryId}`, payload, { auth: true })
}

export async function deleteEntry(entryId: string): Promise<void> {
  await api.delete<{ success: boolean }>(`/api/cap-table/entry/${entryId}`, { auth: true })
}

export interface RoundInput {
  round_name: string
  round_type: string
  target_amount?: number | null
  raised_amount?: number | null
  pre_money_valuation?: number | null
  post_money_valuation?: number | null
  share_price?: number | null
  status?: string
  open_date?: string | null
  close_date?: string | null
}

export async function addRound(startupId: string, payload: RoundInput): Promise<FundingRound> {
  return api.post<FundingRound>(`/api/cap-table/${startupId}/round`, payload, { auth: true })
}

export async function updateRound(roundId: string, payload: Partial<RoundInput>): Promise<void> {
  await api.patch<{ success: boolean }>(`/api/cap-table/round/${roundId}`, payload, { auth: true })
}

export async function deleteRound(roundId: string): Promise<void> {
  await api.delete<{ success: boolean }>(`/api/cap-table/round/${roundId}`, { auth: true })
}
