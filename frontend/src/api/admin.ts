import { api } from '../lib/api'
import type {
  AdminMeResponse,
  AdminOverviewResponse,
  AdminMeetingsResponse,
  AdminStartupsResponse,
  AdminStartup,
  AdminUsersResponse,
  AdminInvestorsResponse,
  AdminMessagesResponse,
  AdminNotificationsResponse,
  AiAnalyticsResponse,
  AiUsageResponse,
  AnalyticsResponse,
  Announcement,
  AnnouncementsResponse,
  AuditLogsResponse,
  BlogPost,
  BlogPostsResponse,
  HealthResponse,
  LoginLogsResponse,
  ReportsResponse,
  RoleRequestsResponse,
  SettingsMap,
  SettingsResponse,
  SiteContentResponse,
  StartupMembersResponse,
  SubscriptionsResponse,
  SuccessResponse,
} from '../types/admin'

const auth = { auth: true as const }

// ---------------------------------------------------------------------------
// Me + overview
// ---------------------------------------------------------------------------

export function adminMe() {
  return api.get<AdminMeResponse>('/api/admin/me', auth)
}

export function adminOverview() {
  return api.get<AdminOverviewResponse>('/api/admin/overview', auth)
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function adminListUsers(params?: { search?: string; role?: string; verified?: string; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.role) qs.set('role', params.role)
  if (params?.verified) qs.set('verified', params.verified)
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return api.get<AdminUsersResponse>(`/api/admin/users${suffix}`, auth)
}

export function adminUpdateUser(userId: string, patch: Record<string, unknown>) {
  return api.patch<SuccessResponse>(`/api/admin/users/${userId}`, patch, auth)
}

export function adminVerifyUser(userId: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/verify`, {}, auth)
}

export function adminSuspendUser(userId: string, reason: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/suspend`, { reason }, auth)
}

export function adminUnsuspendUser(userId: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/unsuspend`, {}, auth)
}

export function adminBanUser(userId: string, reason: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/ban`, { reason }, auth)
}

export function adminUnbanUser(userId: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/unban`, {}, auth)
}

export function adminChangeRole(userId: string, role: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/change-role`, { role }, auth)
}

export function adminResetPassword(userId: string, newPassword: string) {
  return api.post<SuccessResponse>(`/api/admin/users/${userId}/reset-password`, { new_password: newPassword }, auth)
}

export function adminDeleteUser(userId: string) {
  return api.delete<SuccessResponse>(`/api/admin/users/${userId}`, auth)
}

// ---------------------------------------------------------------------------
// Startups
// ---------------------------------------------------------------------------

export function adminListStartups(params?: { search?: string; status?: string; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.status) qs.set('status', params.status)
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return api.get<AdminStartupsResponse>(`/api/admin/startups${suffix}`, auth)
}

export function adminUpdateStartup(startupId: string, patch: Partial<AdminStartup>) {
  return api.patch<SuccessResponse>(`/api/admin/startups/${startupId}`, patch, auth)
}

export function adminDeleteStartup(startupId: string) {
  return api.delete<SuccessResponse>(`/api/admin/startups/${startupId}`, auth)
}

// ---------------------------------------------------------------------------
// Meetings moderation
// ---------------------------------------------------------------------------

export function adminListMeetings(params?: { search?: string; status?: string; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.status) qs.set('status', params.status)
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return api.get<AdminMeetingsResponse>(`/api/admin/meetings${suffix}`, auth)
}

export function adminUpdateMeeting(meetingId: string, patch: Record<string, unknown>) {
  return api.patch<SuccessResponse>(`/api/admin/meetings/${meetingId}`, patch, auth)
}

export function adminDeleteMeeting(meetingId: string) {
  return api.delete<SuccessResponse>(`/api/admin/meetings/${meetingId}`, auth)
}

// ---------------------------------------------------------------------------
// Investors
// ---------------------------------------------------------------------------

