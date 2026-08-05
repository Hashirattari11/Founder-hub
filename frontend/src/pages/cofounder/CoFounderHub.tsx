import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Handshake,
  UserPlus,
  Send,
  Inbox,
  Check,
  X,
  Sparkles,
  Loader2,
  ArrowRight,
  Users,
  MessageSquare,
  Code2,
  Megaphone,
  Brush,
  Rocket,
} from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonCard } from '../../components/dashboard/Skeleton'
import { useSession } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../types'
import {
  getCoFounderMatches,
  getCoFounderPreferences,
  getCoFounderRequests,
  respondCoFounderRequest,
  sendCoFounderRequest,
} from '../../lib/cofounder'
import { timeAgo, capitalize } from '../../lib/helpers'
import type { CoFounderMatch, CoFounderRequest } from '../../types'

const ROLE_CONTENT: Record<
  string,
  { heading: string; subheading: string; lookingFor: string; emptyState: string }
> = {
  founder: {
    heading: 'Find Your Co-Founder',
    subheading: 'AI matches you with technical and growth co-founders',
    lookingFor: 'Looking for: Developer, Designer, or Marketer',
    emptyState: 'No matches yet. Complete your preferences to get matched.',
  },
  developer: {
    heading: 'Find a Business Co-Founder',
    subheading: 'AI matches you with founders and marketers who need your skills',
    lookingFor: 'Looking for: Founder, Marketer, or Designer',
    emptyState: 'No matches yet. Update your co-founder preferences.',
  },
  designer: {
    heading: 'Find Your Co-Founder',
    subheading: 'AI matches you with developers and founders who need design',
    lookingFor: 'Looking for: Developer, Founder, or Marketer',
    emptyState: 'No matches yet. Set your co-founder preferences first.',
  },
  marketer: {
    heading: 'Find Your Co-Founder',
    subheading: 'AI matches you with technical and product co-founders',
    lookingFor: 'Looking for: Developer, Founder, or Designer',
    emptyState: 'No matches yet. Complete your profile and preferences.',
  },
}

const COMPLEMENTARY_BADGES: Record<
  string,
  { label: string; cls: string; icon: typeof Code2 }
