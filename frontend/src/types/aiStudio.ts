export type StudioRole =
  | 'founder'
  | 'developer'
  | 'designer'
  | 'marketer'
  | 'investor'
  | 'legal_advisor'
  | 'business_analyst'
  | 'mentor'
  | 'recruiter'
  | 'administrator'

export interface ToolField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | string
  required: boolean
  placeholder: string
  options: string[] | null
}

export interface AIToolInfo {
  slug: string
  name: string
  description: string
  category: string
  icon: string
  roles: string[]
  prompt: string
  fields: ToolField[]
  output_format: string
  is_builtin: boolean
  is_enabled: boolean
}

export interface StudioInfo {
  role: string
  label: string
}

export interface AIStudioConfig {
  roles: string[]
  primary_role: string
  studios: StudioInfo[]
  tools: AIToolInfo[]
  categories: string[]
}

export interface RunToolResult {
  tool: string
  title: string
  output: string
  provider: string | null
  latency_ms: number
}

export interface AdminToolsResponse {
  tools: AIToolInfo[]
  total: number
}

export interface AdminToolPayload {
  slug?: string
  name: string
  description: string
  category: string
  icon: string
  roles: string[]
  prompt_template: string
  input_fields: ToolField[]
  output_format: string
  is_enabled: boolean
}

export interface AdminUser {
  id: string
  full_name: string | null
  username: string | null
  role: string
  extra_roles: string[]
  is_admin: boolean
}

export interface AdminUsersResponse {
  users: AdminUser[]
}

export interface UsageLog {
  id: number
  user_id: string
  user_name: string
  tool_slug: string
  provider: string | null
  status: string
  error: string | null
  created_at: string
}

export interface UsageLogsResponse {
  logs: UsageLog[]
}

export interface AnalyticsSummary {
  total_runs: number
  successful_runs: number
  failed_runs: number
  last_24h: number
  last_7d: number
  active_users: number
  top_tools: { tool: string; runs: number }[]
  runs_by_category: { category: string; runs: number }[]
  runs_by_primary_role: { role: string; users: number }[]
}
