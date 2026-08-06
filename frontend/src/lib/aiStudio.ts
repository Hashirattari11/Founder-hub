import { useEffect, useState } from 'react'
import { api } from './api'
import type {
  AIStudioConfig,
  AIToolInfo,
  AdminToolPayload,
  AdminToolsResponse,
  AdminUsersResponse,
  AnalyticsSummary,
  RunToolResult,
  UsageLogsResponse,
} from '../types/aiStudio'

export function getAIStudioConfig(): Promise<AIStudioConfig> {
  return api.get<AIStudioConfig>('/api/ai-studio/config', { auth: true })
}

export function runAIStudioTool(slug: string, inputs: Record<string, string>): Promise<RunToolResult> {
  return api.post<RunToolResult>(`/api/ai-studio/tools/${slug}/run`, { inputs }, { auth: true })
}

// ---- Admin ---------------------------------------------------------------

export function adminListTools(): Promise<AdminToolsResponse> {
  return api.get<AdminToolsResponse>('/api/ai-studio/admin/tools', { auth: true })
}

export function adminCreateTool(payload: AdminToolPayload): Promise<AIToolInfo> {
  return api.post<AIToolInfo>('/api/ai-studio/admin/tools', payload, { auth: true })
}

export function adminUpdateTool(slug: string, payload: Partial<Omit<AdminToolPayload, 'slug'>>): Promise<AIToolInfo> {
  return api.patch<AIToolInfo>(`/api/ai-studio/admin/tools/${slug}`, payload, { auth: true })
}

export function adminDeleteTool(slug: string): Promise<{ success: boolean }> {
  return api.delete<{ success: boolean }>(`/api/ai-studio/admin/tools/${slug}`, { auth: true })
}

export function adminListUsers(search?: string): Promise<AdminUsersResponse> {
  const q = search && search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
  return api.get<AdminUsersResponse>(`/api/ai-studio/admin/users${q}`, { auth: true })
}

export function adminSetUserRoles(userId: string, roles: string[]): Promise<{ user_id: string; roles: string[] }> {
  return api.put(`/api/ai-studio/admin/users/${userId}/roles`, { roles }, { auth: true })
}

export function adminUsageLogs(): Promise<UsageLogsResponse> {
  return api.get<UsageLogsResponse>('/api/ai-studio/admin/usage', { auth: true })
}

export function adminAnalytics(): Promise<AnalyticsSummary> {
  return api.get<AnalyticsSummary>('/api/ai-studio/admin/analytics', { auth: true })
}

// ---- Hooks ---------------------------------------------------------------

let cachedConfig: Promise<AIStudioConfig> | null = null
let cachedRoles: string[] | null = null
let cachedUserId: string | null = null

function invalidate() {
  cachedConfig = null
  cachedRoles = null
  cachedUserId = null
}

export function useAIStudioConfig(userId: string | undefined) {
  const [config, setConfig] = useState<AIStudioConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    if (cachedUserId !== userId) invalidate()
    cachedUserId = userId
    if (!cachedConfig) {
      cachedConfig = getAIStudioConfig()
        .catch((err) => {
          cachedConfig = null
          throw err
        })
        .then((cfg) => {
          cachedRoles = cfg.roles
          return cfg
        })
    }
    let active = true
    cachedConfig
      .then((cfg) => {
        if (active) {
          setConfig(cfg)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [userId])

  return { config, error }
}

export function getCachedStudioRoles(): string[] | null {
  return cachedRoles
}

export function invalidateStudioConfig() {
  invalidate()
}
