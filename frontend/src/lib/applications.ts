import { supabase } from './supabase'
import { api } from './api'
import type { Application, ApplicationStatus } from '../types'

export interface ApplyPayload {
  startup_id: string
  role_applying_for: string
  cover_message: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function hasApplied(startupId: string, applicantId: string): Promise<boolean> {
  if (!UUID_RE.test(startupId) || !UUID_RE.test(applicantId)) return false
  const { data, error } = await supabase
    .from('applications')
    .select('id')
    .eq('startup_id', startupId)
    .eq('applicant_id', applicantId)
    .maybeSingle()
  if (error) throw error
  return !!data
}

export async function applyToStartup(payload: ApplyPayload): Promise<Application> {
  const data = await api.post<Application>('/applications', payload, { auth: true })
  return data
}

export async function getMyApplications(userId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(
      '*, startups(name, tagline, industry, profiles!startups_founder_id_fkey(full_name, avatar_url))',
    )
    .eq('applicant_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Application[]
}

export async function getApplicationsForStartup(startupId: string): Promise<Application[]> {
  if (!UUID_RE.test(startupId)) return []
  const { data, error } = await supabase
    .from('applications')
    .select('*, profiles!applications_applicant_id_fkey(id, full_name, avatar_url, skills, city, bio, experience_years, linkedin_url, github_url, portfolio_url)')
    .eq('startup_id', startupId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Application[]
}

/**
 * Update an application's status via the backend so the applicant is notified
 * (in-app + email) by the API.
 */
export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicationStatus,
): Promise<Application> {
  return api.patch<Application>(`/applications/${applicationId}/status`, { status }, { auth: true })
}
