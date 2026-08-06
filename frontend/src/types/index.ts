export type { User } from '@supabase/supabase-js'

export type Role =
  | 'founder'
  | 'developer'
  | 'designer'
  | 'investor'
  | 'marketer'
  | 'legal_advisor'
  | 'business_analyst'
  | 'mentor'
  | 'recruiter'
  | 'administrator'

export interface Profile {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  role: Role | null
  skills: string[] | null
  country: string | null
  city: string | null
  experience_years: number | null
  linkedin_url: string | null
  github_url: string | null
  portfolio_url: string | null
  twitter_url: string | null
  is_open_to_work: boolean | null
  investor_interests: string[] | null
  investment_range_min: number | null
  investment_range_max: number | null
  investment_stage: string[] | null
  portfolio_companies: string[] | null
  notification_preferences: Record<string, boolean> | null
  preferred_ai_provider: string | null
  preferred_ai_model: string | null
  is_admin: boolean | null
  connections_count: number | null
  created_at: string
  updated_at: string
}

export const ROLES: Role[] = [
  'founder',
  'developer',
  'designer',
  'investor',
  'marketer',
  'legal_advisor',
  'business_analyst',
  'mentor',
  'recruiter',
  'administrator',
]

export const ROLE_LABELS: Record<Role, string> = {
  founder: 'Founder',
  developer: 'Developer',
  designer: 'Designer',
  investor: 'Investor',
  marketer: 'Marketer',
  legal_advisor: 'Legal Advisor',
  business_analyst: 'Business Analyst',
  mentor: 'Mentor',
  recruiter: 'Recruiter',
  administrator: 'Administrator',
}

export const SKILLS = [
  'React',
  'Node.js',
  'Python',
  'AI/ML',
  'iOS',
  'Android',
  'UI/UX Design',
  'Product Management',
  'Marketing',
  'Sales',
  'Finance',
  'Legal',
  'Blockchain',
  'DevOps',
  'Data Science',
  'Graphic Design',
  'Content Writing',
  'SEO',
  'Video Editing',
  'Business Development',
] as const

export type Skill = (typeof SKILLS)[number]

export const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: 'founder', label: 'Founder', description: 'I am building a startup and looking for teammates' },
  { value: 'developer', label: 'Developer', description: 'I build products and want to join a startup' },
  { value: 'designer', label: 'Designer', description: 'I design products and want to join a startup' },
  { value: 'marketer', label: 'Marketer', description: 'I help startups grow and reach users' },
  { value: 'investor', label: 'Investor', description: 'I fund startups and look for opportunities' },
  { value: 'legal_advisor', label: 'Legal Advisor', description: 'I provide legal guidance to founders' },
  { value: 'business_analyst', label: 'Business Analyst', description: 'I analyze business data and metrics' },
  { value: 'mentor', label: 'Mentor', description: 'I coach and guide founders and teams' },
  { value: 'recruiter', label: 'Recruiter', description: 'I help startups hire top talent' },
  { value: 'administrator', label: 'Administrator', description: 'I manage the FounderHub platform' },
]

export const ROLE_SKILLS: Record<Role, string[]> = {
  founder: [
    'Product Management',
    'Business Development',
    'Strategy',
    'Leadership',
    'Fundraising',
    'Finance',
    'Sales',
    'Marketing',
    'Operations',
    'Pitching',
    'Legal',
    'Networking',
  ],
  developer: [
    'React',
    'Node.js',
    'Python',
    'TypeScript',
    'AI/ML',
    'iOS',
    'Android',
    'DevOps',
    'Cloud',
    'Blockchain',
    'Data Science',
    'Backend',
  ],
  designer: [
    'UI/UX Design',
    'Graphic Design',
    'Branding',
    'Figma',
    'Prototyping',
    'Design Systems',
    'User Research',
    'Motion Design',
    'Illustration',
    'Video Editing',
  ],
  marketer: [
    'Marketing',
    'SEO',
    'Content Writing',
    'Social Media',
    'Growth Marketing',
    'Email Marketing',
    'Paid Ads',
    'Video Editing',
    'PR',
    'Branding',
    'Analytics',
  ],
  investor: [
    'Finance',
    'Financial Modeling',
    'Due Diligence',
    'Fundraising',
    'Networking',
    'Legal',
    'Strategy',
    'Business Development',
    'Portfolio Management',
    'Valuation',
  ],
  legal_advisor: [
    'Legal',
    'Contracts',
    'Corporate Law',
    'IP Protection',
    'Compliance',
    'Fundraising',
    'Negotiation',
    'Due Diligence',
  ],
  business_analyst: [
    'Analytics',
    'Data Science',
    'Financial Modeling',
    'Strategy',
    'Market Research',
    'Product Management',
    'SQL',
    'Excel',
    'Forecasting',
  ],
  mentor: [
    'Strategy',
    'Leadership',
    'Coaching',
    'Networking',
    'Fundraising',
    'Product Management',
    'Sales',
    'Business Development',
  ],
  recruiter: [
    'Hiring',
    'Talent Sourcing',
    'Interviewing',
    'HR',
    'Networking',
    'People Operations',
    'Employer Branding',
  ],
  administrator: [
    'Platform Management',
    'Analytics',
    'Compliance',
    'Community Management',
    'Support',
    'Security',
  ],
}

