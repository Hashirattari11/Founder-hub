import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, ArrowRight, Sparkles, Users, Briefcase, Scale, LineChart, GraduationCap, Handshake } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { getInvestorRecommendations } from '../../lib/startups'
import { NotificationStrip } from '../../components/dashboard/NotificationStrip'
import { PeopleToConnect } from '../../components/dashboard/PeopleToConnect'
import { StatCard } from '../../components/dashboard/StatCard'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { StartupCardSkeleton, StatCardSkeleton } from '../../components/dashboard/Skeleton'
import { useSavedStartups } from '../../hooks/useSavedStartups'
import { ROLE_LABELS } from '../../types'
import type { Profile, Role, Startup } from '../../types'

const ROLE_HERO: Record<Role, { title: string; subtitle: string; icon: LucideIcon }> = {
  mentor: {
    title: 'Help founders grow',
    subtitle: 'Share your experience, mentor founders and shape their journeys.',
    icon: GraduationCap,
  },
  recruiter: {
    title: 'Match talent to startups',
    subtitle: 'Source candidates, post jobs and build your talent pipeline.',
    icon: Briefcase,
  },
  business_analyst: {
    title: 'Analyze with clarity',
    subtitle: 'Dig into startup data and surface the insights that matter.',
    icon: LineChart,
  },
  legal_advisor: {
    title: 'Guard founders with confidence',
    subtitle: 'Review documents, advise on structure and keep startups compliant.',
    icon: Scale,
  },
  founder: { title: 'Build something people want', subtitle: 'Track your startups and find the right teammates.', icon: Sparkles },
  developer: { title: 'Build something people want', subtitle: 'Find startups to join and make an impact.', icon: Sparkles },
  designer: { title: 'Build something people want', subtitle: 'Find startups to join and make an impact.', icon: Sparkles },
  investor: { title: 'Find your next deal', subtitle: 'Discover startups worth betting on.', icon: Sparkles },
  marketer: { title: 'Build something people want', subtitle: 'Find startups to join and make an impact.', icon: Sparkles },
  administrator: { title: 'Platform at a glance', subtitle: 'Monitor activity across FounderHub.', icon: Sparkles },
}

const ROLE_LINKS: Record<Role, { label: string; to: string }[]> = {
  mentor: [
    { label: 'Explore Startups', to: '/explore' },
    { label: 'Find Co-Founder', to: '/co-founder' },
  ],
  recruiter: [
    { label: 'Post a Job', to: '/jobs/post' },
    { label: 'Explore Startups', to: '/explore' },
  ],
  business_analyst: [
    { label: 'Explore Startups', to: '/explore' },
    { label: 'AI Studio', to: '/ai-studio' },
  ],
  legal_advisor: [
    { label: 'Explore Startups', to: '/explore' },
    { label: 'Community', to: '/community' },
  ],
  founder: [{ label: 'Post a Startup', to: '/startups/create' }],
  developer: [{ label: 'Explore Startups', to: '/explore' }],
  designer: [{ label: 'Explore Startups', to: '/explore' }],
  investor: [{ label: 'Explore Startups', to: '/explore' }],
  marketer: [{ label: 'Explore Startups', to: '/explore' }],
  administrator: [{ label: 'Admin Console', to: '/admin/dashboard' }],
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function ProfessionalDashboard() {
  const { user, profile } = useSession()
  const { savedIds, toggleSave } = useSavedStartups(user?.id)
  const [recommended, setRecommended] = useState<{ startup: Startup; score: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ connections: 0, messages: 0, startups: 0 })

  const role = (profile?.role?.toLowerCase() as Role) ?? 'founder'
  const hero = ROLE_HERO[role] ?? ROLE_HERO.founder
  const links = ROLE_LINKS[role] ?? []

  useEffect(() => {
    if (!user || !profile) return
    let active = true
    const load = async () => {
      try {
        const [recs, connections, messages] = await Promise.all([
          getInvestorRecommendations(profile as Profile, 6),
          supabase
            .from('connections')
            .select('*', { count: 'exact', head: true })
            .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .then(({ count }) => count ?? 0),
          supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', user.id)
            .then(({ count }) => count ?? 0),
        ])
        if (!active) return
        setRecommended(recs)
        setStats({ connections, messages, startups: recs.length })
      } catch {
        if (active) setStats((s) => ({ ...s, startups: recommended.length }))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [user, profile])

  const firstName = profile?.full_name?.split(' ')[0]
  const roleLabel = ROLE_LABELS[role] ?? 'Member'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName ?? roleLabel} 👋
        </h1>
        <p className="mt-1 text-gray-500">{hero.subtitle}</p>
      </div>

      {/* Role CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-brand p-8 text-white">
        <div className="relative z-10">
          <hero.icon className="h-8 w-8 opacity-90" />
          <h2 className="mt-2 text-xl font-bold sm:text-2xl">{hero.title}</h2>
          <p className="mt-2 max-w-lg text-white/80">{hero.subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary transition-transform hover:scale-105"
            >
              <Compass className="h-4 w-4" />
              Explore Startups
            </Link>
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <ArrowRight className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <NotificationStrip userId={user?.id ?? ''} />

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard icon={Users} label="Connections" value={stats.connections} />
            <StatCard icon={Sparkles} label="Startups for you" value={stats.startups} />
            <StatCard icon={Handshake} label="Messages sent" value={stats.messages} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recommended startups */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold">
              <Sparkles className="h-4 w-4 text-primary" />
              Startups to explore
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
              <p className="mt-3 font-semibold">No published startups yet</p>
              <p className="mt-1 text-sm text-gray-500">
                New startups will appear here as founders publish them.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {recommended.slice(0, 6).map(({ startup, score }) => (
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
          {profile && <PeopleToConnect user={profile} />}
        </div>
      </div>
    </div>
  )
}
