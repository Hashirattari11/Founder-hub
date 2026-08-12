import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CalendarClock, Check, Eye, Handshake, Loader2, ThumbsDown } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { updateInvestorMatchStatus } from '../../lib/investorMatch'
import { Avatar } from '../../components/Avatar'
import { timeAgo } from '../../lib/helpers'
import type { InvestorMatchStatus, Startup } from '../../types'

interface InboxMatch {
  id: string
  startup_id: string
  match_score: number | null
  status: string
  message: string | null
  created_at: string
  startup: Pick<Startup, 'id' | 'name' | 'industry' | 'stage' | 'funding_needed' | 'tagline'> | null
  founder: { id: string; full_name: string | null; username: string | null; avatar_url: string | null } | null
}

const STATUS_META: Record<string, { text: string; cls: string }> = {
  pending: { text: 'Awaiting your reply', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  viewed: { text: 'Viewed', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  interested: { text: 'You are interested', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  meeting_scheduled: { text: 'Meeting scheduled', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  passed: { text: 'Passed', cls: 'bg-red-500/15 text-red-500' },
}

export default function InvestorRequests() {
  const { user } = useSession()
  const [requests, setRequests] = useState<InboxMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('investor_match_requests')
        .select(
          '*, startup:startups!investor_match_requests_startup_id_fkey(id, name, industry, stage, funding_needed, tagline), founder:profiles!investor_match_requests_founder_id_fkey(id, full_name, username, avatar_url)',
        )
        .eq('investor_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setRequests((data ?? []) as InboxMatch[])
    } catch {
      toast.error('Could not load investor requests')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = async (request: InboxMatch, status: InvestorMatchStatus) => {
    setBusyId(request.id)
    try {
      await updateInvestorMatchStatus(request.id, status)
      setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status } : r)))
      toast.success(status === 'passed' ? 'Marked as passed' : status === 'meeting_scheduled' ? 'Meeting scheduled' : 'You showed interest')
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Handshake className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold">Startup Requests</h1>
          <p className="text-sm text-gray-500">Founders reaching out through AI investor matching.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
          <div className="h-28 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-dark-400">
          <Handshake className="h-10 w-10 text-gray-400" />
          <h2 className="mt-4 text-lg font-bold">No requests yet</h2>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            When a founder finds you through AI matching and sends an intro, it will show up here.
            Keep your investor profile updated to get more matches.
          </p>
          <Link to="/investor/profile/setup" className="btn-primary mt-6">
            Update Investor Profile
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((request) => {
            const meta = STATUS_META[request.status] ?? STATUS_META.pending
            const actionable = request.status === 'pending' || request.status === 'viewed'
            return (
              <div
                key={request.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-primary">
                    {request.match_score ?? 0}% match
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.text}</span>
                  <span className="ml-auto text-xs text-gray-400">{timeAgo(request.created_at)}</span>
                </div>

                <div className="mt-3 flex items-start gap-3">
                  <Avatar src={request.founder?.avatar_url} name={request.founder?.full_name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{request.startup?.name ?? 'Unknown startup'}</p>
                    <p className="text-xs text-gray-500">
                      {request.startup
                        ? `${request.startup.industry ?? 'N/A'} · ${request.startup.stage ?? 'N/A'} stage · asking ${request.startup.funding_needed ?? 'N/A'}`
                        : 'Startup details unavailable'}
                    </p>
                    {request.startup?.tagline && (
                      <p className="mt-1 line-clamp-1 text-sm text-gray-500 dark:text-gray-400">
                        {request.startup.tagline}
                      </p>
                    )}
                    {request.message && (
                      <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-dark-200 dark:text-gray-300">
                        “{request.message}”
                      </p>
                    )}
                    {request.founder?.username && (
                      <Link
                        to={`/profile/${request.founder.username}`}
                        className="mt-2 inline-block text-xs font-semibold text-primary hover:underline"
                      >
                        View {request.founder.full_name ?? 'founder'} profile
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4 dark:border-dark-300">
                  {request.startup_id && (
                    <Link
                      to={`/startups/${request.startup_id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Startup
                    </Link>
                  )}
                  {actionable && (
                    <>
                      <button
                        onClick={() => setStatus(request, 'interested')}
                        disabled={busyId === request.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Interested
                      </button>
                      <button
                        onClick={() => setStatus(request, 'meeting_scheduled')}
                        disabled={busyId === request.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                      >
                        <CalendarClock className="h-3.5 w-3.5" /> Schedule Meeting
                      </button>
                      <button
                        onClick={() => setStatus(request, 'passed')}
                        disabled={busyId === request.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        {busyId === request.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ThumbsDown className="h-3.5 w-3.5" />
                        )}
                        Pass
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