> = {
  developer: {
    label: 'Technical Co-Founder',
    cls: 'bg-blue-500/20 text-blue-600 border border-blue-500/30 dark:text-blue-400',
    icon: Code2,
  },
  marketer: {
    label: 'Growth Co-Founder',
    cls: 'bg-green-500/20 text-green-600 border border-green-500/30 dark:text-green-400',
    icon: Megaphone,
  },
  designer: {
    label: 'Design Co-Founder',
    cls: 'bg-amber-500/20 text-amber-600 border border-amber-500/30 dark:text-amber-400',
    icon: Brush,
  },
  founder: {
    label: 'Business Co-Founder',
    cls: 'bg-purple-500/20 text-purple-600 border border-purple-500/30 dark:text-purple-400',
    icon: Rocket,
  },
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
      : score >= 55
        ? 'bg-primary/15 text-primary'
        : 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${color}`}>
      {score}% match
    </span>
  )
}

export default function CoFounderHub() {
  const { user, profile } = useSession()
  const navigate = useNavigate()
  const role = (profile?.role ?? 'founder').toLowerCase()
  const content = ROLE_CONTENT[role] ?? ROLE_CONTENT.founder

  const [matches, setMatches] = useState<CoFounderMatch[]>([])
  const [received, setReceived] = useState<CoFounderRequest[]>([])
  const [sent, setSent] = useState<CoFounderRequest[]>([])
  const [hasPrefs, setHasPrefs] = useState(true)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [messageDraft, setMessageDraft] = useState<Record<string, string>>({})
  const [requestModal, setRequestModal] = useState<CoFounderMatch | null>(null)

  useEffect(() => {
    if (role === 'investor') {
      navigate('/explore', { replace: true })
    }
  }, [role, navigate])

  const load = useCallback(async () => {
    if (!user || role === 'investor') return
    try {
      const [matchRes, reqRes, prefs] = await Promise.all([
        getCoFounderMatches(user.id),
        getCoFounderRequests(user.id),
        getCoFounderPreferences(user.id),
      ])
      setMatches(matchRes.matches)
      setHasPrefs(!!prefs)
      setReceived(reqRes.received.filter((r) => r.status === 'pending'))
      setSent(reqRes.sent)
    } catch {
      toast.error('Could not load co-founder hub')
    } finally {
      setLoading(false)
    }
  }, [user, role])

  useEffect(() => {
    load()
  }, [load])

  if (role === 'investor') {
    return null
  }

  const sendRequest = async (target: CoFounderMatch) => {
    const message = messageDraft[target.profile.id]?.trim()
    if (!message) {
      toast.error('Please write a short message')
      return
    }
    setSending(target.profile.id)
    try {
      await sendCoFounderRequest(target.profile.id, message)
      toast.success(`Co-founder request sent to ${target.profile.full_name}`)
      setRequestModal(null)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send request')
    } finally {
      setSending(null)
    }
  }

  const respond = async (request: CoFounderRequest, status: 'accepted' | 'rejected') => {
    try {
      const res = await respondCoFounderRequest(request.id, status)
      toast.success(status === 'accepted' ? 'Request accepted — chat opened!' : 'Request declined')
      setReceived((prev) => prev.filter((r) => r.id !== request.id))
      if (status === 'accepted' && res.chat_with) {
        navigate(`/messages?user=${res.chat_with}`)
      } else {
        load()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not respond')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title={content.heading} backTo="/dashboard" backLabel="Back to Dashboard" />
      <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:px-6 lg:pb-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Handshake className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">{content.heading}</h1>
              <p className="text-sm text-gray-500">{content.subheading}</p>
              <p className="mt-0.5 text-xs font-semibold text-primary">{content.lookingFor}</p>
            </div>
          </div>
          <Link
            to="/co-founder/preferences"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark"
          >
            <Sparkles className="h-4 w-4" />
            {hasPrefs ? 'Edit Preferences' : 'Set My Preferences'}
          </Link>
        </div>

        {!hasPrefs && (
          <div className="mb-6 flex flex-col items-start gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-6 w-6 flex-shrink-0 text-primary" />
              <div>
                <p className="font-bold">Tell us what you are looking for in a co-founder</p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                  Set your preferences to unlock AI-ranked co-founder matches.
                </p>
              </div>
            </div>
            <Link to="/co-founder/preferences" className="btn-primary flex-shrink-0">
              Set My Preferences
            </Link>
          </div>
        )}

        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: 'Matches', value: matches.length, icon: Users },
            { label: 'Requests sent', value: sent.length, icon: Send },
            { label: 'Pending received', value: received.length, icon: Inbox },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xl font-extrabold leading-none">{s.value}</p>
                <p className="mt-1 text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <section className="mb-8">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            <Sparkles className="h-4 w-4 text-primary" />
            Top Matches (AI ranked)
          </h2>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : matches.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title={hasPrefs ? 'No high-fit co-founders yet' : 'Set preferences to get matches'}
              description={hasPrefs ? content.emptyState : 'Add what you are looking for and we will rank the best fits.'}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((m) => {
                const badge = COMPLEMENTARY_BADGES[m.complementary_role ?? ''] ?? COMPLEMENTARY_BADGES.founder
                const BadgeIcon = badge.icon
                return (
                  <div
                    key={m.profile.id}
                    className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar src={m.profile.avatar_url} name={m.profile.full_name} size="md" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/profile/${m.profile.username}`}
                          className="block truncate font-bold hover:text-primary"
                        >
                          {m.profile.full_name}
                        </Link>
                        <p className="text-xs text-gray-500">
                          {m.profile.role ? ROLE_LABELS[m.profile.role] : 'Member'}
                          {m.profile.city ? ` · ${capitalize(m.profile.city)}` : ''}
                        </p>
                        <div className="mt-1.5">
                          <ScoreBadge score={m.score} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                      >
                        <BadgeIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                      {(m.profile.skills ?? []).slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-dark-200 dark:text-gray-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 space-y-1">
                      {m.reasons.map((reason) => (
                        <p
                          key={reason}
                          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
                        >
                          <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
                          {reason}
                        </p>
                      ))}
                    </div>

                    {m.profile.bio && (
                      <p className="mt-3 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{m.profile.bio}</p>
                    )}

                    <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4 dark:border-dark-300">
                      <button
                        onClick={() => setRequestModal(m)}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark"
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Connect as Co-Founder
                      </button>
                      <Link
                        to={`/profile/${m.profile.username}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-primary hover:text-primary dark:border-dark-300 dark:text-gray-300"
                      >
                        Profile <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Pending received */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <Inbox className="h-4 w-4 text-primary" />
              Pending Requests ({received.length})
            </h2>
            {received.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-dark-400">
                No incoming co-founder requests yet.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {received.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={r.requester?.avatar_url} name={r.requester?.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/profile/${r.requester?.username}`}
                          className="block truncate text-sm font-bold hover:text-primary"
                        >
                          {r.requester?.full_name}
                        </Link>
                        <p className="text-xs text-gray-500">
                          {r.requester?.role ? ROLE_LABELS[r.requester.role] : 'Member'} · {timeAgo(r.created_at)}
                        </p>
                      </div>
                      {r.match_score != null && <ScoreBadge score={r.match_score} />}
                    </div>
                    {r.message && (
                      <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-dark-200 dark:text-gray-300">
                        “{r.message}”
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => respond(r, 'accepted')}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-600"
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => respond(r, 'rejected')}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/10"
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sent */}
          <section>
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <Send className="h-4 w-4 text-primary" />
              Sent Requests
            </h2>
            {sent.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-dark-400">
                Requests you send will show up here.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {sent.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-300 dark:bg-dark-100"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={r.target?.avatar_url} name={r.target?.full_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/profile/${r.target?.username}`}
                          className="block truncate text-sm font-bold hover:text-primary"
                        >
                          {r.target?.full_name}
                        </Link>
                        <p className="text-xs text-gray-500">
                          {r.target?.role ? ROLE_LABELS[r.target.role] : 'Member'} · {timeAgo(r.created_at)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          r.status === 'accepted'
                            ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                            : r.status === 'rejected'
                              ? 'bg-red-500/15 text-red-500'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {capitalize(r.status)}
                      </span>
                    </div>
                    {r.status === 'accepted' && (
                      <button
                        onClick={() => navigate(`/messages?user=${r.target_id}`)}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Open Chat
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Connect modal */}
      {requestModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setRequestModal(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Avatar src={requestModal.profile.avatar_url} name={requestModal.profile.full_name} size="md" />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-extrabold">{requestModal.profile.full_name}</h2>
                <p className="text-xs text-gray-500">
                  {requestModal.profile.role ? ROLE_LABELS[requestModal.profile.role] : 'Member'}
                  {` · ${requestModal.score}% match`}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              Why do you want to co-found together? Your message is sent with the request.
            </p>
            <textarea
              value={messageDraft[requestModal.profile.id] ?? ''}
              onChange={(e) =>
                setMessageDraft((prev) => ({ ...prev, [requestModal.profile.id]: e.target.value }))
              }
              rows={4}
              maxLength={500}
              placeholder="e.g. Your full-stack skills + my GTM experience would make a killer team..."
              className="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 dark:border-dark-300 dark:bg-dark"
            />
            <button
              onClick={() => sendRequest(requestModal)}
              disabled={sending === requestModal.profile.id}
              className="btn-primary mt-4 w-full disabled:opacity-60"
            >
              {sending === requestModal.profile.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Send Request
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
