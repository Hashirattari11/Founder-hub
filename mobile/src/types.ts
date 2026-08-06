export type { User, Session } from '@supabase/supabase-js'

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
  is_admin: boolean | null
  is_super_admin: boolean | null
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

export const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: 'founder', label: 'Founder', description: 'I am building a startup and looking for teammates' },
  { value: 'developer', label: 'Developer', description: 'I build products and want to join a startup' },
  { value: 'designer', label: 'Designer', description: 'I design products and want to join a startup' },
  { value: 'marketer', label: 'Marketer', description: 'I help startups grow and reach users' },
  { value: 'investor', label: 'Investor', description: 'I fund startups and look for opportunities' },
  { value: 'legal_advisor', label: 'Legal Advisor', description: 'I provide legal guidance to founders and startups' },
  { value: 'business_analyst', label: 'Business Analyst', description: 'I analyze markets, data and business performance' },
  { value: 'mentor', label: 'Mentor', description: 'I coach founders and early-stage teams' },
  { value: 'recruiter', label: 'Recruiter', description: 'I source and hire startup talent' },
  { value: 'administrator', label: 'Administrator', description: 'I manage platform teams and operations' },
]

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

export const ROLE_SKILLS: Record<Role, string[]> = {
  founder: ['Product Management', 'Business Development', 'Strategy', 'Leadership', 'Fundraising', 'Finance', 'Sales', 'Marketing', 'Operations', 'Pitching', 'Legal', 'Networking'],
  developer: ['React', 'Node.js', 'Python', 'TypeScript', 'AI/ML', 'iOS', 'Android', 'DevOps', 'Cloud', 'Blockchain', 'Data Science', 'Backend'],
  designer: ['UI/UX Design', 'Graphic Design', 'Branding', 'Figma', 'Prototyping', 'Design Systems', 'User Research', 'Motion Design', 'Illustration', 'Video Editing'],
  marketer: ['Marketing', 'SEO', 'Content Writing', 'Social Media', 'Growth Marketing', 'Email Marketing', 'Paid Ads', 'Video Editing', 'PR', 'Branding', 'Analytics'],
  investor: ['Finance', 'Financial Modeling', 'Due Diligence', 'Fundraising', 'Networking', 'Legal', 'Strategy', 'Business Development', 'Portfolio Management', 'Valuation'],
  legal_advisor: ['Legal', 'Contracts', 'Corporate Law', 'IP', 'Compliance', 'Fundraising', 'Negotiation', 'Due Diligence', 'Governance', 'Employment Law'],
  business_analyst: ['Data Science', 'Analytics', 'Financial Modeling', 'Strategy', 'Market Research', 'SQL', 'Forecasting', 'Business Development', 'Operations', 'Product Management'],
  mentor: ['Leadership', 'Strategy', 'Fundraising', 'Product Management', 'Growth', 'Pitching', 'Operations', 'Networking', 'Mentoring', 'Sales'],
  recruiter: ['Talent Acquisition', 'Hiring', 'HR', 'Networking', 'Sourcing', 'Interviewing', 'Employer Branding', 'People Operations', 'Sales', 'Communication'],
  administrator: ['Operations', 'Management', 'Finance', 'Legal', 'Compliance', 'Strategy', 'HR', 'Governance', 'Project Management', 'Business Development'],
}

export const INVESTOR_INTERESTS = [
  'SaaS', 'Fintech', 'HealthTech', 'AI/ML', 'Consumer Apps', 'Marketplace', 'Developer Tools',
  'EdTech', 'E-commerce', 'Blockchain/Crypto', 'Gaming', 'Climate/GreenTech', 'HR Tech',
  'Logistics', 'PropTech', 'Travel',
] as const

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
  profiles?: Pick<Profile, 'full_name' | 'avatar_url' | 'username' | 'bio' | 'linkedin_url'> | null
}

export type FeedType = 'for_you' | 'following' | 'trending' | 'stories' | 'saved'

export interface Hashtag {
  id: string
  name: string
  posts_count: number
  created_at: string
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
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'username' | 'role' | 'city'> | null
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

export type ApplicationStatus = 'pending' | 'shortlisted' | 'accepted' | 'rejected'

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

export type JobType = 'full_time' | 'part_time' | 'remote' | 'internship' | 'contract' | 'freelance'
export type JobExperienceLevel = 'entry' | 'mid' | 'senior' | 'lead'
export type JobApplicationStatus = 'pending' | 'reviewing' | 'shortlisted' | 'interview' | 'accepted' | 'rejected'

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
  profiles?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role' | 'city' | 'skills' | 'experience_years' | 'bio' | 'portfolio_url'> | null
}

export const JOB_TYPES: { id: JobType; label: string }[] = [
  { id: 'full_time', label: 'Full Time' },
  { id: 'part_time', label: 'Part Time' },
  { id: 'remote', label: 'Remote' },
  { id: 'internship', label: 'Internship' },
  { id: 'contract', label: 'Contract' },
  { id: 'freelance', label: 'Freelance' },
]

export const JOB_STATUS_LABELS: Record<JobApplicationStatus, string> = {
  pending: 'Pending',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  accepted: 'Accepted',
  rejected: 'Rejected',
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

export interface AppNotification {
  id: string
  user_id: string
  type: string
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

export interface Meeting {
  id: string
  organizer_id: string
  participant_id: string | null
  title: string
  description: string | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed'
  scheduled_at: string | null
  duration_minutes: number | null
  meeting_link: string | null
  created_at: string
  updated_at: string
  organizer?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'username' | 'role'> | null
  participant?: Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'username' | 'role'> | null
}
