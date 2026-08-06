export interface AdminMeProfile {
  id: string
  full_name: string | null
  username: string | null
  role: string
  is_admin: boolean
  is_super_admin: boolean
  is_verified: boolean
  is_premium: boolean
  avatar_url: string | null
  email: string | null
  created_at: string
}

export interface Permission {
  code: string
  name: string
  module: string
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
    today: { day: string; requests: number; errors: number; avg_latency_ms: number } | null
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
  created_at: string
}

export interface AdminUsersResponse {
  users: AdminUser[]
}

export interface AdminStartup {
  id: string
  founder_id: string
  name: string
  tagline: string | null
  industry: string | null
  stage: string | null
  is_published: boolean
  is_featured: boolean
  is_verified: boolean
  is_hidden: boolean
  created_at: string
  founder_name: string | null
  founder_username: string | null
}

export interface AdminStartupsResponse {
  startups: AdminStartup[]
}

export interface RoleRequest {
  id: string
  user_id: string
  requested_role: string
  current_role: string | null
  status: 'pending' | 'approved' | 'rejected'
  reason: string | null
  created_at: string
  user_name: string | null
  user_email: string | null
}

export interface RoleRequestsResponse {
  requests: RoleRequest[]
}

export interface ReportItem {
  id: string
  reporter_id: string
  target_type: string
  target_id: string
  reason: string
  status: 'open' | 'resolved' | 'dismissed'
  created_at: string
  reporter_name: string | null
  target_name: string | null
}

export interface ReportsResponse {
  reports: ReportItem[]
}

export interface AdminNotification {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

export interface AdminNotificationsResponse {
  notifications: AdminNotification[]
  unread: number
}

export interface AnalyticsResponse {
  registrations_30d: { day: string; count: number }[]
  request_stats: {
    today: { day: string; requests: number; errors: number; avg_latency_ms: number } | null
    totals: { requests: number; errors: number; avg_latency_ms: number } | null
    by_endpoint: { endpoint: string; requests: number; errors: number; avg_latency_ms: number }[] | null
  } | null
  dau: number
  mau: number
}

export interface StartupMemberAdmin {
  startup_id: string
  user_id: string
  permission: 'owner' | 'admin' | 'editor' | 'viewer'
  created_at: string
  user_name: string | null
  startup_name?: string | null
}

export interface StartupMembersResponse {
  members: StartupMemberAdmin[]
}

export interface SuccessResponse {
  success: boolean
}
