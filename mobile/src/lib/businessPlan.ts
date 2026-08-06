import { api } from './api'
import type {
  BusinessPlanRecord,
  BusinessPlanSummary,
  GeneratePlanPayload,
} from '@/types/businessPlan'

export const PLAN_STAGES: { value: string; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'mvp', label: 'MVP / Early product' },
  { value: 'traction', label: 'Early traction' },
  { value: 'growth', label: 'Growth' },
  { value: 'scale', label: 'Scale-up' },
]

export const BUSINESS_MODELS: { value: string; label: string }[] = [
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

export function listBusinessPlans(): Promise<{ plans: BusinessPlanSummary[] }> {
  return api.get('/api/business-plan', { auth: true })
}

export function getBusinessPlan(id: string): Promise<BusinessPlanRecord> {
  return api.get(`/api/business-plan/${id}`, { auth: true })
}

export function generateBusinessPlan(payload: GeneratePlanPayload): Promise<BusinessPlanRecord> {
  return api.post('/api/business-plan/generate', payload, { auth: true })
}

export function updateBusinessPlan(
  id: string,
  payload: Partial<{ startup_name: string; is_public: boolean }>,
): Promise<BusinessPlanRecord> {
  return api.patch(`/api/business-plan/${id}`, payload, { auth: true })
}

export function deleteBusinessPlan(id: string): Promise<void> {
  return api.del(`/api/business-plan/${id}`, { auth: true })
}
