import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, X, Filter, Sparkles, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppHeader } from '../../components/AppHeader'
import { JobCard } from '../../components/jobs/JobCard'
import { SkeletonCard } from '../../components/dashboard/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { useSession } from '../../context/AuthContext'
import { searchJobs, getRecommendedJobs, getSavedJobIds, toggleSavedJob } from '../../lib/jobs'
import { INDUSTRIES } from '../../lib/constants'
import { SKILLS } from '../../types'
import { JOB_EXPERIENCE_LEVELS, JOB_TYPES } from '../../types'
import { Seo } from '../../components/Seo'
import type { Job, JobExperienceLevel, JobType } from '../../types'

const PAGE_SIZE = 12

interface Filters {
  jobTypes: JobType[]
  experienceLevels: JobExperienceLevel[]
  minSalary: number
  location: string
  isRemote: boolean
  industries: string[]
  skills: string[]
}

const DEFAULT_FILTERS: Filters = {
  jobTypes: [],
  experienceLevels: [],
  minSalary: 0,
  location: '',
  isRemote: false,
  industries: [],
  skills: [],
}

function FiltersPanel({
  filters,
  onChange,
  onClear,
  activeCount,
}: {
  filters: Filters
  onChange: (filters: Filters) => void
  onClear: () => void
  activeCount: number
}) {
  const toggle = (key: 'jobTypes' | 'experienceLevels' | 'industries' | 'skills', value: string) => {
    const current = filters[key] as string[]
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
          <Filter className="h-4 w-4" />
          Filters
        </h2>
        {activeCount > 0 && (
          <button onClick={onClear} className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Job type</p>
        {JOB_TYPES.map((jt) => (
          <label key={jt.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={filters.jobTypes.includes(jt.id)}
              onChange={() => toggle('jobTypes', jt.id)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-gray-700 dark:text-gray-300">{jt.label}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Experience level</p>
        {JOB_EXPERIENCE_LEVELS.map((el) => (
          <label key={el.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={filters.experienceLevels.includes(el.id)}
              onChange={() => toggle('experienceLevels', el.id)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-gray-700 dark:text-gray-300">{el.label}</span>
          </label>
        ))}
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Min salary — up to ${filters.minSalary.toLocaleString('en-US')}/mo
        </p>
        <input
          type="range"
          min={0}
          max={10000}
          step={500}
          value={filters.minSalary}
          onChange={(e) => onChange({ ...filters, minSalary: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>$0</span>
          <span>$10,000/mo</span>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={filters.isRemote}
          onChange={(e) => onChange({ ...filters, isRemote: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="text-gray-700 dark:text-gray-300">Remote only</span>
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Location</p>
        <input
          type="text"
          value={filters.location}
          onChange={(e) => onChange({ ...filters, location: e.target.value })}
          placeholder="City or country"
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Industry</p>
        {INDUSTRIES.map((industry) => (
          <label key={industry} className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={filters.industries.includes(industry)}
              onChange={() => toggle('industries', industry)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-gray-700 dark:text-gray-300">{industry}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Skills</p>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((skill) => {
            const active = filters.skills.includes(skill)
            return (
              <button
                key={skill}
                type="button"
                onClick={() => toggle('skills', skill)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary dark:border-dark-400 dark:text-gray-300'
                }`}
              >
                {skill}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Jobs() {
  const { user } = useSession()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [jobs, setJobs] = useState<Job[]>([])
  const [recommended, setRecommended] = useState<Job[]>([])
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const offsetRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeFilterCount =
    filters.jobTypes.length +
    filters.experienceLevels.length +
    filters.industries.length +
    filters.skills.length +
    (filters.isRemote ? 1 : 0)

  useEffect(() => {
    if (!user) return
    getSavedJobIds(user.id).then(setSavedIds).catch(() => {})
    getRecommendedJobs(user.id).then(setRecommended).catch(() => {})
  }, [user])

  const load = useCallback(
    async (append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const data = await searchJobs(
          {
            query: search,
            jobTypes: filters.jobTypes,
            experienceLevels: filters.experienceLevels,
            isRemote: filters.isRemote,
            minSalary: filters.minSalary,
            location: filters.location,
            industries: filters.industries,
            skills: filters.skills,
          },
          { limit: PAGE_SIZE, offset: append ? offsetRef.current : 0 },
        )
        offsetRef.current = append ? offsetRef.current + data.length : data.length
        setHasMore(data.length === PAGE_SIZE)
        setJobs((prev) => (append ? [...prev, ...data] : data))
      } catch {
        if (!append) setJobs([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [search, filters],
  )

  useEffect(() => {
    offsetRef.current = 0
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(false), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, filters, load])

  const handleToggleSave = async (jobId: string) => {
    if (!user) return
    const saved = await toggleSavedJob(user.id, jobId)
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (saved) next.add(jobId)
      else next.delete(jobId)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <Seo title="Jobs — FounderHub" description="Browse startup jobs and opportunities on FounderHub." />
      <AppHeader title="Jobs" backTo="/dashboard" />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs, titles, descriptions…"
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 lg:hidden dark:border-dark-300 dark:bg-dark dark:text-gray-300"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <Link
            to="/jobs/post"
            className="hidden rounded-xl bg-primary px-5 py-3 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90 lg:inline-block"
          >
            Post a Job
          </Link>
        </div>

        {recommended.length > 0 && (
          <section className="mt-6">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <Sparkles className="h-4 w-4 text-primary" />
              Recommended for You
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
              {recommended.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  match={job.matchScore}
                  saved={savedIds.has(job.id)}
                  onToggleSave={() => handleToggleSave(job.id)}
                />
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 flex gap-6">
          <aside className="hidden w-60 flex-shrink-0 lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
              <FiltersPanel
                filters={filters}
                onChange={setFilters}
                onClear={() => setFilters(DEFAULT_FILTERS)}
                activeCount={activeFilterCount}
              />
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <EmptyState
                title="No jobs found"
                description="Try different filters or search terms."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      saved={savedIds.has(job.id)}
                      onToggleSave={() => handleToggleSave(job.id)}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={() => load(true)}
                      disabled={loadingMore}
                      className="btn-ghost flex items-center gap-2 disabled:opacity-50"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading…
                        </>
                      ) : (
                        'Load more'
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSheetOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-gray-200 bg-white p-6 lg:hidden dark:border-dark-300 dark:bg-dark-100"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold">Filters</h2>
                <button onClick={() => setSheetOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <FiltersPanel
                filters={filters}
                onChange={setFilters}
                onClear={() => setFilters(DEFAULT_FILTERS)}
                activeCount={activeFilterCount}
              />
              <button onClick={() => setSheetOpen(false)} className="btn-primary mt-6 w-full">
                Show {jobs.length} jobs
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
