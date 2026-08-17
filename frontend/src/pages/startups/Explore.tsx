import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X, Filter } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppHeader } from '../../components/AppHeader'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { SkeletonCard } from '../../components/dashboard/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { useSession } from '../../context/AuthContext'
import { useSavedStartups } from '../../hooks/useSavedStartups'
import { exploreStartups, getApplicantCounts, FUNDING_MIDPOINTS, FUNDING_ORDER } from '../../lib/startups'
import { calcMatchScore } from '../../lib/helpers'
import { INDUSTRIES, STAGES, TEAM_ROLES } from '../../lib/constants'
import { Seo } from '../../components/Seo'
import type { Startup } from '../../types'

type SortOption = 'newest' | 'applicants' | 'equity'

const PAGE_SIZE = 12

interface Filters {
  industries: string[]
  stages: string[]
  roles: string[]
  remoteOnly: boolean
  maxFundingMidpoint: number
}

const DEFAULT_FILTERS: Filters = {
  industries: [],
  stages: [],
  roles: [],
  remoteOnly: false,
  maxFundingMidpoint: 750,
}

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest first',
  applicants: 'Most applicants',
  equity: 'Equity (high to low)',
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
  const toggle = (key: 'industries' | 'stages' | 'roles', value: string) => {
    const current = filters[key]
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  const CheckRow = ({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) => (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={onClick} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
      <span className="text-gray-700 dark:text-gray-300">{label}</span>
    </label>
  )

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
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Industry</p>
        {INDUSTRIES.map((industry) => (
          <CheckRow
            key={industry}
            label={industry}
            checked={filters.industries.includes(industry)}
            onClick={() => toggle('industries', industry)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Stage</p>
        {STAGES.map((stage) => (
          <CheckRow
            key={stage}
            label={stage}
            checked={filters.stages.includes(stage.toLowerCase())}
            onClick={() => toggle('stages', stage.toLowerCase())}
          />
        ))}
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Funding needed — up to {FUNDING_ORDER.find((o) => FUNDING_MIDPOINTS[o] === filters.maxFundingMidpoint) ?? '$500K+'}
        </p>
        <input
          type="range"
          min={0}
          max={750}
          step={5}
          value={filters.maxFundingMidpoint}
          onChange={(e) => onChange({ ...filters, maxFundingMidpoint: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Bootstrapped</span>
          <span>$500K+</span>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={filters.remoteOnly}
          onChange={(e) => onChange({ ...filters, remoteOnly: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="text-gray-700 dark:text-gray-300">Remote only</span>
      </label>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Roles needed</p>
        <div className="flex flex-wrap gap-2">
          {TEAM_ROLES.map((role) => {
            const active = filters.roles.includes(role)
            return (
              <button
                key={role}
                onClick={() => toggle('roles', role)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  active
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary dark:border-dark-400 dark:text-gray-300'
                }`}
              >
                {role}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Explore() {
  const { user, profile } = useSession()
  const [searchParams] = useSearchParams()
  const { savedIds, toggleSave } = useSavedStartups(user?.id)
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '')
  const [sort, setSort] = useState<SortOption>('newest')
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [startups, setStartups] = useState<Startup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeFilterCount =
    filters.industries.length + filters.stages.length + filters.roles.length + (filters.remoteOnly ? 1 : 0)

  const load = useCallback(
    async (pageNum: number, append: boolean) => {
      if (pageNum === 0) setLoading(true)
      else setLoadingMore(true)
      try {
        const result = await exploreStartups({
          search,
          industries: filters.industries,
          stages: filters.stages,
          roles: filters.roles,
          remoteOnly: filters.remoteOnly,
          maxFundingMidpoint: filters.maxFundingMidpoint,
          sort,
          page: pageNum,
          pageSize: PAGE_SIZE,
        })
        setStartups((prev) => (append ? [...prev, ...result.startups] : result.startups))
        setTotal(result.total)
        setPage(pageNum)
      } catch (err) {
        setStartups((prev) => (append ? prev : []))
        setTotal(0)
        console.error('Explore load failed', err)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [search, filters, sort],
  )

  useEffect(() => {
    const q = searchParams.get('search')
    if (q != null) setSearch(q)
  }, [searchParams])

  // Debounced reload on search / filters / sort changes.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      load(0, false)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, filters, sort, load])

  useEffect(() => {
    getApplicantCounts().catch(() => {})
  }, [])

  const hasMore = startups.length < total

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <Seo title="Explore Startups — FounderHub" description="Discover startups, founders, and opportunities on FounderHub." />
      <AppHeader title="Explore Startups" backTo="/dashboard" />
      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:pb-6">
        {/* Top bar: search + sort + mobile filter button */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search startups, taglines, descriptions…"
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSheetOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 lg:hidden dark:border-dark-300 dark:bg-dark dark:text-gray-300"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="cursor-pointer rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            >
              {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                <option key={option} value={option}>
                  {SORT_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          <strong className="text-gray-800 dark:text-gray-200">{total}</strong> startups found
        </p>

        <div className="mt-4 flex gap-6">
          {/* Desktop sidebar */}
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

          {/* Main grid */}
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : startups.length === 0 ? (
              <EmptyState
                title="No startups found"
                description="Try different filters or search terms."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {startups.map((startup) => (
                    <StartupCard
                      key={startup.id}
                      startup={startup}
                      showFunding
                      match={calcMatchScore(profile, startup)}
                      saved={!!savedIds[startup.id]}
                      onToggleSave={() => toggleSave(startup.id)}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={() => load(page + 1, true)}
                      disabled={loadingMore}
                      className="btn-ghost disabled:opacity-50"
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Mobile bottom-sheet filters */}
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
                Show {total} startups
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
