import { supabase } from './supabase'
import { uriToBlob } from './assets'
import type {
  Job,
  JobApplication,
  JobApplicationStatus,
  JobExperienceLevel,
  JobType,
  Resume,
} from '@/types'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8001'

const JOB_PROFILE_FIELDS = 'profiles!jobs_posted_by_fkey(full_name, avatar_url)'
const JOB_STARTUP_FIELDS = 'startups(id, name, tagline, industry)'
const APP_PROFILE_FIELDS =
  'id, full_name, avatar_url, role, city, skills, experience_years, bio, portfolio_url'

export interface JobFilters {
  query?: string
  jobTypes?: JobType[]
  experienceLevels?: JobExperienceLevel[]
  isRemote?: boolean
  minSalary?: number
  location?: string
  industries?: string[]
  skills?: string[]
}

export async function searchJobs(
  filters: JobFilters = {},
  opts: { limit?: number; offset?: number } = {},
): Promise<Job[]> {
  const { limit = 20, offset = 0 } = opts
  const { query, jobTypes, experienceLevels, isRemote, minSalary, location, industries, skills } = filters

  let q = supabase
    .from('jobs')
    .select(`*, ${JOB_STARTUP_FIELDS}, ${JOB_PROFILE_FIELDS}`)
    .eq('is_active', true)

  if (query && query.trim()) {
    q = q.or(`title.ilike.%${query.trim()}%,description.ilike.%${query.trim()}%`)
  }
  if (jobTypes?.length) q = q.in('job_type', jobTypes)
  if (experienceLevels?.length) q = q.in('experience_level', experienceLevels)
  if (isRemote) q = q.eq('is_remote', true)
  if (minSalary) q = q.gte('salary_max', minSalary)
  if (location && location.trim()) q = q.ilike('location', `%${location.trim()}%`)
  if (industries?.length) q = q.in('industry', industries)
  if (skills?.length) q = q.overlaps('skills_required', skills)

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return (data ?? []) as unknown as Job[]
}

export async function getJob(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`*, ${JOB_STARTUP_FIELDS}, ${JOB_PROFILE_FIELDS}`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Job) ?? null
}

export async function incrementJobViews(id: string, current: number): Promise<void> {
  await supabase.from('jobs').update({ views_count: current + 1 }).eq('id', id)
}

export async function createJob(input: {
  startup_id: string | null
  posted_by: string
  title: string
  description: string
  requirements: string[]
  nice_to_have: string[]
  job_type: JobType
  location?: string | null
  is_remote: boolean
  salary_min?: number | null
  salary_max?: number | null
  salary_currency: string
  equity_offered?: number | null
  experience_level: JobExperienceLevel
  skills_required: string[]
  industry: string
  application_deadline?: string | null
}): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      startup_id: input.startup_id,
      posted_by: input.posted_by,
      title: input.title,
      description: input.description,
      requirements: input.requirements,
      nice_to_have: input.nice_to_have,
      job_type: input.job_type,
      location: input.location ?? null,
      is_remote: input.is_remote,
      salary_min: input.salary_min ?? null,
      salary_max: input.salary_max ?? null,
      salary_currency: input.salary_currency,
      equity_offered: input.equity_offered ?? null,
      experience_level: input.experience_level,
      skills_required: input.skills_required,
      industry: input.industry,
      application_deadline: input.application_deadline ?? null,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data as unknown as Job
}

export async function getMyJobs(userId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`*, ${JOB_STARTUP_FIELDS}, ${JOB_PROFILE_FIELDS}`)
    .eq('posted_by', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Job[]
}

export async function updateJob(
  id: string,
  patch: Partial<Pick<Job, 'title' | 'description' | 'is_active' | 'salary_min' | 'salary_max' | 'application_deadline'>>,
): Promise<void> {
  const { error } = await supabase.from('jobs').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteJob(id: string): Promise<void> {
  const { error } = await supabase.from('jobs').delete().eq('id', id)
  if (error) throw error
}

export async function toggleJobActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('jobs').update({ is_active: !isActive }).eq('id', id)
  if (error) throw error
}

export async function applyToJob(input: {
  jobId: string
  applicantId: string
  coverLetter: string
  resumeUrl?: string | null
  portfolioUrl?: string | null
  expectedSalary?: number | null
  availability?: string | null
}): Promise<JobApplication> {
  const { data, error } = await supabase
    .from('job_applications')
    .insert({
      job_id: input.jobId,
      applicant_id: input.applicantId,
      cover_letter: input.coverLetter,
      resume_url: input.resumeUrl ?? null,
      portfolio_url: input.portfolioUrl ?? null,
      expected_salary: input.expectedSalary ?? null,
      availability: input.availability ?? null,
      status: 'pending',
    })
    .select(`*, jobs(id, title, job_type, location, is_remote, created_at, startup_id, startups(id, name, tagline, industry)), profiles(${APP_PROFILE_FIELDS})`)
    .single()
  if (error) throw error
  return data as unknown as JobApplication
}

