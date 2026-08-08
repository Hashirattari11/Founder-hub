import { api } from './api'
import type { Role } from '../types'

export interface RoleRequest {
  id: string
  user_id: string
  from_role: string
  requested_role: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  admin_id: string | null
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
}

export async function createRoleRequest(requestedRole: Role, reason: string): Promise<RoleRequest> {
  return api.post<RoleRequest>(
    '/api/role-requests',
    { requested_role: requestedRole, reason },
    { auth: true },
  )
}

export async function getMyRoleRequests(): Promise<RoleRequest[]> {
  const res = await api.get<{ requests: RoleRequest[] }>('/api/role-requests/me', { auth: true })
  return res.requests ?? []
}

export async function cancelRoleRequest(requestId: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/api/role-requests/${requestId}`, { auth: true })
}
