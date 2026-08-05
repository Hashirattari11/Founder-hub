import { api } from './api'
import type {
  CoFounderMatchesResponse,
  CoFounderPreference,
  CoFounderRequest,
} from '../types'

export interface CoFounderPrefsPayload {
  looking_for_roles: string[]
  industry_focus: string[]
  commitment_level?: string | null
  equity_willing_to_give?: number | null
  startup_stage?: string | null
  location_preference?: string | null
  description?: string | null
  is_looking: boolean
}

export async function saveCoFounderPreferences(payload: CoFounderPrefsPayload): Promise<{ success: boolean }> {
  return api.post('/api/cofounder/preferences', payload, { auth: true })
}

export async function getCoFounderPreferences(userId: string): Promise<CoFounderPreference | null> {
  return api.get<CoFounderPreference | null>(`/api/cofounder/preferences/${userId}`, { auth: true })
}

export async function getCoFounderMatches(userId: string): Promise<CoFounderMatchesResponse> {
  return api.get(`/api/cofounder/matches/${userId}`, { auth: true })
}

export async function getCoFounderRequests(
  userId: string,
): Promise<{ received: CoFounderRequest[]; sent: CoFounderRequest[] }> {
  return api.get(`/api/cofounder/requests/${userId}`, { auth: true })
}

export async function sendCoFounderRequest(
  targetId: string,
  message: string,
): Promise<{ success: boolean; match_score?: number }> {
  return api.post('/api/cofounder/request', { target_id: targetId, message }, { auth: true })
}

export async function respondCoFounderRequest(
  requestId: string,
  status: 'accepted' | 'rejected',
): Promise<{ success: boolean; status: string; chat_with: string }> {
  return api.patch(`/api/cofounder/request/${requestId}`, { status }, { auth: true })
}
