export type { User } from '@supabase/supabase-js'

export type Role = 'founder' | 'developer' | 'designer' | 'investor' | 'marketer'

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
]

export const ROLE_LABELS: Record<Role, string> = {
  founder: 'Founder',
  developer: 'Developer',
  designer: 'Designer',
  investor: 'Investor',
  marketer: 'Marketer',
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

export type NotificationType =
  | 'startup_match'
  | 'new_application'
  | 'status_update'
  | 'message'

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
