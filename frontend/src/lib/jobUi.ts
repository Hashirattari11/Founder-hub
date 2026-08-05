import type { Job, JobType } from '../types'

export const JOB_TYPE_BADGE: Record<JobType, string> = {
  full_time: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  part_time: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  remote: 'bg-green-500/15 text-green-600 dark:text-green-400',
  internship: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  contract: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  freelance: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  remote: 'Remote',
  internship: 'Internship',
  contract: 'Contract',
  freelance: 'Freelance',
}

export const EXPERIENCE_LABELS: Record<string, string> = {
  entry: 'Entry',
  mid: 'Mid',
  senior: 'Senior',
  lead: 'Lead',
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  AED: 'AED ',
  PKR: '₨',
  EUR: '€',
  GBP: '£',
}

export function formatSalary(
  job: Pick<Job, 'salary_min' | 'salary_max' | 'salary_currency' | 'equity_offered'>,
): string {
  const symbol = CURRENCY_SYMBOLS[job.salary_currency ?? 'USD'] ?? ''
  const min = job.salary_min
  const max = job.salary_max
  if (min == null && max == null) {
    return job.equity_offered != null ? `${job.equity_offered}% equity` : 'Salary negotiable'
  }
  const fmt = (n: number) => symbol + n.toLocaleString('en-US')
  if (min != null && max != null && min !== max) return `${fmt(min)} - ${fmt(max)}/mo`
  if (max != null) return `${fmt(max)}/mo`
  return `${fmt(min ?? 0)}/mo`
}

export function formatJobLocation(job: Pick<Job, 'location' | 'is_remote'>): string {
  if (job.is_remote) return 'Remote'
  if (job.location) return job.location
  return 'On-site'
}

export const AVAILABILITY_OPTIONS = [
  'Immediately',
  '2 weeks notice',
  '1 month notice',
  'Currently employed but open',
]
