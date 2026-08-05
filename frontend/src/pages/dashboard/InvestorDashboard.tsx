import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Compass,
  Heart,
  Eye,
  Users,
  Send,
  ArrowRight,
  Bell,
  Settings2,
  X,
  Loader2,
  Sparkles,
  Bookmark,
} from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  getInvestorRecommendations,
  getRecentlyViewed,
  getSavedStartups,
} from '../../lib/startups'
import { updateProfile } from '../../lib/profile'
import { useSavedStartups } from '../../hooks/useSavedStartups'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { StartupCardSkeleton, StatCardSkeleton } from '../../components/dashboard/Skeleton'
import { NotificationStrip } from '../../components/dashboard/NotificationStrip'
import { PeopleToConnect } from '../../components/dashboard/PeopleToConnect'
import { StatCard } from '../../components/dashboard/StatCard'
import { INVESTOR_INTERESTS } from '../../types'
import { capitalize } from '../../lib/helpers'
import type { Startup } from '../../types'

const STAGES = [
  { value: 'idea', label: 'Idea Stage' },
  { value: 'mvp', label: 'MVP' },
  { value: 'growth', label: 'Growth' },
  { value: 'scaling', label: 'Scaling' },
]

const RANGE_PRESETS = [
  { min: 10_000, max: 100_000, label: '$10K–$100K' },
  { min: 100_000, max: 500_000, label: '$100K–$500K' },
  { min: 500_000, max: 1_000_000, label: '$500K–$1M' },
  { min: 1_000_000, max: 10_000_000, label: '$1M+' },
]

async function countRows(table: string, field: string, value: string): Promise<number> {
  try {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(field, value)
    return count ?? 0
  } catch {
    return 0
  }
}

