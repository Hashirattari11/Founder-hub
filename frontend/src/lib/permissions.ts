import type { Profile, Role } from '../types'

export type Permission =
  | 'startup.create'
  | 'startup.edit'
  | 'startup.publish'
  | 'startup.manage'
  | 'startup.data_room'
  | 'startup.funding_requests'
  | 'startup.discover'
  | 'jobs.discover'
  | 'jobs.apply'
  | 'investor.discover'
  | 'investor.preferences'
  | 'investor.pipeline'
  | 'investor.saved'
  | 'investor.data_room_request'
  | 'investor.meetings'
  | 'investor.compare'
  | 'investor.notes'
  | 'investor.portfolio_tracker'
  | 'talent.apply'
  | 'talent.portfolio'
  | 'talent.resume'
  | 'talent.invitations'
  | 'talent.opportunities'
  | 'designer.portfolio'
  | 'designer.opportunities'
  | 'designer.projects'
  | 'designer.branding'
  | 'designer.collaboration'
  | 'designer.brief_generator'
  | 'marketer.opportunities'
  | 'marketer.requests'
  | 'marketer.seo_audit'
  | 'marketer.competitor_analysis'
  | 'marketer.content_planner'
  | 'marketer.campaigns'
  | 'marketer.growth_strategy'
  | 'marketer.social_planner'
  | 'marketer.analytics'
  | 'mentor.profile'
  | 'mentor.requests'
  | 'mentor.sessions'
  | 'mentor.matching'
  | 'recruiter.candidates'
  | 'recruiter.jobs'
  | 'recruiter.pipeline'
  | 'recruiter.discovery'
  | 'analyst.tools'
  | 'analyst.startup_analysis'
  | 'analyst.market_analysis'
  | 'analyst.financial_analysis'
  | 'analyst.reports'
  | 'legal.requests'
  | 'legal.documents'
  | 'legal.compliance'
  | 'legal.sessions'
  | 'legal.cases'
  | 'community.engage'
  | 'connections.manage'
  | 'meetings.manage'
  | 'chat.message'
  | 'ai.studio'
  | 'cofounder.match'
  | 'business_plan'
  | 'team.manage'
  | 'analytics.founder'
  | 'admin.manage'
  | 'admin.users'
  | 'admin.startups'
  | 'admin.meetings'
  | 'admin.role_requests'
  | 'admin.reports'
  | 'admin.analytics'
  | 'admin.emails'
  | 'admin.audit_logs'
  | 'admin.health'
  | 'admin.notifications'
  | 'admin.cms'
  | 'admin.ai'
  | 'admin.settings'
  | 'admin.security'
  | 'admin.subscriptions'

const STARTUP = new Set<Permission>([
  'startup.create',
  'startup.edit',
  'startup.publish',
  'startup.manage',
  'startup.data_room',
  'startup.funding_requests',
])
const INVESTOR = new Set<Permission>([
  'investor.discover',
  'investor.preferences',
  'investor.pipeline',
  'investor.saved',
  'investor.data_room_request',
  'investor.meetings',
  'investor.compare',
  'investor.notes',
  'investor.portfolio_tracker',
])
const TALENT = new Set<Permission>([
  'talent.apply',
  'talent.portfolio',
  'talent.resume',
  'talent.invitations',
  'talent.opportunities',
])
const DESIGNER = new Set<Permission>([
  ...TALENT,
  'designer.portfolio',
  'designer.opportunities',
  'designer.projects',
  'designer.branding',
  'designer.collaboration',
  'designer.brief_generator',
])
const MARKETER = new Set<Permission>([
  ...TALENT,
  'marketer.opportunities',
  'marketer.requests',
  'marketer.seo_audit',
  'marketer.competitor_analysis',
  'marketer.content_planner',
  'marketer.campaigns',
  'marketer.growth_strategy',
  'marketer.social_planner',
  'marketer.analytics',
])
const MENTOR = new Set<Permission>([
  'mentor.profile',
  'mentor.requests',
  'mentor.sessions',
  'mentor.matching',
])
const RECRUITER = new Set<Permission>([
  'recruiter.candidates',
  'recruiter.jobs',
  'recruiter.pipeline',
  'recruiter.discovery',
])
const ANALYST = new Set<Permission>([
  'analyst.tools',
  'analyst.startup_analysis',
  'analyst.market_analysis',
  'analyst.financial_analysis',
  'analyst.reports',
])
const LEGAL = new Set<Permission>([
  'legal.requests',
  'legal.documents',
  'legal.compliance',
  'legal.sessions',
  'legal.cases',
])
const COMMON = new Set<Permission>([
  'startup.discover',
  'jobs.discover',
  'jobs.apply',
  'community.engage',
  'connections.manage',
  'meetings.manage',
  'chat.message',
  'ai.studio',
  'cofounder.match',
])
const ADMIN = new Set<Permission>([
  'admin.manage',
  'admin.users',
  'admin.startups',
  'admin.meetings',
  'admin.role_requests',
  'admin.reports',
  'admin.analytics',
  'admin.emails',
  'admin.audit_logs',
  'admin.health',
  'admin.notifications',
  'admin.cms',
  'admin.ai',
  'admin.settings',
  'admin.security',
  'admin.subscriptions',
])

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  founder: new Set<Permission>([
    ...STARTUP,
    ...COMMON,
    'business_plan',
    'team.manage',
    'analytics.founder',
  ]),
  investor: new Set<Permission>([...INVESTOR, ...COMMON]),
  developer: new Set<Permission>([...TALENT, ...COMMON]),
  designer: new Set<Permission>([...DESIGNER, ...COMMON]),
  marketer: new Set<Permission>([...MARKETER, ...COMMON]),
  mentor: new Set<Permission>([...MENTOR, ...COMMON]),
  recruiter: new Set<Permission>([...RECRUITER, ...COMMON]),
  business_analyst: new Set<Permission>([...ANALYST, ...COMMON]),
  legal_advisor: new Set<Permission>([...LEGAL, ...COMMON]),
  administrator: new Set<Permission>([
    ...COMMON,
    ...STARTUP,
    ...INVESTOR,
    ...TALENT,
    ...MENTOR,
    ...RECRUITER,
    ...ANALYST,
    ...LEGAL,
    ...ADMIN,
    'business_plan',
    'team.manage',
    'analytics.founder',
  ]),
}

