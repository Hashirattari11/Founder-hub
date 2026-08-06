import { api } from './api'
import type { EquityDashboardResponse } from '@/types/equity'

export function getEquityDashboard(startupId: string): Promise<EquityDashboardResponse> {
  return api.get(`/api/equity/${startupId}`, { auth: true })
}
