import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BarChart3, Bookmark, CalendarClock, Eye, Handshake, Loader2, TrendingUp } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getSavedStartups } from '../../lib/startups'
import { timeAgo } from '../../lib/helpers'
import type { Startup } from '../../types'

interface AnalyticsMatch {
  id: string
  startup_id: string
  match_score: number | null
  status: string
  created_at: string
  startup: Pick<Startup, 'id' | 'name' | 'industry' | 'stage' | 'funding_needed' | 'tagline'> | null
}

const STATUS_META: Record<string, { text: string; cls: string }> = {
  pending: { text: 'Awaiting your reply', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  viewed: { text: 'Viewed', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  interested: { text: 'Interested', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  meeting_scheduled: { text: 'Meeting scheduled', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  passed: { text: 'Passed', cls: 'bg-red-500/15 text-red-500' },
}

const STATUS_ORDER = ['pending', 'viewed', 'interested', 'meeting_scheduled', 'passed']

export default function InvestorAnalytics() {
  const { user } = useSession()
  const [requests, setRequests] = useState<AnalyticsMatch[]>([])
  const [saved, setSaved] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('investor_match_requests')
        .select(
          'id, startup_id, match_score, status, created_at, startup:startups!investor_match_requests_startup_id_fkey(id, name, industry, stage, funding_needed, tagline)',
        )
        .eq('investor_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setRequests((data ?? []) as unknown as AnalyticsMatch[])
      const savedData = await getSavedStartups(user.id)
      setSaved(savedData)
    } catch {
      toast.error('Could not load analytics data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const s of STATUS_ORDER) byStatus[s] = 0
    for (const r of requests) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    const active = (byStatus.interested ?? 0) + (byStatus.meeting_scheduled ?? 0)
    const awaiting = (byStatus.pending ?? 0) + (byStatus.viewed ?? 0)
    return {
      total: requests.length,
      active,
      awaiting,
      passed: byStatus.passed ?? 0,
      saved: saved.length,
      byStatus,
    }
  }, [requests, saved])

  const total = stats.total || 1

  const statCards = [
    { label: 'Total Requests', value: stats.total, icon: Handshake, cls: 'text-primary' },
    { label: 'Active Pipeline', value: stats.active, icon: TrendingUp, cls: 'text-emerald-500' },
    { label: 'Awaiting Reply', value: stats.awaiting, icon: CalendarClock, cls: 'text-amber-500' },
    { label: 'Passed', value: stats.passed, icon: Loader2, cls: 'text-red-500' },
    { label: 'Saved Startups', value: stats.saved, icon: Bookmark, cls: 'text-blue-500' },
  ]

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">Analytics</h1>
          <p className="text-sm text-gray-500">Your investment pipeline at a glance.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
            ))}
          </div>
          <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {statCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100"
              >
                <div className="flex items-center justify-between">
                  <card.icon className={`h-5 w-5 ${card.cls}`} />
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{card.value}</span>
                </div>
                <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
              </div>
            ))}
          </div>

          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-dark-400">
              <Handshake className="h-10 w-10 text-gray-400" />
              <h2 className="mt-4 text-lg font-bold">No pipeline activity yet</h2>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                When founders reach out through AI matching, your pipeline stats and trends will appear here.
              </p>
              <Link to="/explore" className="btn-primary mt-6">
                Discover Startups
              </Link>
            </div>
          ) : (
            <>
              {/* Pipeline breakdown */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <h2 className="mb-4 text-sm font-bold text-gray-800 dark:text-gray-200">Pipeline breakdown</h2>
                <div className="flex flex-col gap-3">
                  {STATUS_ORDER.map((status) => {
                    const count = stats.byStatus[status] ?? 0
                    const meta = STATUS_META[status] ?? STATUS_META.pending
                    if (count === 0) return null
                    return (
                      <div key={status} className="flex items-center gap-3">
                        <span className={`w-40 shrink-0 truncate text-xs font-semibold ${meta.cls}`}>{meta.text}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-dark-300">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-700"
                            style={{ width: `${(count / total) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-sm font-bold text-gray-700 dark:text-gray-200">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Recent requests */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">Recent requests</h2>
                  <Link to="/investor/requests" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <Eye className="h-3.5 w-3.5" /> View all
                  </Link>
                </div>
                <div className="flex flex-col divide-y divide-gray-100 dark:divide-dark-300">
                  {requests.slice(0, 6).map((request) => {
                    const meta = STATUS_META[request.status] ?? STATUS_META.pending
                    return (
                      <div key={request.id} className="flex flex-wrap items-center gap-2 py-3">
                        <div className="min-w-0 flex-1">
                          {request.startup ? (
                            <Link
                              to={`/startups/${request.startup.id}`}
                              className="truncate text-sm font-semibold text-gray-900 hover:text-primary dark:text-white"
                            >
                              {request.startup.name}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-500">Unknown startup</span>
                          )}
                          <p className="text-xs text-gray-500">
                            {request.startup
                              ? `${request.startup.industry ?? 'N/A'} · ${request.startup.stage ?? 'N/A'} stage`
                              : 'Details unavailable'}
                          </p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                          {request.match_score ?? 0}% match
                        </span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.text}</span>
                        <span className="text-xs text-gray-400">{timeAgo(request.created_at)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Saved startups */}
          {saved.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">Saved startups</h2>
                <Link to="/dashboard/saved" className="text-xs font-semibold text-primary hover:underline">
                  View all
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {saved.slice(0, 6).map((s) => (
                  <Link
                    key={s.id}
                    to={`/startups/${s.id}`}
                    className="group rounded-xl border border-gray-200 p-3 transition-colors hover:border-primary dark:border-dark-300"
                  >
                    <p className="truncate text-sm font-bold text-gray-900 group-hover:text-primary dark:text-white">
                      {s.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-gray-500">
                      {s.industry ?? 'N/A'} · {s.stage ?? 'N/A'} stage
                    </p>
                    {s.tagline && <p className="mt-1 line-clamp-2 text-xs text-gray-400">{s.tagline}</p>}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