export async function getMyJobApplications(userId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select(`*, jobs(id, title, job_type, location, is_remote, created_at, startup_id, startups(id, name, tagline, industry)), profiles(${APP_PROFILE_FIELDS})`)
    .eq('applicant_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as JobApplication[]
}

export async function getApplicationsForJob(jobId: string): Promise<JobApplication[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select(`*, jobs(id, title, job_type, location, is_remote, created_at, startup_id, startups(id, name, tagline, industry)), profiles(${APP_PROFILE_FIELDS})`)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as JobApplication[]
}

export async function updateApplicationStatus(
  applicationId: string,
  status: JobApplicationStatus,
): Promise<void> {
  const { error } = await supabase
    .from('job_applications')
    .update({ status })
    .eq('id', applicationId)
  if (error) throw error
}

export async function withdrawApplication(applicationId: string): Promise<void> {
  const { error } = await supabase.from('job_applications').delete().eq('id', applicationId)
  if (error) throw error
}

export async function hasAppliedToJob(jobId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('job_applications')
    .select('id')
    .eq('job_id', jobId)
    .eq('applicant_id', userId)
    .maybeSingle()
  return !!data
}

export async function getSavedJobIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('saved_jobs')
    .select('job_id')
    .eq('user_id', userId)
  return new Set((data ?? []).map((row) => row.job_id as string))
}

export async function toggleSavedJob(userId: string, jobId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('saved_jobs')
    .select('job_id')
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .maybeSingle()
  if (existing) {
    await supabase.from('saved_jobs').delete().eq('user_id', userId).eq('job_id', jobId)
    return false
  }
  await supabase.from('saved_jobs').insert({ user_id: userId, job_id: jobId })
  return true
}

export async function getSavedJobs(userId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('saved_jobs')
    .select(`created_at, jobs(*, ${JOB_STARTUP_FIELDS}, ${JOB_PROFILE_FIELDS})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? [])
    .map((row) => (row.jobs as unknown as Job) ?? null)
    .filter(Boolean) as Job[]
}

export async function getRecommendedJobs(userId: string): Promise<Job[]> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('skills, experience_years')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) return []

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`*, ${JOB_STARTUP_FIELDS}`)
    .eq('is_active', true)
    .limit(50)
  if (error) throw error

  const profileSkills = (profile?.skills as string[] | null | undefined) ?? []
  const userSkills = new Set(profileSkills.map((s) => s.toLowerCase()))
  const userExp = profile?.experience_years ?? 0
  const expMap: Record<JobExperienceLevel, number> = { entry: 0, mid: 2, senior: 4, lead: 7 }

  const scored = (jobs as unknown as Job[])
    .map((job) => {
      const jobSkills = new Set((job.skills_required ?? []).map((s: string) => s.toLowerCase()))
      const overlap = [...userSkills].filter((s) => jobSkills.has(s)).length
      const skillScore = Math.min(overlap * 20, 60)
      const jobExp = expMap[job.experience_level ?? 'entry'] ?? 0
      const expScore = Math.abs(userExp - jobExp) <= 1 ? 40 : 20
      return { ...job, matchScore: skillScore + expScore }
    })
    .filter((j) => j.matchScore >= 40)
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
    .slice(0, 3)

  return scored
}

export async function calcJobMatch(job: Job, profile: {
  skills?: string[] | null
  experience_years?: number | null
}): Promise<number> {
  const jobSkills = new Set((job.skills_required ?? []).map((s) => s.toLowerCase()))
  const userSkills = new Set((profile.skills ?? []).map((s) => s.toLowerCase()))
  const overlap = [...userSkills].filter((s) => jobSkills.has(s)).length
  const skillScore = Math.min(overlap * 20, 60)
  const expMap: Record<JobExperienceLevel, number> = { entry: 0, mid: 2, senior: 4, lead: 7 }
  const jobExp = expMap[job.experience_level ?? 'entry'] ?? 0
  const userExp = profile.experience_years ?? 0
  const expScore = Math.abs(userExp - jobExp) <= 1 ? 40 : 20
  return skillScore + expScore
}

export async function getResumes(userId: string): Promise<Resume[]> {
  const { data, error } = await supabase
    .from('resumes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Resume[]
}

export async function saveResume(input: {
  userId: string
  title: string
  content: Record<string, unknown>
  pdfUrl?: string | null
  isDefault?: boolean
}): Promise<Resume> {
  const { data, error } = await supabase
    .from('resumes')
    .insert({
      user_id: input.userId,
      title: input.title,
      content: input.content,
      pdf_url: input.pdfUrl ?? null,
      is_default: input.isDefault ?? false,
    })
    .select()
    .single()
  if (error) throw error
  return data as unknown as Resume
}

export async function deleteResume(id: string): Promise<void> {
  const { error } = await supabase.from('resumes').delete().eq('id', id)
  if (error) throw error
}

export async function notifyJobApplication(jobId: string, applicantId: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/notify-job-application`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId, applicant_id: applicantId }),
    })
  } catch {
    // best-effort
  }
}

export async function notifyNewJob(jobId: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/notify-new-job/${jobId}`, { method: 'POST' })
  } catch {
    // best-effort
  }
}

export async function notifyJobStatus(applicationId: string, newStatus: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/notify-job-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: applicationId, new_status: newStatus }),
    })
  } catch {
    // best-effort
  }
}

export async function uploadResumePdf(uri: string, userId: string): Promise<string> {
  const blob = await uriToBlob(uri)
  if (!/\.pdf$/i.test(uri)) {
    throw new Error('Resume must be a PDF file')
  }
  if (blob.size > 5 * 1024 * 1024) {
    throw new Error('Resume must be under 5MB')
  }
  const { data: bucket } = await supabase.storage.getBucket('resumes')
  if (!bucket) {
    await supabase.storage.createBucket('resumes', {
      public: true,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 5 * 1024 * 1024,
    })
  }
  const baseName = uri.split('/').pop() ?? 'resume.pdf'
  const path = `${userId}/${Date.now()}-${baseName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error } = await supabase.storage.from('resumes').upload(path, blob, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (error) throw error
  const { data } = supabase.storage.from('resumes').getPublicUrl(path)
  return data.publicUrl
}
