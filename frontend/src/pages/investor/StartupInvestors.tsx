import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Building2,
  Handshake,
  Loader2,
  MessageSquare,
  MessageCircle,
  Sparkles,
  UserPlus,
  Check,
  Wallet,
  Briefcase,
  Palette,
  Megaphone,
  MapPin,
} from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { Avatar } from '../../components/Avatar'
import { ConnectButton } from '../../components/ConnectButton'
import { useSession } from '../../context/AuthContext'
import { getStartupById } from '../../lib/startups'
import { findInvestors, getStartupInvestorMatches, sendInvestorRequest } from '../../lib/investorMatch'
import { searchProfilesByRole, type PeopleSearchResult } from '../../lib/profile'
import { ROLE_LABELS, type Role } from '../../types'
import { capitalize } from '../../lib/helpers'
import type { InvestorMatch, InvestorMatchResult, Startup } from '../../types'

interface DisplayMatch {
  investor_id: string
  name: string
  username: string | null
  avatar_url: string | null
  role: string
  city: string | null
  score: number
  reasons: string[]
  thesis: string | null
  checkLabel: string | null
  status: string
}

const statusLabel: Record<string, { text: string; cls: string }> = {
  pending: { text: 'Intro sent', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  viewed: { text: 'Viewed', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  interested: { text: 'Interested', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  meeting_scheduled: { text: 'Meeting scheduled', cls: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  passed: { text: 'Passed', cls: 'bg-red-500/15 text-red-500' },
}

function scoreColor(score: number) {
  if (score >= 70) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (score >= 55) return 'bg-primary/15 text-primary'
  return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
}

function formatCheckRange(min?: number | null, max?: number | null) {
  if (min == null && max == null) return null
  const fmt = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K` : `$${n}`)
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`
  if (min != null) return `${fmt(min)}+`
  return `up to ${fmt(max!)}`
}

const ROLE_TABS: { key: Role; label: string; icon: typeof Briefcase }[] = [
  { key: 'investor', label: 'Investors', icon: Wallet },
  { key: 'developer', label: 'Developers', icon: Briefcase },
  { key: 'marketer', label: 'Marketers', icon: Megaphone },
  { key: 'designer', label: 'Designers', icon: Palette },
]

export default function StartupInvestors() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useSession()

  const [tab, setTab] = useState<Role>('investor')

  const [startup, setStartup] = useState<Startup | null>(null)
  const [matches, setMatches] = useState<DisplayMatch[]>([])
  const [loadingStartup, setLoadingStartup] = useState(true)
  const [finding, setFinding] = useState(false)
  const [requestTarget, setRequestTarget] = useState<DisplayMatch | null>(null)
  const [messageDraft, setMessageDraft] = useState('')
  const [sending, setSending] = useState(false)

  const [people, setPeople] = useState<PeopleSearchResult[]>([])
  const [peopleQuery, setPeopleQuery] = useState('')
  const [loadingPeople, setLoadingPeople] = useState(false)

  const isPeopleTab = tab !== 'investor'

  useEffect(() => {
    if (!id) return
    getStartupById(id)
      .then(setStartup)
      .catch(() => toast.error('Could not load startup'))
      .finally(() => setLoadingStartup(false))
  }, [id])

  const loadMatches = useCallback(async () => {
    if (!id) return
    try {
      const res = await getStartupInvestorMatches(id)
      setMatches(res.matches.map(toDisplay))
    } catch {
      // No matches yet — fine.
    }
  }, [id])

  useEffect(() => {
    loadMatches()
  }, [loadMatches])

  useEffect(() => {
    if (!isPeopleTab) return
    let active = true
    setLoadingPeople(true)
    searchProfilesByRole(tab, { query: peopleQuery || undefined, excludeUserId: user?.id })
      .then((list) => {
        if (active) setPeople(list)
      })
      .catch(() => {
        if (active) toast.error('Could not load people')
      })
      .finally(() => {
        if (active) setLoadingPeople(false)
      })
    return () => {
      active = false
    }
  }, [tab, peopleQuery, isPeopleTab, user?.id])

  const runFind = async () => {
    if (!id) return
    setFinding(true)
    try {
      const res = await findInvestors(id)
      setMatches(res.matches.map(toDisplayResult))
      toast.success(res.total > 0 ? `${res.total} matching investors found!` : 'No matching investors yet')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not run investor matching')
    } finally {
      setFinding(false)
    }
  }

  const openRequestModal = (m: DisplayMatch) => {
    setRequestTarget(m)
    const first = m.name.split(' ')[0] ?? 'there'
    const msg = `Hi ${first}, I'm building ${startup?.name ?? 'my startup'} and would love to explore a conversation about partnering. We're looking to raise at our ${startup?.stage ?? 'current'} stage. Would you be open to a quick call?`
    setMessageDraft(msg)
  }

  const sendIntro = async () => {
    if (!requestTarget || !id) return
    if (!messageDraft.trim()) {
      toast.error('Please write an intro message')
      return
    }
    setSending(true)
    try {
      await sendInvestorRequest(id, requestTarget.investor_id, messageDraft.trim())
      toast.success(`Intro request sent to ${requestTarget.name}`)
      setRequestTarget(null)
      loadMatches()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send intro request')
    } finally {
      setSending(false)
    }
  }

  const openChat = (userId: string) => {
    navigate(`/messages?user=${userId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Find People" backTo={id ? `/startups/${id}` : '/dashboard'} backLabel="Back to Startup" />
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-24 sm:px-6 lg:pb-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Handshake className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">
                {isPeopleTab ? `Find ${ROLE_LABELS[tab]}s` : `AI Investor Matching${startup ? ` — ${startup.name}` : ''}`}
              </h1>
              <p className="text-sm text-gray-500">
                {isPeopleTab
                  ? `Browse ${ROLE_LABELS[tab]}s on FounderHub and connect or message them.`
                  : 'Investors ranked by industry fit, stage, check size and region.'}
              </p>
            </div>
          </div>
          {!isPeopleTab && (
            <button onClick={runFind} disabled={finding || !startup} className="btn-primary disabled:opacity-60">
              {finding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Matching…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> {matches.length > 0 ? 'Re-run Match' : 'Find Investors'}
                </>
              )}
            </button>
          )}
        </div>

        {/* Role tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          {ROLE_TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-primary hover:text-primary dark:border-dark-300 dark:bg-dark-100 dark:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            )
          })}
        </div>

        {!isPeopleTab && loadingStartup && (
          <div className="h-8 w-64 animate-pulse rounded-lg bg-gray-200 dark:bg-dark-200" />
        )}

        {!isPeopleTab && !loadingStartup && startup && (
          <div className="mb-6 grid gap-3 rounded-2xl border border-gray-200 bg-white p-5 sm:grid-cols-3 dark:border-dark-300 dark:bg-dark-100">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="font-semibold">{capitalize(startup.industry)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold">{capitalize(startup.stage)} stage</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Wallet className="h-4 w-4 text-primary" />
              <span className="font-semibold">Asking {startup.funding_needed ?? 'N/A'}</span>
            </div>
          </div>
        )}

        {isPeopleTab ? (
          <PeopleBrowser
            people={people}
            loading={loadingPeople}
            query={peopleQuery}
            onQueryChange={setPeopleQuery}
            onMessage={openChat}
            selfId={user?.id}
          />
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-dark-400">
            <Handshake className="h-10 w-10 text-gray-400" />
            <h2 className="mt-4 text-lg font-bold">No investor matches yet</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500">
              Run AI matching to surface investors whose thesis, check size and stage fit your
              startup. Then send each one a personalized intro request.
            </p>
            <button onClick={runFind} disabled={finding} className="btn-primary mt-6 disabled:opacity-60">
              {finding ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Matching…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Find Investors
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {matches.map((m) => {
              const status = statusLabel[m.status]
              const contactable = !m.status || m.status === 'passed'
              return (
                <div
                  key={m.investor_id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100"
                >
                  <div className="flex items-start gap-4">
                    <Link to={m.username ? `/profile/${m.username}` : '#'}>
                      <Avatar src={m.avatar_url} name={m.name} size="md" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={m.username ? `/profile/${m.username}` : '#'}
                          className="truncate font-bold hover:text-primary"
                        >
                          {m.name}
                        </Link>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${scoreColor(m.score)}`}>
                          {m.score}% match
                        </span>
                        {status && (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.cls}`}>
                            {status.text}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {m.role ? ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] : 'Investor'}
                        {m.city ? ` · ${capitalize(m.city)}` : ''}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                          >
                            <Check className="h-3 w-3" /> {reason}
                          </span>
                        ))}
                      </div>

                      {m.thesis && (
                        <p className="mt-3 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{m.thesis}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {m.checkLabel && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-dark-200 dark:text-gray-300">
                          <Wallet className="h-3 w-3" /> {m.checkLabel}
                        </span>
                      )}
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          onClick={() => openChat(m.investor_id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Message
                        </button>
                        {contactable && (
                          <button
                            onClick={() => openRequestModal(m)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Send Intro
                          </button>
                        )}
                        <ConnectButton targetId={m.investor_id} targetName={m.name} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Intro request modal */}
      {requestTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setRequestTarget(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Avatar src={requestTarget.avatar_url} name={requestTarget.name} size="md" />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-extrabold">{requestTarget.name}</h2>
                <p className="text-xs text-gray-500">{requestTarget.score}% match · AI ranked</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              Your intro message is sent directly to the investor and they get notified instantly.
            </p>

            <textarea
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value)}
              rows={5}
              maxLength={600}
              className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
            <p className="mt-1 text-right text-xs text-gray-400">{messageDraft.length}/600</p>

            <button onClick={sendIntro} disabled={sending} className="btn-primary mt-3 w-full disabled:opacity-60">
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4" /> Send Intro Request
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Role-based people browser (Developers / Marketers / Designers)
// ---------------------------------------------------------------------------

function PeopleBrowser({
  people,
  loading,
  query,
  onQueryChange,
  onMessage,
  selfId,
}: {
  people: PeopleSearchResult[]
  loading: boolean
  query: string
  onQueryChange: (q: string) => void
  onMessage: (userId: string) => void
  selfId?: string
}) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name or skill…"
          className="w-full max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark-100"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-dark-200" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-dark-400">
          <Handshake className="h-10 w-10 text-gray-400" />
          <h2 className="mt-4 text-lg font-bold">No people found</h2>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            {query ? `Nothing matches "${query}". Try a different name or skill.` : 'No profiles listed yet in this role.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {people.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100"
            >
              <div className="flex items-start gap-3">
                <Link to={p.username ? `/profile/${p.username}` : '#'}>
                  <Avatar src={p.avatar_url} name={p.full_name ?? 'Member'} size="md" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={p.username ? `/profile/${p.username}` : '#'}
                    className="block truncate font-bold hover:text-primary"
                  >
                    {p.full_name ?? 'New Member'}
                  </Link>
                  {p.username && <p className="text-xs text-gray-400">@{p.username}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {p.role && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {ROLE_LABELS[p.role as keyof typeof ROLE_LABELS] ?? p.role}
                      </span>
                    )}
                    {p.is_open_to_work && (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                        Open to work
                      </span>
                    )}
                  </div>
                  {p.city && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" /> {capitalize(p.city)}
                      {p.country ? `, ${capitalize(p.country)}` : ''}
                    </p>
                  )}
                </div>
              </div>

              {p.bio && <p className="mt-3 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{p.bio}</p>}

              {p.skills && p.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.skills.slice(0, 5).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-dark-200 dark:text-gray-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {p.id !== selfId && (
                  <>
                    <button
                      onClick={() => onMessage(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Message
                    </button>
                    <ConnectButton targetId={p.id} targetName={p.full_name} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function toDisplay(m: InvestorMatch): DisplayMatch {
  const inv = m.investor
  const prof = m.investor_profile
  return {
    investor_id: m.investor_id,
    name: inv?.full_name ?? 'Investor',
    username: inv?.username ?? null,
    avatar_url: inv?.avatar_url ?? null,
    role: inv?.role ?? '',
    city: inv?.city ?? null,
    score: m.match_score ?? 0,
    reasons: m.reasons ?? [],
    thesis: prof?.investment_thesis ?? null,
    checkLabel: formatCheckRange(prof?.check_size_min, prof?.check_size_max),
    status: m.status,
  }
}

function toDisplayResult(m: InvestorMatchResult): DisplayMatch {
  const inv = m.investor
  const prof = inv?.investor_profiles
  return {
    investor_id: inv.id,
    name: inv.full_name ?? 'Investor',
    username: inv.username ?? null,
    avatar_url: inv.avatar_url ?? null,
    role: inv.role ?? '',
    city: inv.city ?? null,
    score: m.score,
    reasons: m.reasons ?? [],
    thesis: prof?.investment_thesis ?? null,
    checkLabel: formatCheckRange(prof?.check_size_min, prof?.check_size_max),
    status: m.status,
  }
}
