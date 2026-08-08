import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap, ArrowRight, Users, Sparkles, MessagesSquare, Compass } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getRecommendedStartups } from '../../lib/startups'
import { supabase } from '../../lib/supabase'
import { useSavedStartups } from '../../hooks/useSavedStartups'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { StartupCardSkeleton } from '../../components/dashboard/Skeleton'
import { NotificationStrip } from '../../components/dashboard/NotificationStrip'
import { PeopleToConnect } from '../../components/dashboard/PeopleToConnect'
import { ProfileCompleteness } from '../../components/dashboard/ProfileCompleteness'
import { calcMatchScore } from '../../lib/helpers'
import { ROLE_LABELS } from '../../types'
import type { Startup } from '../../types'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function MentorDashboard() {
  const { user, profile } = useSession()
  const { savedIds, toggleSave } = useSavedStartups(user?.id)
  const [recommended, setRecommended] = useState<Startup[]>([])
  const [loadingRec, setLoadingRec] = useState(true)
  const [stats, setStats] = useState({ connections: 0, messages: 0 })

  const role = (profile?.role ?? 'mentor') as keyof typeof ROLE_LABELS
  const firstName = profile?.full_name?.split(' ')[0]
  const roleLabel = ROLE_LABELS[role] ?? 'Mentor'

  useEffect(() => {
    if (!profile) return
    getRecommendedStartups(profile, 3)
      .then(setRecommended)
      .catch(() => {})
      .finally(() => setLoadingRec(false))
  }, [profile])

  useEffect(() => {
    if (!user) return
    let active = true
    Promise.all([
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
      .then(([connections, messages]) => {
        if (active) setStats({ connections, messages })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [user])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName ?? roleLabel} 👋
        </h1>
        <p className="mt-1 text-gray-500">
          Share your experience, mentor founders and shape their journeys.
        </p>
      </div>

      {/* Unique mentor hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 p-8 text-white">
        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
            <GraduationCap className="h-3.5 w-3.5" />
            Mentorship
          </span>
          <h2 className="mt-3 text-xl font-bold sm:text-2xl">Guide founders to their next level</h2>
          <p className="mt-2 max-w-lg text-white/80">
            Connect with early teams that need your playbook, feedback and network.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 transition-transform hover:scale-105"
            >
              <Compass className="h-4 w-4" />
              Explore Startups
            </Link>
            <Link
              to="/co-founder"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <ArrowRight className="h-4 w-4" />
              Find Co-Founder
            </Link>
          </div>
        </div>
      </div>

      <NotificationStrip userId={user?.id ?? ''} />

      {/* Mentor KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <Users className="h-6 w-6 text-emerald-500" />
          <p className="mt-3 text-2xl font-bold">{stats.connections}</p>
          <p className="text-sm text-gray-500">Connections</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <Sparkles className="h-6 w-6 text-teal-500" />
          <p className="mt-3 text-2xl font-bold">{loadingRec ? '—' : recommended.length}</p>
          <p className="text-sm text-gray-500">Startups to mentor</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-dark-300 dark:bg-dark-100">
          <MessagesSquare className="h-6 w-6 text-cyan-500" />
          <p className="mt-3 text-2xl font-bold">{stats.messages}</p>
          <p className="text-sm text-gray-500">Messages sent</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recommended */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Startups worth your time</h2>
            <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2">
              Explore all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {loadingRec
              ? Array.from({ length: 2 }).map((_, i) => <StartupCardSkeleton key={i} />)
              : recommended.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-dark-400 sm:col-span-2">
                    <GraduationCap className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-3 font-semibold">No matches yet</p>
                    <p className="mt-1 text-sm text-gray-500">
                      New founders will appear here as they publish.
                    </p>
                  </div>
                ) : (
                  recommended.map((startup) => (
                    <StartupCard
                      key={startup.id}
                      startup={startup}
                      match={profile ? calcMatchScore(profile, startup) : 0}
                      saved={!!savedIds[startup.id]}
                      onToggleSave={() => toggleSave(startup.id)}
                    />
                  ))
                )}
          </div>
        </section>

        {/* Right rail */}
        <div className="space-y-6">
          {profile && <ProfileCompleteness profile={profile} />}
          {profile && <PeopleToConnect user={profile} />}
        </div>
      </div>
    </div>
  )
}