export function adminListInvestors(params?: { search?: string; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return api.get<AdminInvestorsResponse>(`/api/admin/investors${suffix}`, auth)
}

// ---------------------------------------------------------------------------
// Messages (admin metadata)
// ---------------------------------------------------------------------------

export function adminListMessages(params?: { search?: string; chatId?: string; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.search) qs.set('search', params.search)
  if (params?.chatId) qs.set('chat_id', params.chatId)
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return api.get<AdminMessagesResponse>(`/api/admin/messages${suffix}`, auth)
}

// ---------------------------------------------------------------------------
// Role requests
// ---------------------------------------------------------------------------

export function adminListRoleRequests(status?: string) {
  const suffix = status ? `?status=${status}` : ''
  return api.get<RoleRequestsResponse>(`/api/admin/role-requests${suffix}`, auth)
}

export function adminApproveRoleRequest(requestId: string, note?: string) {
  return api.post<SuccessResponse>(`/api/admin/role-requests/${requestId}/approve`, { note }, auth)
}

export function adminRejectRoleRequest(requestId: string, note?: string) {
  return api.post<SuccessResponse>(`/api/admin/role-requests/${requestId}/reject`, { note }, auth)
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export function adminListReports(status?: string) {
  const suffix = status ? `?status=${status}` : ''
  return api.get<ReportsResponse>(`/api/admin/reports${suffix}`, auth)
}

export function adminResolveReport(reportId: string, note?: string) {
  return api.post<SuccessResponse>(`/api/admin/reports/${reportId}/resolve`, { note }, auth)
}

export function adminDismissReport(reportId: string, note?: string) {
  return api.post<SuccessResponse>(`/api/admin/reports/${reportId}/dismiss`, { note }, auth)
}

// ---------------------------------------------------------------------------
// Analytics + health
// ---------------------------------------------------------------------------

export function adminAnalytics() {
  return api.get<AnalyticsResponse>('/api/admin/analytics', auth)
}

export function adminHealth() {
  return api.get<HealthResponse>('/api/admin/health', auth)
}

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export function adminAuditLogs(action?: string, limit = 100) {
  const qs = new URLSearchParams()
  qs.set('limit', String(limit))
  if (action) qs.set('action', action)
  return api.get<AuditLogsResponse>(`/api/admin/audit-logs?${qs.toString()}`, auth)
}

// ---------------------------------------------------------------------------
// Admin notifications
// ---------------------------------------------------------------------------

export function adminNotifications(unread?: boolean, limit = 50) {
  const qs = new URLSearchParams()
  qs.set('limit', String(limit))
  if (unread) qs.set('unread', 'true')
  return api.get<AdminNotificationsResponse>(`/api/admin/notifications?${qs.toString()}`, auth)
}

export function adminNotificationRead(id: string) {
  return api.post<SuccessResponse>(`/api/admin/notifications/${id}/read`, {}, auth)
}

export function adminNotificationsReadAll() {
  return api.post<SuccessResponse>('/api/admin/notifications/read-all', {}, auth)
}

export function adminNotificationDelete(id: string) {
  return api.delete<SuccessResponse>(`/api/admin/notifications/${id}`, auth)
}

// ---------------------------------------------------------------------------
// CMS
// ---------------------------------------------------------------------------

export function adminSiteContent() {
  return api.get<SiteContentResponse>('/api/admin/cms/site-content', auth)
}

export function adminPutSiteContent(key: string, patch: { title?: string; content?: string; meta?: Record<string, unknown> }) {
  return api.put<SuccessResponse>(`/api/admin/cms/site-content/${key}`, patch, auth)
}

export function adminBlogPosts() {
  return api.get<BlogPostsResponse>('/api/admin/cms/blog', auth)
}

export function adminCreateBlogPost(post: Partial<BlogPost>) {
  return api.post<BlogPost>('/api/admin/cms/blog', post, auth)
}

export function adminUpdateBlogPost(postId: string, patch: Partial<BlogPost>) {
  return api.patch<SuccessResponse>(`/api/admin/cms/blog/${postId}`, patch, auth)
}

export function adminDeleteBlogPost(postId: string) {
  return api.delete<SuccessResponse>(`/api/admin/cms/blog/${postId}`, auth)
}

export function adminAnnouncements() {
  return api.get<AnnouncementsResponse>('/api/admin/cms/announcements', auth)
}

export function adminCreateAnnouncement(ann: Partial<Announcement>) {
  return api.post<Announcement>('/api/admin/cms/announcements', ann, auth)
}

export function adminUpdateAnnouncement(id: string, patch: Partial<Announcement>) {
  return api.patch<SuccessResponse>(`/api/admin/cms/announcements/${id}`, patch, auth)
}

export function adminDeleteAnnouncement(id: string) {
  return api.delete<SuccessResponse>(`/api/admin/cms/announcements/${id}`, auth)
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

export function adminAiUsage(limit = 100) {
  return api.get<AiUsageResponse>(`/api/admin/ai/usage?limit=${limit}`, auth)
}

export function adminAiAnalytics() {
  return api.get<AiAnalyticsResponse>('/api/admin/ai/analytics', auth)
}

// ---------------------------------------------------------------------------
// Settings + security
// ---------------------------------------------------------------------------

export function adminSettings() {
  return api.get<SettingsResponse>('/api/admin/settings', auth)
}

export function adminPutSettings(settings: SettingsMap) {
  return api.put<SuccessResponse>('/api/admin/settings', { settings }, auth)
}

export function adminLoginLogs(limit = 100) {
  return api.get<LoginLogsResponse>(`/api/admin/security/login-logs?limit=${limit}`, auth)
}

export function adminSecuritySettings(settings: Record<string, unknown>) {
  return api.post<SuccessResponse>('/api/admin/security/settings', { settings }, auth)
}

// ---------------------------------------------------------------------------
// Subscriptions + startup members
// ---------------------------------------------------------------------------

export function adminSubscriptions(status?: string) {
  const suffix = status ? `?status=${status}` : ''
  return api.get<SubscriptionsResponse>(`/api/admin/subscriptions${suffix}`, auth)
}

export function adminStartupMembers(startupId?: string) {
  const suffix = startupId ? `?startup_id=${startupId}` : ''
  return api.get<StartupMembersResponse>(`/api/admin/startup-members${suffix}`, auth)
}

export function adminAddStartupMember(input: { startup_id: string; user_id: string; permission: string }) {
  return api.post<Record<string, unknown>>('/api/admin/startup-members', input, auth)
}

export function adminRemoveStartupMember(startupId: string, userId: string) {
  return api.delete<SuccessResponse>(`/api/admin/startup-members/${startupId}/${userId}`, auth)
}
