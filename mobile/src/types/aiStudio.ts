export interface StudioToolField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'select' | string
  required: boolean
  placeholder: string
  options: string[] | null
}

export interface StudioTool {
  slug: string
  name: string
  description: string
  category: string
  icon: string
  roles: string[]
  prompt: string
  fields: StudioToolField[]
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
  tools: StudioTool[]
  categories: string[]
}

export interface RunToolResult {
  tool: string
  title: string
  output: string
  provider: string | null
  latency_ms: number
}
