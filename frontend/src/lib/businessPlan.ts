import { api } from './api'
import { supabase } from './supabase'
import type {
  BusinessModel,
  BusinessPlanRecord,
  BusinessPlanSummary,
  GeneratePlanPayload,
  PlanStage,
} from '../types/businessPlan'
import { API_URL } from './config'

export const PLAN_STAGES: { value: PlanStage; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'mvp', label: 'MVP / Early product' },
  { value: 'traction', label: 'Early traction' },
  { value: 'growth', label: 'Growth' },
  { value: 'scale', label: 'Scale-up' },
]

export const BUSINESS_MODELS: { value: BusinessModel; label: string }[] = [
  { value: 'saas', label: 'SaaS (software-as-a-service)' },
  { value: 'marketplace', label: 'Two-sided marketplace' },
  { value: 'ecommerce', label: 'E-commerce / DTC' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'ads', label: 'Advertising / freemium' },
  { value: 'agency', label: 'Agency / services' },
  { value: 'hardware', label: 'Hardware / physical product' },
  { value: 'consulting', label: 'Consulting / professional services' },
  { value: 'fintech', label: 'Fintech / payments / lending' },
  { value: 'other', label: 'Custom / hybrid' },
]

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listBusinessPlans(): Promise<{ plans: BusinessPlanSummary[] }> {
  return api.get('/api/business-plan', { auth: true })
}

export function getBusinessPlan(id: string): Promise<BusinessPlanRecord> {
  return api.get(`/api/business-plan/${id}`, { auth: true })
}

export function getSharedBusinessPlan(token: string): Promise<BusinessPlanRecord> {
  return api.get(`/api/business-plan/share/${token}`, { auth: false })
}

// ---------------------------------------------------------------------------
// Generate / update / delete
// ---------------------------------------------------------------------------

export function generateBusinessPlan(payload: GeneratePlanPayload): Promise<BusinessPlanRecord> {
  return api.post('/api/business-plan/generate', payload, { auth: true })
}

export function updateBusinessPlan(
  id: string,
  payload: Partial<{ startup_name: string; business_plan: unknown[]; pitch_deck: unknown[]; is_public: boolean }>,
): Promise<BusinessPlanRecord> {
  return api.patch(`/api/business-plan/${id}`, payload, { auth: true })
}

export function deleteBusinessPlan(id: string): Promise<void> {
  return api.delete(`/api/business-plan/${id}`, { auth: true })
}

// ---------------------------------------------------------------------------
// Share link
// ---------------------------------------------------------------------------

export function buildShareUrl(plan: Pick<BusinessPlanSummary, 'share_token'> | Pick<BusinessPlanRecord, 'share_token'>): string {
  const token = plan.share_token
  if (!token) return ''
  return `${window.location.origin}/business-plan/share/${token}`
}

// ---------------------------------------------------------------------------
// Export (PDF / DOCX / Markdown)
// ---------------------------------------------------------------------------

export type ExportFormat = 'pdf' | 'docx' | 'markdown'

export async function downloadBusinessPlanExport(
  id: string,
  format: ExportFormat,
  startupName: string,
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const res = await fetch(`${API_URL}/api/business-plan/${id}/export`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ format }),
  })
  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`
    try {
      const data = await res.json()
      if (data.detail) detail = data.detail
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const base = (startupName || 'business_plan').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  const ext = format === 'markdown' ? 'md' : format
  a.href = url
  a.download = `${base}_business_plan.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
