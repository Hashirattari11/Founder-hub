import { api } from './api'
import type {
  AdminNotificationsResponse,
  AdminOverviewResponse,
  AdminStartupsResponse,
  AdminUsersResponse,
  AnalyticsResponse,
  ReportsResponse,
  RoleRequestsResponse,
  StartupMembersResponse,
  SuccessResponse,
} from '@/types/admin'

const AUTH = { auth: true }

export function adminOverview() {
  return api.get<AdminOverviewResponse>('/api/admin/overview', AUTH)
}

export function adminUsers(params: { search?: string; role?: string; verified?: string; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.role) query.set('role', params.role)
  if (params.verified) query.set('verified', params.verified)
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return api.get<AdminUsersResponse>(`/api/admin/users${qs ? `?${qs}` : ''}`, AUTH)
}

export function adminVerifyUser(userId: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/verify`, undefined, AUTH)
}

export function adminSuspendUser(userId: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/suspend`, undefined, AUTH)
}

export function adminUnsuspendUser(userId: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/unsuspend`, undefined, AUTH)
}

export function adminBanUser(userId: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/ban`, undefined, AUTH)
}

export function adminUnbanUser(userId: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/unban`, undefined, AUTH)
}

export function adminStartups(params: { search?: string; status?: string; limit?: number } = {}) {
  const query = new URLSearchParams()
  if (params.search) query.set('search', params.search)
  if (params.status) query.set('status', params.status)
  if (params.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return api.get<AdminStartupsResponse>(`/api/admin/startups${qs ? `?${qs}` : ''}`, AUTH)
}

export function adminUpdateStartup(startupId: string, body: Record<string, unknown>) {
  return api.patch<SuccessResponse>(`/api/admin/startups/${startupId}`, body, AUTH)
}

export function adminRoleRequests() {
  return api.get<RoleRequestsResponse>('/api/admin/role-requests', AUTH)
}

export function adminApproveRoleRequest(requestId: string) {
  return api.post<SuccessResponse>(`/api/admin/role-requests/${requestId}/approve`, undefined, AUTH)
}

export function adminRejectRoleRequest(requestId: string) {
  return api.post<SuccessResponse>(`/api/admin/role-requests/${requestId}/reject`, undefined, AUTH)
}

export function adminReports() {
  return api.get<ReportsResponse>('/api/admin/reports', AUTH)
}

export function adminResolveReport(reportId: string) {
  return api.post<SuccessResponse>(`/api/admin/reports/${reportId}/resolve`, undefined, AUTH)
}

export function adminDismissReport(reportId: string) {
  return api.post<SuccessResponse>(`/api/admin/reports/${reportId}/dismiss`, undefined, AUTH)
}

export function adminNotifications() {
  return api.get<AdminNotificationsResponse>('/api/admin/notifications', AUTH)
}

export function adminAnalytics() {
  return api.get<AnalyticsResponse>('/api/admin/analytics', AUTH)
}

export function adminStartupMembers(params: { startup_id?: string } = {}) {
  const qs = params.startup_id ? `?startup_id=${encodeURIComponent(params.startup_id)}` : ''
  return api.get<StartupMembersResponse>(`/api/admin/startup-members${qs}`, AUTH)
}

export function adminAddStartupMember(body: { startup_id: string; user_id: string; permission: string }) {
  return api.post<SuccessResponse>('/api/admin/startup-members', body, AUTH)
}

export function adminRemoveStartupMember(startupId: string, userId: string) {
  return api.del<SuccessResponse>(`/api/admin/startup-members/${startupId}/${userId}`, AUTH)
}