async function countConnections(value: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .or(`requester_id.eq.${value},receiver_id.eq.${value}`)
    return count ?? 0
  } catch {
    return 0
  }
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function InvestorDashboard() {
  const { user, profile, refreshProfile } = useSession()
  const { savedIds, toggleSave } = useSavedStartups(user?.id)
  const [recommended, setRecommended] = useState<{ startup: Startup; score: number }[]>([])
  const [recentlyViewed, setRecentlyViewed] = useState<Startup[]>([])
  const [saved, setSaved] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ browsed: 0, saved: 0, connections: 0, messages: 0 })
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const [draftInterests, setDraftInterests] = useState<string[]>([])
  const [draftMin, setDraftMin] = useState(10_000)
  const [draftMax, setDraftMax] = useState(100_000)
  const [draftStages, setDraftStages] = useState<string[]>(['idea', 'mvp'])

  useEffect(() => {
    if (!profile) return
    setDraftInterests(profile.investor_interests ?? [])
    setDraftMin(profile.investment_range_min ?? 10_000)
    setDraftMax(profile.investment_range_max ?? 100_000)
    setDraftStages(profile.investment_stage ?? ['idea', 'mvp'])
  }, [profile])

  useEffect(() => {
    if (!profile || !user) return
    Promise.all([
      getInvestorRecommendations(profile, 6).then((r) => setRecommended(r)),
      getRecentlyViewed(user.id, 4).then(setRecentlyViewed).catch(() => {}),
      getSavedStartups(user.id).then(setSaved).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [profile, user])

  useEffect(() => {
    if (!user) return
    Promise.all([
      countRows('startup_views', 'viewer_id', user.id),
      countRows('messages', 'sender_id', user.id),
      countConnections(user.id),
    ])
      .then(([browsed, messages, connections]) => {
        setStats({
          browsed,
          saved: Object.values(savedIds).filter(Boolean).length,
          connections,
          messages,
        })
      })
      .catch(() => {})
  }, [user, savedIds])

  const openPrefs = () => {
    setDraftInterests(profile?.investor_interests ?? [])
    setDraftMin(profile?.investment_range_min ?? 10_000)
    setDraftMax(profile?.investment_range_max ?? 100_000)
    setDraftStages(profile?.investment_stage ?? ['idea', 'mvp'])
    setPrefsOpen(true)
  }

  const toggleInterest = (value: string) =>
    setDraftInterests((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value],
    )

  const toggleStage = (value: string) =>
    setDraftStages((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    )

  const savePrefs = async () => {
    if (!user) return
    setSavingPrefs(true)
    try {
      await updateProfile(user.id, {
        investor_interests: draftInterests,
        investment_range_min: draftMin,
        investment_range_max: draftMax,
        investment_stage: draftStages,
      })
      toast.success('Investment preferences saved — matching is now tuned to you.')
      setPrefsOpen(false)
      await refreshProfile()
    } catch {
      toast.error('Could not save preferences')
    } finally {
      setSavingPrefs(false)
    }
  }

  const firstName = profile?.full_name?.split(' ')[0]
  const needsSetup = !profile?.investor_interests?.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName ?? 'Investor'} 👋
        </h1>
        <p className="mt-1 text-gray-500">Discover and track the startups worth betting on.</p>
      </div>

      {/* Investor setup banner */}
      {needsSetup && (
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-6 w-6 flex-shrink-0 text-primary" />
            <div>
              <p className="font-bold">Complete your investor profile</p>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                Tell us your sectors, budget and stage — we'll match you with the right startups
                automatically.
              </p>
            </div>
          </div>
          <button onClick={openPrefs} className="btn-primary flex-shrink-0">
            <Settings2 className="h-4 w-4" />
            Set Investment Preferences
          </button>
        </div>
      )}

      {/* CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-8 text-white">
        <div className="relative z-10">
          <h2 className="text-xl font-bold sm:text-2xl">Your next deal is one match away</h2>
          <p className="mt-2 max-w-lg text-white/80">
            FounderHub AI surfaces startups in your sectors, sorted by fit.
          </p>
          <Link
            to="/explore"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary transition-transform hover:scale-105"
          >
            <Compass className="h-4 w-4" />
            Discover Deals
          </Link>
        </div>
      </div>

      <NotificationStrip userId={user?.id ?? ''} />

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard icon={Eye} label="Startups browsed" value={stats.browsed} />
            <StatCard icon={Heart} label="Startups saved" value={stats.saved} />
            <StatCard icon={Users} label="Connections made" value={stats.connections} />
            <StatCard icon={Send} label="Messages sent" value={stats.messages} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recommended startups */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <Sparkles className="h-4 w-4 text-primary" />
              Recommended for You
            </h2>
            <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <StartupCardSkeleton />
              <StartupCardSkeleton />
            </div>
          ) : recommended.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-dark-400">
              <Sparkles className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-3 font-semibold">No high-fit startups yet</p>
              <p className="mt-1 text-sm text-gray-500">
                {needsSetup
                  ? 'Set your investment preferences to unlock matches.'
                  : 'New matching startups will appear here when founders publish them.'}
              </p>
              {needsSetup && (
                <button onClick={openPrefs} className="btn-primary mt-4">
                  Set Preferences
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {recommended.map(({ startup, score }) => (
                <StartupCard
                  key={startup.id}
                  startup={startup}
                  match={score}
                  showFunding
                  saved={!!savedIds[startup.id]}
                  onToggleSave={() => toggleSave(startup.id)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          {/* Recently viewed */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="font-bold">Recently Viewed</h2>
            <p className="mt-1 text-sm text-gray-500">Startups you've checked out.</p>
            <div className="mt-4 space-y-3">
              {recentlyViewed.length === 0 ? (
                <p className="text-sm text-gray-500">No views yet — explore deals to build your shortlist.</p>
              ) : (
                recentlyViewed.map((startup) => (
                  <div
                    key={startup.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-dark-300"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{startup.name}</p>
                      <p className="truncate text-xs text-gray-500">{startup.industry}</p>
                    </div>
                    <button
                      onClick={() => toggleSave(startup.id)}
                      aria-label="Save startup"
                      className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-primary"
                    >
                      {savedIds[startup.id] ? (
                        <Bookmark className="h-4 w-4 fill-primary text-primary" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Saved startups */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="font-bold">Saved Startups</h2>
            <p className="mt-1 text-sm text-gray-500">Your shortlist.</p>
            <div className="mt-4 space-y-3">
              {saved.length === 0 ? (
                <p className="text-sm text-gray-500">Nothing saved yet.</p>
              ) : (
                saved.slice(0, 4).map((startup) => (
                  <Link
                    key={startup.id}
                    to={`/startups/${startup.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 transition-colors hover:border-primary/40 dark:border-dark-300"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{startup.name}</p>
                      <p className="truncate text-xs text-gray-500">{startup.industry} · {capitalize(startup.stage ?? '')}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  </Link>
                ))
              )}
            </div>
            {saved.length > 4 && (
              <Link to="/dashboard/saved" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2">
                View all saved
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </section>

          {profile && <PeopleToConnect user={profile} />}
        </div>
      </div>

      {/* Preferences modal */}
      {prefsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setPrefsOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold">Investment Preferences</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  These tune your matches and the emails you receive.
                </p>
              </div>
              <button
                onClick={() => setPrefsOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-5">
              <div>
                <p className="mb-2 text-sm font-medium">Industries you invest in</p>
                <div className="flex flex-wrap gap-2">
                  {INVESTOR_INTERESTS.map((sector) => (
                    <button
                      key={sector}
                      type="button"
                      onClick={() => toggleInterest(sector)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        draftInterests.includes(sector)
                          ? 'bg-primary text-white'
                          : 'border border-gray-200 text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300'
                      }`}
                    >
                      {sector}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Investment range per deal</p>
                <div className="grid grid-cols-2 gap-2">
                  {RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setDraftMin(preset.min)
                        setDraftMax(preset.max)
                      }}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        draftMin === preset.min && draftMax === preset.max
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Min ($)</label>
                    <input
                      type="number"
                      value={draftMin}
                      min={0}
                      onChange={(e) => setDraftMin(Number(e.target.value) || 0)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500">Max ($)</label>
                    <input
                      type="number"
                      value={draftMax}
                      min={0}
                      onChange={(e) => setDraftMax(Number(e.target.value) || 0)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Preferred stages</p>
                <div className="flex flex-wrap gap-2">
                  {STAGES.map((stage) => (
                    <button
                      key={stage.value}
                      type="button"
                      onClick={() => toggleStage(stage.value)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        draftStages.includes(stage.value)
                          ? 'bg-accent text-white'
                          : 'border border-gray-200 text-gray-600 hover:border-accent hover:text-accent dark:border-dark-300 dark:text-gray-300'
                      }`}
                    >
                      {stage.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={savePrefs}
              disabled={savingPrefs}
              className="btn-primary mt-6 w-full disabled:opacity-60"
            >
              {savingPrefs ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
