import { useCallback, useEffect, useMemo, useState } from 'react'
import { getErrorMessage } from '../../lib/errors'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowRight, Handshake, Loader2, Sparkles } from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { ScoreRing } from '../../components/studio/ScoreRing'
import { StartupPicker } from '../../components/studio/StartupPicker'
import { getMyMatches, listStartupMatches, runStartupMatching } from '../../lib/startupInsights'
import type { MyMatchesResponse, StartupMatchRow } from '../../types/startupInsights'

const ROLE_OPTIONS = [
  { value: 'developer', label: 'Developers' },
  { value: 'designer', label: 'Designers' },
  { value: 'marketer', label: 'Marketers' },
  { value: 'investor', label: 'Investors' },
  { value: 'business_analyst', label: 'Business Analysts' },
  { value: 'legal_advisor', label: 'Legal Advisors' },
  { value: 'mentor', label: 'Mentors' },
  { value: 'recruiter', label: 'Recruiters' },
]

function MatchCard({ row }: { row: StartupMatchRow }) {
  const match = row.match
  const user = row.user
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark">
      <div className="flex items-start gap-4">
        <ScoreRing score={match.score} size={88} stroke={9} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {(user?.full_name ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                {user?.full_name ?? 'User'}
              </p>
              <p className="text-xs capitalize text-gray-500 dark:text-gray-400">
                {match.role.replace('_', ' ')}
                {user?.city ? ` · ${user.city}` : ''}
                {user?.experience_years != null ? ` · ${user.experience_years}y exp` : ''}
              </p>
            </div>
          </div>
          {user?.bio ? <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{user.bio}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Why this match
          </h4>
          {match.reasons.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No strong factors yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {match.reasons.slice(0, 4).map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <span className="mt-0.5 font-bold text-emerald-500">+{r.contribution}</span>
                  <span>
                    <span className="font-semibold">{r.factor}:</span> {r.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Watch out for
          </h4>
          {match.concerns.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">No major concerns.</p>
          ) : (
            <ul className="space-y-1.5">
              {match.concerns.slice(0, 3).map((c, i) => (
                <li key={i} className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold">{c.factor}:</span> {c.detail}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {match.scores.slice(0, 5).map((s) => (
            <span
              key={s.category}
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                s.score >= 70
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                  : s.score < 50
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-dark-300 dark:text-gray-300'
              }`}
              title={s.note}
            >
              {s.label}: {s.score}
            </span>
          ))}
        </div>
        {user?.id ? (
          <Link
            to={`/profile/${user.username ?? user.id}`}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-dark-300 dark:text-gray-200 dark:hover:bg-dark-300"
          >
            View profile <ArrowRight size={12} />
          </Link>
        ) : null}
      </div>
    </div>
  )
}

export default function Matching() {
  const location = useLocation()
  const navState = (location.state ?? {}) as { startupId?: string; role?: string }

  const [startupId, setStartupId] = useState<string | null>(navState.startupId ?? null)
  const [roles, setRoles] = useState<string[]>([navState.role ?? 'developer', 'investor'])
  const [minScore, setMinScore] = useState(50)
  const [running, setRunning] = useState(false)
  const [founderMatches, setFounderMatches] = useState<StartupMatchRow[]>([])
  const [myMatches, setMyMatches] = useState<MyMatchesResponse['matches']>([])
  const [loadingMine, setLoadingMine] = useState(false)
  const [lastRun, setLastRun] = useState<{ total: number; kept: number } | null>(null)

  const toggleRole = (r: string) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))

  const runMatching = useCallback(async () => {
    if (!startupId) {
      toast.error('Select a startup first')
      return
    }
    if (roles.length === 0) {
      toast.error('Select at least one role')
      return
    }
    setRunning(true)
    try {
      const result = await runStartupMatching(startupId, { roles, min_score: minScore })
      setLastRun({ total: result.total_scored, kept: result.matches_kept })
      // The run response has bare matches; re-fetch persisted rows to attach user details.
      const refreshed = await listStartupMatches(startupId)
      setFounderMatches(refreshed.matches)
      toast.success(`Matched ${result.matches_kept} candidates`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setRunning(false)
    }
  }, [startupId, roles, minScore])

  const loadMyMatches = useCallback(async () => {
    setLoadingMine(true)
    try {
      const res = await getMyMatches()
      setMyMatches(res.matches)
    } catch {
      // non-founder users may not have matches — silently ignore
    } finally {
      setLoadingMine(false)
    }
  }, [])

  useEffect(() => {
    void loadMyMatches()
  }, [loadMyMatches])

  // Refresh persisted founder matches when the startup changes.
  useEffect(() => {
    if (!startupId) return
    listStartupMatches(startupId)
      .then((res) => setFounderMatches(res.matches))
      .catch(() => setFounderMatches([]))
  }, [startupId])

  const founderHasMatches = founderMatches.length > 0

  const roleSummary = useMemo(
    () => (lastRun ? `${lastRun.kept} kept out of ${lastRun.total} scored` : null),
    [lastRun],
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Handshake size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Explainable AI Matching</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Weighted, transparent matches built from real profile data — every score explains itself.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Founder run panel */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              <Sparkles size={15} className="text-primary" /> Run matching for your startup
            </h2>
            <StartupPicker
              startupId={startupId}
              onChange={setStartupId}
              onRefresh={() => void runMatching()}
              refreshing={running}
            />

            <div className="mt-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Match these roles
              </label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => toggleRole(r.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      roles.includes(r.value)
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-dark-300 dark:text-gray-300 dark:hover:bg-dark-200'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Minimum score
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">{minScore}</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <button
              onClick={() => void runMatching()}
              disabled={running || !startupId}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Handshake size={16} />}
              {running ? 'Matching...' : 'Run AI Matching'}
            </button>
            {roleSummary ? (
              <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">{roleSummary}</p>
            ) : null}
          </div>

          {/* My matches panel */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              <Handshake size={15} className="text-primary" /> Matches for me
            </h2>
            {loadingMine ? (
              <div className="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-dark-300" />
            ) : myMatches.length === 0 ? (
              <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-dark dark:text-gray-400">
                No matches for you yet. Founders run AI Matching to find people like you — complete your profile
                (skills, experience, location) to improve your match scores.
              </p>
            ) : (
              <ul className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {myMatches.map((m) => (
                  <li
                    key={m.match.id}
                    className="rounded-xl border border-gray-200 p-4 dark:border-dark-300"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/startups/${m.startup?.id ?? ''}`}
                          className="text-sm font-bold text-gray-900 hover:underline dark:text-white"
                        >
                          {m.startup?.name ?? 'Startup'}
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {[m.startup?.industry, m.startup?.stage, m.startup?.location].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        {m.match.score}
                      </span>
                    </div>
                    {m.match.reasons.length > 0 && (
                      <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                        {m.match.reasons[0].detail}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Founder results */}
        {!running && founderHasMatches && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
              Matching results
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {founderMatches.map((row) => (
                <MatchCard key={row.match.id} row={row} />
              ))}
            </div>
          </div>
        )}

        {!running && !founderHasMatches && startupId && (
          <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
            No matches yet for this startup. Run AI Matching above to discover and save candidates.
          </p>
        )}
      </div>
    </div>
  )
}
