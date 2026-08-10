import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Target, Play, Bookmark, X, Sparkles, TrendingUp, LayoutDashboard } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSession } from '../../context/AuthContext'
import { api } from '../../lib/api'
import { ScoreRing } from '../../components/studio/ScoreRing'
import { StartupPicker } from '../../components/studio/StartupPicker'
import type { Startup } from '../../types'

interface MatchRow {
  id: string
  startup_id: string
  target_user_id: string
  role?: string
  score?: number
  scores?: { category: string; label: string; weight: number; score: number; note?: string }[]
  reasons?: { factor: string; detail: string; contribution?: number }[]
  concerns?: { factor: string; detail: string }[]
  saved?: boolean
  dismissed?: boolean
  startup?: Startup | null
}

interface MatchesResponse {
  matches: MatchRow[]
  mode?: string
}

export default function Matches() {
  const { user, profile } = useSession()
  const [mode, setMode] = useState<'founder' | 'user'>('user')
  const [startupId, setStartupId] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [selected, setSelected] = useState<MatchRow | null>(null)

  // Founder mode when the effective role is founder (admin previews included).
  useEffect(() => {
    setMode(profile?.role === 'founder' ? 'founder' : 'user')
  }, [profile?.role])

  const loadMyMatches = useCallback(async () => {
    setLoading(true)
    try {
      const result = await api.get<MatchesResponse>('/api/ai-matches/me', { auth: true })
      setMatches(result.matches ?? [])
      setSelected(null)
    } catch {
      toast.error('Could not load your matches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) void loadMyMatches()
  }, [user, loadMyMatches])

  const run = async () => {
    setRunning(true)
    try {
      const result = await api.post<MatchesResponse>(
        '/api/ai-matches/run',
        mode === 'founder' ? { startup_id: startupId } : {},
        { auth: true },
      )
      setMatches(result.matches ?? [])
      setSelected(null)
      toast.success(
        result.matches.length > 0
          ? `${result.matches.length} match${result.matches.length === 1 ? '' : 'es'} found`
          : 'No matches above the threshold — update your profile or startup for better results',
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not run matching')
    } finally {
      setRunning(false)
    }
  }

  const setFlag = async (matchId: string, kind: 'save' | 'dismiss') => {
    try {
      const updated = await api.post<MatchRow>(`/api/ai-matches/matches/${matchId}/${kind}`, kind === 'save' ? { saved: true } : {}, { auth: true })
      if (kind === 'dismiss') {
        setMatches((ms) => ms.filter((m) => m.id !== matchId))
        if (selected?.id === matchId) setSelected(null)
      } else {
        setMatches((ms) => ms.map((m) => (m.id === matchId ? { ...m, saved: true } : m)))
        setSelected(updated)
      }
      toast.success(kind === 'save' ? 'Match saved' : 'Match dismissed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Target size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">AI Matches</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Explainable matching between startups and people — every score shows its reasons.
            </p>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-300"
        >
          <LayoutDashboard size={15} /> Back to Dashboard
        </Link>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark sm:flex-row sm:items-end">
        {mode === 'founder' ? (
          <>
            <div className="min-w-0 flex-1">
              <StartupPicker
                startupId={startupId}
                onChange={setStartupId}
                onRefresh={() => undefined}
                refreshing={false}
              />
            </div>
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Match my profile to published startups
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              We score your profile (skills, experience, interests, funding range) against every published
              startup.
            </p>
          </div>
        )}
        <button
          onClick={run}
          disabled={running || (mode === 'founder' && !startupId)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Play size={15} className={running ? 'animate-pulse' : ''} />
          {running ? 'Matching…' : 'Run AI Matching'}
        </button>
      </div>

      {loading && (
        <div className="mt-8 space-y-4">
          <div className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
          <div className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-300" />
        </div>
      )}

      {!loading && matches.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-dark-300">
          <Sparkles className="mx-auto mb-3 text-gray-400" size={28} />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No matches yet. Run AI Matching above to score{' '}
            {mode === 'founder' ? 'talent and investors against your startup' : 'startups against your profile'}.
          </p>
        </div>
      )}

      {!loading && matches.length > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* List */}
          <div className="space-y-3">
            {matches.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className={`w-full rounded-2xl border bg-white p-4 text-left transition-colors dark:bg-dark ${
                  selected?.id === m.id
                    ? 'border-primary ring-2 ring-primary/30'
                    : 'border-gray-200 hover:border-primary/50 dark:border-dark-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                      {m.startup?.name ?? 'Startup'}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {m.startup?.tagline || m.startup?.industry || (m.role ? `Matched role: ${m.role}` : '')}
                    </p>
                  </div>
                  <span className="shrink-0 text-2xl font-extrabold text-primary">{m.score ?? 0}</span>
                </div>
                {m.saved && (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                    <Bookmark size={10} /> Saved
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {selected ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                      {selected.startup?.name ?? 'Startup'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selected.startup?.tagline} {selected.startup?.location ? `· ${selected.startup.location}` : ''}
                    </p>
                  </div>
                  <ScoreRing score={selected.score ?? 0} label="Match" size={88} />
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setFlag(selected.id, 'save')}
                    disabled={!!selected.saved}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                  >
                    <Bookmark size={13} /> {selected.saved ? 'Saved' : 'Save'}
                  </button>
                  <button
                    onClick={() => setFlag(selected.id, 'dismiss')}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:border-dark-300 dark:text-gray-300 dark:hover:bg-dark-300"
                  >
                    <X size={13} /> Dismiss
                  </button>
                </div>

                <div className="mt-5 space-y-2.5">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <TrendingUp size={13} /> Why this score
                  </h3>
                  {(selected.scores ?? []).map((s) => (
                    <div key={s.category}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700 dark:text-gray-200">{s.label}</span>
                        <span className="text-gray-500 dark:text-gray-400">{s.score}/100</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-dark-300">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, Math.max(0, s.score))}%` }}
                        />
                      </div>
                      {s.note && <p className="mt-0.5 text-[11px] text-gray-400">{s.note}</p>}
                    </div>
                  ))}
                </div>

                {(selected.reasons ?? []).length > 0 && (
                  <div className="mt-5">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Positive signals
                    </h3>
                    <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                      {selected.reasons!.map((r) => (
                        <li key={r.factor}>
                          <span className="font-semibold">{r.factor}:</span> {r.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(selected.concerns ?? []).length > 0 && (
                  <div className="mt-5">
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Watch out
                    </h3>
                    <ul className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
                      {selected.concerns!.map((c) => (
                        <li key={c.factor}>
                          <span className="font-semibold">{c.factor}:</span> {c.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-dark-300">
                <p className="text-sm text-gray-500 dark:text-gray-400">Select a match to see why it scored.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
