import { useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Calendar,
  Coins,
  FileText,
  Globe,
  ExternalLink,
  MapPin,
  MessageCircle,
  Wrench,
  Rocket,
} from 'lucide-react'
import { AppHeader } from '../../components/AppHeader'
import { Avatar } from '../../components/Avatar'
import { ApplyModal } from '../../components/ApplyModal'
import { SkeletonCard } from '../../components/dashboard/Skeleton'
import { EmptyState } from '../../components/EmptyState'
import { useSession } from '../../context/AuthContext'
import { useSavedStartups } from '../../hooks/useSavedStartups'
import { getStartupById, trackStartupView } from '../../lib/startups'
import { hasApplied } from '../../lib/applications'
import { capitalize, formatDate, skillsMatchPercent } from '../../lib/helpers'
import type { Startup } from '../../types'

export default function StartupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, profile } = useSession()
  const { savedIds, toggleSave } = useSavedStartups(user?.id)
  const [startup, setStartup] = useState<Startup | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [applied, setApplied] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setNotFound(false)
    getStartupById(id)
      .then((data) => {
        if (!active) return
        if (!data || !data.is_published) {
          setNotFound(true)
        } else {
          setStartup(data)
          trackStartupView(data.id, user?.id ?? null)
        }
      })
      .catch(() => {
        if (active) setNotFound(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, user?.id])

  useEffect(() => {
    if (!id || !user) return
    hasApplied(id, user.id)
      .then(setApplied)
      .catch(() => {})
  }, [id, user, applyOpen])

  const founder = startup?.profiles
  const isOwnStartup = user?.id === startup?.founder_id

  const skillMatch = useMemo(
    () => (startup ? skillsMatchPercent(profile?.skills ?? [], startup.tech_stack ?? []) : 0),
    [startup, profile],
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="Startup" backTo="/explore" />
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <SkeletonCard />
          <div className="mt-6 grid gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </div>
    )
  }

  if (notFound || !startup) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-dark">
        <AppHeader title="Startup" backTo="/explore" />
        <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <EmptyState
            icon={Rocket}
            title="Startup not found"
            description="This startup may have been removed or unpublished."
            action={{ label: 'Back to Explore', to: '/explore' }}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-dark lg:pb-0">
      <AppHeader title={startup.name} backTo="/explore" />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Hero */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {startup.industry && (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    {startup.industry}
                  </span>
                )}
                {startup.stage && (
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                    {capitalize(startup.stage)}
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">{startup.name}</h1>
              {startup.tagline && (
                <p className="mt-1 text-base text-gray-500">{startup.tagline}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                {founder && (
                  <span className="flex items-center gap-2">
                    <Avatar src={founder.avatar_url} name={founder.full_name} size="sm" className="h-6 w-6 text-[9px]" />
                    by {founder.full_name}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Published {formatDate(startup.created_at)}
                </span>
                {startup.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {startup.location}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => toggleSave(startup.id)}
              className={`inline-flex items-center gap-2 self-start rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                savedIds[startup.id]
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 text-gray-600 hover:border-primary hover:text-primary dark:border-dark-400 dark:text-gray-300'
              }`}
            >
              {savedIds[startup.id] ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {savedIds[startup.id] ? 'Saved' : 'Save'}
            </button>
          </div>
        </section>

        {/* About */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:p-8">
          <h2 className="text-lg font-bold">About</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {startup.description}
          </p>
        </section>

        {/* What we need */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Briefcase className="h-5 w-5 text-primary" />
            What we need
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(startup.team_roles_needed ?? []).map((role) => (
              <div
                key={role}
                className="rounded-xl border border-gray-200 p-4 dark:border-dark-300"
              >
                <p className="text-sm font-bold">{role}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {role.includes('Developer') || role.includes('Engineer')
                    ? 'Build and ship core features with the founding team.'
                    : role.includes('Designer')
                      ? 'Own the product experience end to end.'
                      : 'Own go-to-market and grow the startup with the founders.'}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Wrench className="h-5 w-5 text-primary" />
            Tech stack
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {(startup.tech_stack ?? []).map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 dark:border-dark-400 dark:text-gray-300"
              >
                {tech}
              </span>
            ))}
            {!startup.tech_stack?.length && (
              <p className="text-sm text-gray-500">No tech stack listed.</p>
            )}
          </div>
        </section>

        {/* Funding & equity */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Funding needed</p>
            <p className="mt-1 text-lg font-bold">{startup.funding_needed ?? '—'}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Equity offered</p>
            <p className="mt-1 flex items-center gap-1 text-lg font-bold text-green-600 dark:text-green-400">
              <Coins className="h-4 w-4" />
              {startup.equity_offered ?? 0}%
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Remote</p>
            <p className="mt-1 text-lg font-bold">{startup.remote_friendly ? 'Yes' : 'No'}</p>
          </div>
        </section>

        {/* Founder */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:p-8">
          <h2 className="text-lg font-bold">Founder</h2>
          {founder ? (
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar src={founder.avatar_url} name={founder.full_name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-bold">{founder.full_name}</p>
                  {founder.username && (
                    <Link
                      to={`/profile/${founder.username}`}
                      className="text-sm text-primary hover:underline"
                    >
                      @{founder.username}
                    </Link>
                  )}
                </div>
                {founder.bio && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{founder.bio}</p>
                )}
                {founder.linkedin_url && (
                  <a
                    href={founder.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    LinkedIn
                  </a>
                )}
                {!isOwnStartup && (
                  <button
                    type="button"
                    onClick={() => navigate(`/messages?user=${startup.founder_id}`)}
                    className="btn-ghost mt-3"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Message
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">No founder info available.</p>
          )}
        </section>

        {/* Pitch deck */}
        {startup.pitch_deck_url && (
          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <FileText className="h-5 w-5 text-primary" />
              Pitch deck
            </h2>
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-dark-300">
              <iframe
                src={startup.pitch_deck_url}
                title="Pitch deck"
                className="h-[60vh] w-full"
                loading="lazy"
              />
            </div>
          </section>
        )}

        {/* Website */}
        {startup.website_url && (
          <a
            href={startup.website_url}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <Globe className="h-4 w-4" />
            Visit website
          </a>
        )}
      </main>

      {/* Apply button — fixed bottom bar on mobile, inline on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-4 backdrop-blur-xl dark:border-dark-300 dark:bg-dark/95 lg:relative lg:mt-8 lg:border-0 lg:bg-transparent lg:p-0 lg:dark:bg-transparent">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold">{skillMatch}% skill match with your profile</p>
            <p className="text-xs text-gray-500">{startup.equity_offered ?? 0}% equity · {startup.remote_friendly ? 'Remote friendly' : 'On-site'}</p>
          </div>
          {isOwnStartup ? (
            <Link to={`/startups/${startup.id}/edit`} className="btn-ghost">
              Edit Startup
            </Link>
          ) : applied ? (
            <button disabled className="btn-ghost opacity-50">
              ✓ Applied
            </button>
          ) : (
            <button onClick={() => setApplyOpen(true)} className="btn-primary">
              Apply
            </button>
          )}
        </div>
      </div>

      <ApplyModal
        startup={startup}
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApplied={() => setApplied(true)}
      />
    </div>
  )
}