export const INVESTOR_INTERESTS = [
  'SaaS',
  'Fintech',
  'HealthTech',
  'AI/ML',
  'Consumer Apps',
  'Marketplace',
  'Developer Tools',
  'EdTech',
  'E-commerce',
  'Blockchain/Crypto',
  'Gaming',
  'Climate/GreenTech',
  'HR Tech',
  'Logistics',
  'PropTech',
  'Travel',
] as const

export interface Project {
  id: string
  title: string
  description: string
  owner_id: string
  created_at: string
  updated_at: string
}

export type StartupStage = 'idea' | 'mvp' | 'growth' | 'scaling'

export interface Startup {
  id: string
  founder_id: string
  name: string
  tagline: string | null
  description: string | null
  industry: string | null
  stage: StartupStage | null
  funding_needed: string | null
  equity_offered: number | null
  remote_friendly: boolean | null
  location: string | null
  website_url: string | null
  pitch_deck_url: string | null
  tech_stack: string[] | null
  team_roles_needed: string[] | null
  is_published: boolean
  created_at: string
  updated_at: string | null
  profiles?: Pick<
    Profile,
    'full_name' | 'avatar_url' | 'username' | 'bio' | 'linkedin_url'
  > | null
}

export type PostType = 'update' | 'milestone' | 'question' | 'hiring' | 'funding' | 'launch'

export interface Post {
  id: string
  author_id: string
  startup_id: string | null
  content: string
  media_urls: string[] | null
  post_type: PostType | null
  hashtags: string[] | null
  is_pinned: boolean
  repost_of: string | null
  views_count: number
  likes_count: number
  comments_count: number
  reposts_count: number
  created_at: string
  updated_at: string
  profiles?: Pick<
    Profile,
    'id' | 'full_name' | 'avatar_url' | 'username' | 'role' | 'city'
  > | null
  startups?: Pick<Startup, 'id' | 'name' | 'tagline' | 'industry'> | null
  reposted_from?: Post | null
}

export interface PostComment {
  id: string
  post_id: string
  author_id: string
  content: string
  parent_comment_id: string | null
  likes_count: number
  created_at: string
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'username'> | null
}

export interface Hashtag {
  id: string
  name: string
  posts_count: number
  created_at: string
}

export type FeedType = 'for_you' | 'following' | 'trending' | 'stories' | 'saved'

export type ApplicationStatus =
  | 'pending'
  | 'shortlisted'
  | 'accepted'
  | 'rejected'

export interface Application {
  id: string
  startup_id: string
  applicant_id: string
  role_applying_for: string | null
  cover_message: string | null
  status: ApplicationStatus
  created_at: string
  startups?: Pick<Startup, 'id' | 'name' | 'tagline' | 'industry'> & {
    profiles?: Pick<Profile, 'full_name' | 'avatar_url'> | null
  } | null
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'skills' | 'city'> | null
}

export type JobType =
  | 'full_time'
  | 'part_time'
  | 'remote'
  | 'internship'
  | 'contract'
  | 'freelance'

export type JobExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead'

export type JobApplicationStatus =
  | 'pending'
  | 'reviewing'
  | 'shortlisted'
  | 'interview'
  | 'accepted'
  | 'rejected'

export interface Job {
  id: string
  startup_id: string | null
  posted_by: string
  title: string
  description: string
  requirements: string[] | null
  nice_to_have: string[] | null
  job_type: JobType | null
  location: string | null
  is_remote: boolean
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  equity_offered: number | null
  experience_level: JobExperienceLevel | null
  skills_required: string[] | null
  industry: string | null
  application_deadline: string | null
  is_active: boolean
  views_count: number
  applications_count: number
  created_at: string
  startups?: Pick<Startup, 'id' | 'name' | 'tagline' | 'industry'> | null
  profiles?: Pick<Profile, 'full_name' | 'avatar_url'> | null
  matchScore?: number
}

