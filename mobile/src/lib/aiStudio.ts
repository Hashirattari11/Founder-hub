import { api } from '@/lib/api'
import type { AIStudioConfig, RunToolResult } from '@/types/aiStudio'

export function getAIStudioConfig(): Promise<AIStudioConfig> {
  return api.get<AIStudioConfig>('/api/ai-studio/config', { auth: true })
}

export function runAIStudioTool(slug: string, inputs: Record<string, string>): Promise<RunToolResult> {
  return api.post<RunToolResult>(`/api/ai-studio/tools/${slug}/run`, { inputs }, { auth: true })
}
