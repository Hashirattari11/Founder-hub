// ---------------------------------------------------------------------------
// Phase 17 — Enterprise Admin platform types (mirrors backend /api/admin)
// ---------------------------------------------------------------------------

export interface AdminMeProfile {
  id: string
  full_name: string | null
  username: string | null
  role: string | null
  is_admin: boolean
  is_super_admin: boolean
  is_verified: boolean
  is_premium: boolean
  avatar_url: string | null
  created_at: string | null
  email: string | null
}

export interface Permission {
  code: string
  name: string
  description?: string | null
  module?: string | null
}

export interface AdminMeResponse {
  profile: AdminMeProfile
  unread_notifications: number
  permissions: Permission[]
}

export interface AdminOverviewResponse {
  users: { total: number; new_7d: number }
  startups: { total: number; published: number }
  investors: number
  role_requests: { pending: number }
  reports: { open: number }
  notifications: { unread: number }
  subscriptions: { active: number; mrr_cents: number }
  request_stats: {
    today: { requests: number; errors: number; avg_latency_ms: number } | null
  }
}

export interface AdminUser {
  id: string
  full_name: string | null
  username: string | null
  email: string | null
  role: string
  is_admin: boolean
  is_super_admin: boolean
  is_verified: boolean
  is_premium: boolean
  is_suspended: boolean
  is_banned: boolean
  created_at: string | null
}

export interface AdminUsersResponse {
  users: AdminUser[]
}

export interface AdminStartup {
  id: string
  name: string
  tagline: string | null
  industry: string | null
  stage: string | null
  location: string | null
  is_published: boolean
  is_featured: boolean
  is_verified: boolean
  is_hidden: boolean
  founder_id: string | null
  founder_name: string | null
  created_at: string | null
}

export interface AdminStartupsResponse {
  startups: AdminStartup[]
}

export interface AdminMeeting {
  id: string
  title: string
  description: string | null
  scheduled_at: string | null
  status: string
  duration_minutes: number
  meet_link: string | null
  organizer_id: string | null
  participant_id: string | null
  startup_id: string | null
  created_at: string | null
  started_at: string | null
  ended_at: string | null
  transcript: string | null
  ai_summary: Record<string, unknown> | null
  recording_url: string | null
  organizer_name: string | null
  participant_name: string | null
  has_transcript: boolean
  has_summary: boolean
}

export interface AdminMeetingsResponse {
  meetings: AdminMeeting[]
}

export interface AdminInvestor {
  id: string
  full_name: string | null
  username: string | null
  company: string | null
  role: string | null
  investment_range_min: number | null
  investment_range_max: number | null
  investment_stage: string[] | null
  portfolio_companies: string[] | null
  is_verified: boolean
  is_premium: boolean
  email: string | null
  created_at: string | null
}

export interface AdminInvestorsResponse {
  investors: AdminInvestor[]
}

export type RoleRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface RoleRequest {
  id: string
  user_id: string
  from_role: string | null
  requested_role: string
  reason: string | null
  status: RoleRequestStatus
  admin_id: string | null
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
  user_name?: string | null
}

export interface RoleRequestsResponse {
  requests: RoleRequest[]
}

export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed'

export interface ReportItem {
  id: string
  reporter_id: string | null
  report_type: string
  target_type: string
  target_id: string | null
  description: string | null
  status: ReportStatus
  admin_id: string | null
  admin_note: string | null
  created_at: string
  resolved_at: string | null
  reporter_name?: string | null
}

export interface ReportsResponse {
  reports: ReportItem[]
}

export interface AdminNotification {
  id: string
  type: string
  title: string
  body: string | null
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

export interface AdminNotificationsResponse {
  notifications: AdminNotification[]
}

export interface AuditLog {
  id: number
  admin_id: string | null
  admin_email: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

export interface AuditLogsResponse {
  logs: AuditLog[]
}

export type LoginStatus = 'success' | 'failed' | 'logout' | 'reset' | 'lockout'

export interface LoginLog {
  id: number
  user_id: string | null
  email: string | null
  ip: string | null
  user_agent: string | null
  device: string | null
  status: LoginStatus
  created_at: string
}

export interface LoginLogsResponse {
  logs: LoginLog[]
}

export interface AnalyticsResponse {
  users: {
    total: number
    by_role: { role: string; count: number }[]
    registrations_by_day: Record<string, number>
  }
  activity: { dau: number; mau: number; events_total: number }
  request_stats: {
    day: string
    requests: number
    errors: number
    avg_latency_ms: number
  }[]
}

export interface HealthResponse {
  status: string
  service: string
  time: string
  uptime_seconds: number
  database: { ok: boolean; latency_ms: number }
  auth: { ok: boolean; latency_ms: number }
  tables: Record<string, number>
}

export interface AiUsageLog {
  id: number
  user_id: string | null
  tool_slug: string
  provider: string | null
  status: string
  error: string | null
  created_at: string
  user_name?: string | null
}

export interface AiUsageResponse {
  logs: AiUsageLog[]
}

export interface AiAnalyticsResponse {
  total_runs: number
  successful_runs: number
  failed_runs: number
  last_24h: number
  by_tool: { tool: string; runs: number }[]
  by_provider: { provider: string; runs: number }[]
}

export type SettingsMap = Record<string, Record<string, unknown> | unknown>

export interface SettingsResponse {
  settings: SettingsMap
}

export interface SubscriptionAdmin {
  id: string
  user_id: string
  plan: string
  status: string
  provider: string | null
  provider_sub_id: string | null
  amount_cents: number
  currency: string
  started_at: string
  renews_at: string | null
  canceled_at: string | null
}

export interface SubscriptionsResponse {
  subscriptions: SubscriptionAdmin[]
}

export type StartupMemberPermission = 'owner' | 'admin' | 'editor' | 'viewer'

export interface StartupMemberAdmin {
  startup_id: string
  user_id: string
  permission: StartupMemberPermission
  created_at: string
  user_name?: string | null
}

export interface StartupMembersResponse {
  members: StartupMemberAdmin[]
}

export interface SiteContent {
  key: string
  title: string | null
  content: string | null
  meta: Record<string, unknown> | null
  updated_by: string | null
  updated_at: string
}

export interface SiteContentResponse {
  content: SiteContent[]
}

export type BlogStatus = 'draft' | 'published' | 'archived'

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  cover_url: string | null
  status: BlogStatus
  author_id: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface BlogPostsResponse {
  posts: BlogPost[]
}

export interface Announcement {
  id: string
  title: string
  body: string | null
  audience: string
  is_active: boolean
  published_at: string
  created_at: string
}

export interface AnnouncementsResponse {
  announcements: Announcement[]
}

export interface SuccessResponse {
  success: boolean
  updated?: Record<string, unknown>
  previous_role?: string | null
  role?: string
  updated_keys?: string[]
}