export interface JobApplication {
  id: string
  job_id: string
  applicant_id: string
  cover_letter: string | null
  resume_url: string | null
  portfolio_url: string | null
  expected_salary: number | null
  availability: string | null
  status: JobApplicationStatus
  notes: string | null
  created_at: string
  jobs?: Pick<Job, 'id' | 'title' | 'job_type' | 'location' | 'is_remote' | 'created_at' | 'startup_id'> & {
    startups?: Pick<Startup, 'id' | 'name' | 'tagline' | 'industry'> | null
  } | null
  profiles?: Pick<
    Profile,
    'id' | 'full_name' | 'avatar_url' | 'role' | 'city' | 'skills' | 'experience_years' | 'bio' | 'portfolio_url'
  > | null
}

export interface Resume {
  id: string
  user_id: string
  title: string | null
  content: Record<string, unknown> | null
  pdf_url: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface SavedJob {
  user_id: string
  job_id: string
  created_at: string
}

export const JOB_TYPES: { id: JobType; label: string }[] = [
  { id: 'full_time', label: 'Full Time' },
  { id: 'part_time', label: 'Part Time' },
  { id: 'remote', label: 'Remote' },
  { id: 'internship', label: 'Internship' },
  { id: 'contract', label: 'Contract' },
  { id: 'freelance', label: 'Freelance' },
]

export const JOB_EXPERIENCE_LEVELS: { id: JobExperienceLevel; label: string }[] = [
  { id: 'entry', label: 'Entry' },
  { id: 'mid', label: 'Mid' },
  { id: 'senior', label: 'Senior' },
  { id: 'lead', label: 'Lead' },
]

export const JOB_STATUS_LABELS: Record<JobApplicationStatus, string> = {
  pending: 'Pending',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

export type NotificationType =
  | 'startup_match'
  | 'new_application'
  | 'status_update'
  | 'message'
  | 'job_application'
  | 'job_status_update'
  | 'cofounder_request'
  | 'cofounder_accepted'
  | 'investor_request'
  | 'investor_interested'

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType | string
  title: string
  body: string
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

export type ConnectionStatus = 'pending' | 'accepted'

export interface ConnectionRow {
  requester_id: string
  receiver_id: string
  status: ConnectionStatus
  created_at: string
}

export type CoFounderCommitment = 'full_time' | 'part_time' | 'flexible'
export type CoFounderLocation = 'same_city' | 'same_country' | 'remote_ok'
export type CoFounderRequestStatus = 'pending' | 'accepted' | 'rejected'

export interface CoFounderPreference {
  id: string
  user_id: string
  looking_for_roles: string[] | null
  industry_focus: string[] | null
  commitment_level: CoFounderCommitment | null
  equity_willing_to_give: number | null
  startup_stage: string | null
  location_preference: CoFounderLocation | null
  description: string | null
  is_looking: boolean
  created_at?: string
}

export interface CoFounderMatch {
  profile: Pick<
    Profile,
    'id' | 'full_name' | 'username' | 'avatar_url' | 'bio' | 'role' | 'skills' | 'city' | 'country' | 'experience_years'
  >
  preferences: CoFounderPreference | null
  score: number
  reasons: string[]
  complementary_role?: string | null
}

export interface CoFounderMatchesResponse {
  matches: CoFounderMatch[]
  show_cofounder: boolean
  user_role?: string | null
  looking_for_roles?: string[] | null
  tab_label?: string | null
  description?: string | null
  message?: string | null
}

export interface CoFounderRequest {
  id: string
  requester_id: string
  target_id: string
  match_score: number | null
  message: string | null
  status: CoFounderRequestStatus
  created_at: string
  requester?: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'bio' | 'role' | 'skills' | 'city'> | null
  target?: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'bio' | 'role' | 'skills' | 'city'> | null
}

export type InvestorMatchStatus = 'pending' | 'viewed' | 'interested' | 'passed' | 'meeting_scheduled'

export interface InvestorProfile {
  id: string
  user_id: string
  investment_thesis: string | null
  portfolio_companies: string[] | null
  check_size_min: number | null
  check_size_max: number | null
  preferred_industries: string[] | null
  preferred_stages: string[] | null
  preferred_locations: string[] | null
  value_add: string | null
  total_investments: number | null
  is_active: boolean
  created_at?: string
}

export interface InvestorMatch {
  id: string
  startup_id: string
  investor_id: string
  founder_id: string
  match_score: number | null
  status: InvestorMatchStatus
  message: string | null
  created_at: string
  reasons?: string[]
  investor?: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'bio' | 'role' | 'skills' | 'city'> | null
  investor_profile?: InvestorProfile | null
}

export interface InvestorMatchResult {
  match_id: string | null
  status: InvestorMatchStatus
  score: number
  reasons: string[]
  investor: Pick<Profile, 'id' | 'full_name' | 'username' | 'avatar_url' | 'bio' | 'role' | 'skills' | 'city'> & {
    investor_profiles?: InvestorProfile | null
  }
}

export interface ChatProfile {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  role: Role | null
  is_online: boolean | null
  last_seen: string | null
}

export interface Chat {
  id: string
  participant_1: string
  participant_2: string
  last_message: string | null
  last_message_at: string | null
  created_at: string
  participant_1_profile?: ChatProfile | null
  participant_2_profile?: ChatProfile | null
}

export type ChatMessageType = 'text' | 'image' | 'file' | 'voice'

export interface MessageReaction {
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface RepliedMessage {
  id: string
  content: string | null
  type: ChatMessageType
  sender_id: string
  file_url?: string | null
  is_deleted?: boolean
  is_forwarded?: boolean
  sender?: Pick<Profile, 'full_name' | 'avatar_url'> | null
}

export interface ChatMessage {
  id: string
  chat_id: string
  sender_id: string
  content: string | null
  type: ChatMessageType
  file_url: string | null
  file_name: string | null
  file_size: number | null
  is_read: boolean
  created_at: string
  edited_at?: string | null
  is_deleted?: boolean
  is_forwarded?: boolean
  deleted_for?: string[] | null
  reply_to_id?: string | null
  reply_to?: RepliedMessage | null
  sender?: Pick<Profile, 'full_name' | 'avatar_url'> | null
  reactions?: MessageReaction[] | null
}

// ---------------------------------------------------------------------------
// Startup Data Room
// ---------------------------------------------------------------------------

export type DataRoomCategory =
  | 'pitch_deck'
  | 'financials'
  | 'legal'
  | 'cap_table'
  | 'product'
  | 'team'
  | 'market_research'
  | 'contracts'
  | 'other'

export interface DataRoom {
  id: string
  startup_id: string
  founder_id: string
  name: string
  description: string | null
  is_active: boolean
  require_nda: boolean
  nda_text: string | null
  created_at: string
}

export interface DataRoomDocument {
  id: string
  data_room_id: string
  uploaded_by: string
  category: DataRoomCategory
  name: string
  file_url: string
  file_size: number | null
  file_type: string | null
  description: string | null
  is_confidential: boolean
  views_count: number
  downloads_count: number
  created_at: string
}

export interface DataRoomAccess {
  id: string
  data_room_id: string
  user_id: string
  granted_by: string
  access_level: 'view' | 'download' | 'full'
  nda_signed: boolean
  nda_signed_at: string | null
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface DataRoomAccessRequest {
  id: string
  data_room_id: string
  requester_id: string
  message: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  requester?: Pick<Profile, 'full_name' | 'avatar_url' | 'role'> | null
}

export interface DataRoomActivityItem {
  id: string
  document_id: string
  user_id: string
  action: 'viewed' | 'downloaded' | 'shared'
  created_at: string
  document?: { name: string } | null
  user?: Pick<Profile, 'full_name' | 'avatar_url'> | null
}

export interface DataRoomResponse {
  startup: Pick<Startup, 'id' | 'name' | 'founder_id' | 'tagline' | 'industry'>
  can_manage: boolean
  data_room: DataRoom | null
  documents: DataRoomDocument[]
  request_status: 'pending' | 'approved' | 'rejected' | null
  categories: Record<string, string>
  access?: DataRoomAccess | null
  nda_required: boolean
  nda_pending: boolean
}

// ---------------------------------------------------------------------------
// Cap Table
// ---------------------------------------------------------------------------

export type HolderType = 'founder' | 'investor' | 'employee' | 'advisor' | 'esop' | 'other'
export type ShareClass = 'common' | 'preferred' | 'options' | 'warrants'
export type RoundStatus = 'open' | 'closed' | 'cancelled'

export interface CapTable {
  id: string
  startup_id: string
  created_by: string
  total_shares: number
  currency: string
  last_updated: string
  created_at: string
}

export interface CapTableEntry {
  id: string
  cap_table_id: string
  holder_name: string
  holder_type: HolderType
  holder_user_id: string | null
  shares: number
  share_class: ShareClass
  investment_amount: number | null
  investment_date: string | null
  vesting_start: string | null
  vesting_cliff_months: number | null
  vesting_total_months: number | null
  notes: string | null
  created_at: string
}

export interface FundingRound {
  id: string
  startup_id: string
  round_name: string
  round_type: string
  target_amount: number | null
  raised_amount: number | null
  pre_money_valuation: number | null
  post_money_valuation: number | null
  share_price: number | null
  status: RoundStatus
  open_date: string | null
  close_date: string | null
  created_at: string
}

export interface CapTableResponse {
  startup: Pick<Startup, 'id' | 'name' | 'founder_id' | 'tagline' | 'industry'>
  can_manage: boolean
  cap_table: CapTable | null
  entries: CapTableEntry[]
  rounds: FundingRound[]
}

// ---------------------------------------------------------------------------
// Equity & Cap Table (extended module)
// ---------------------------------------------------------------------------

export type EquityHolderType = HolderType
export type ShareClassType = ShareClass
export type RoundType =
  | 'pre_seed'
  | 'seed'
  | 'series_a'
  | 'series_b'
  | 'series_c'
  | 'bridge'
  | 'angel'
  | 'grant'
  | 'other'
export type InvestmentRoundStatus = 'planned' | 'open' | 'closed' | 'cancelled'
export type ScheduleType = 'standard' | 'cliff_only' | 'accelerated' | 'custom'
export type VestingFrequency = 'monthly' | 'quarterly' | 'annually'

export interface ShareClassDef {
  id: string
  cap_table_id: string
  name: string
  class_type: ShareClassType
  par_value: number | null
  liquidation_preference: number | null
  voting_rights: boolean
  conversion_ratio: number | null
  notes: string | null
  created_at: string
}

export interface VestingSchedule {
  id: string
  holder_id: string
  schedule_type: ScheduleType
  start_date: string | null
  cliff_months: number | null
  total_months: number | null
  vesting_frequency: VestingFrequency
  exercise_price: number | null
  acceleration_on_sale: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface EquityHolder {
  id: string
  cap_table_id: string
  name: string
  email: string | null
  title: string | null
  holder_type: EquityHolderType
  share_class_id: string | null
  user_id: string | null
  shares: number
  equity_percent: number | null
  investment_amount: number | null
  investment_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  vesting_schedules: VestingSchedule[]
  ownership_pct: number
  vested_shares: number | null
  vested_pct: number
  share_class_name: string | null
  share_class_type: ShareClassType | null
}

export interface InvestmentRound {
  id: string
  cap_table_id: string
  round_name: string
  round_type: RoundType
  target_amount: number | null
  raised_amount: number | null
  pre_money_valuation: number | null
  post_money_valuation: number | null
  new_shares_issued: number | null
  share_price: number | null
  status: InvestmentRoundStatus
  open_date: string | null
  close_date: string | null
  created_at: string
}

export interface EquityCapTable extends CapTable {
  esop_pool_shares: number
  default_vesting_cliff_months: number
  default_vesting_total_months: number
}

export interface EquitySummary {
  total_shares: number
  allocated_shares: number
  unallocated_shares: number
  allocated_pct: number
  unallocated_pct: number
  by_holder_type: Record<EquityHolderType, { shares: number; pct: number }>
  founder_pct: number
  investor_pct: number
  employee_pct: number
  advisor_pct: number
  esop_pct: number
  other_pct: number
  by_share_class: Record<string, { name: string; class_type: ShareClassType; shares: number; pct: number }>
  esop_pool_shares: number
  valuation: number | null
}

export interface EquityDashboardResponse {
  startup: Pick<Startup, 'id' | 'name' | 'founder_id' | 'tagline' | 'industry'>
  can_manage: boolean
  cap_table: EquityCapTable | null
  share_classes: ShareClassDef[]
  holders: EquityHolder[]
  rounds: InvestmentRound[]
  summary: EquitySummary
}

export interface DilutionRow {
  id: string
  name: string
  holder_type: EquityHolderType
  shares: number
  before_pct: number
  after_pct: number
  dilution_pp: number
}

export interface DilutionResult {
  raise_amount: number
  pre_money_valuation: number
  post_money_valuation: number
  new_shares: number
  new_total: number
  investor_pct: number
  holders: DilutionRow[]
}

export interface MyCapTableItem {
  startup: Pick<Startup, 'id' | 'name' | 'tagline' | 'industry'>
  cap_table: EquityCapTable | null
  holders: number
  allocated_shares: number
  total_shares: number
  allocated_pct: number
  valuation: number | null
  esop_pool_shares: number
}

export interface AdminCapTableItem {
  cap_table: EquityCapTable
  startup: { id: string; name: string; tagline: string } | null
  holders: number
  allocated_shares: number
  total_shares: number
  allocated_pct: number
  valuation: number | null
  last_updated: string | null
}