/** Roles that count as administrators (can manage the platform). */
export const ADMIN_ROLES: Role[] = ['administrator']

const ROLE_DASHBOARD: Partial<Record<Role, string>> = {
  founder: '/dashboard',
  investor: '/dashboard',
  developer: '/dashboard',
  designer: '/dashboard',
  marketer: '/dashboard',
  mentor: '/dashboard',
  recruiter: '/dashboard',
  business_analyst: '/dashboard',
  legal_advisor: '/dashboard',
  administrator: '/admin',
}

export const PROFESSIONAL_ROLES: Role[] = [
  'mentor',
  'recruiter',
  'business_analyst',
  'legal_advisor',
]

/** Permissions granted by a single role. */
export function permissionsForRole(role: Role | null | undefined): Set<Permission> {
  if (!role) return new Set()
  return ROLE_PERMISSIONS[role] ?? new Set()
}

/** All permissions for the user's primary role. */
export function userPermissions(profile: Pick<Profile, 'role' | 'is_admin'> | null): Set<Permission> {
  const perms = permissionsForRole(profile?.role)
  if (profile?.is_admin) return new Set([...perms, ...ADMIN])
  return perms
}

/** True when the user holds a permission through their current role. */
export function hasPermission(
  profile: Pick<Profile, 'role' | 'is_admin'> | null | undefined,
  permission: Permission,
): boolean {
  return userPermissions(profile ?? null).has(permission)
}

/** The landing dashboard for a role. */
export function dashboardForRole(
  profile: Pick<Profile, 'role' | 'is_admin'> | null | undefined,
): string {
  if (!profile) return '/login'
  const role = profile.role ?? 'founder'
  return ROLE_DASHBOARD[role] ?? '/dashboard'
}

/** True when the user may access a guarded route (path prefix match). */
export function canAccess(
  profile: Pick<Profile, 'role' | 'is_admin'> | null | undefined,
  path: string,
): boolean {
  const p = profile ?? null
  if (!p) return false
  const role = p.role ?? 'founder'
  if (role === 'administrator' || p.is_admin) return true

  const pathMap: Array<[string, Permission]> = [
    ['/startups/create', 'startup.create'],
    ['/startups/my', 'startup.manage'],
    ['/funding-requests', 'startup.funding_requests'],
    ['/business-plan', 'business_plan'],
    ['/data-room', 'startup.data_room'],
    ['/investors', 'investor.discover'],
    ['/investor/requests', 'investor.pipeline'],
    ['/investor/preferences', 'investor.preferences'],
    ['/investor/setup', 'investor.preferences'],
    ['/portfolio', 'investor.saved'],
    ['/dashboard/saved', 'investor.saved'],
    ['/analytics', 'analytics.founder'],
    ['/resume', 'talent.resume'],
    ['/resume-builder', 'talent.resume'],
    ['/cofounder', 'cofounder.match'],
    ['/dashboard/my-applications', 'talent.apply'],
    ['/dashboard/job-applications', 'jobs.apply'],
    ['/jobs/post', 'recruiter.jobs'],
    ['/dashboard/manage-jobs', 'recruiter.jobs'],
    ['/recruiter', 'recruiter.candidates'],
    ['/mentor', 'mentor.profile'],
    ['/legal', 'legal.requests'],
    ['/designer', 'designer.portfolio'],
    ['/marketer', 'marketer.opportunities'],
  ]
  const match = pathMap.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))
  if (match) return hasPermission(p, match[1])
  return true
}
