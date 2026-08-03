import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Heart, TrendingUp, ArrowRight, Bell, Tags } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getRecommendedStartups } from '../../lib/startups'
import { getUnreadCount } from '../../lib/notifications'
import { useSavedStartups } from '../../hooks/useSavedStartups'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { StartupCardSkeleton, StatCardSkeleton } from '../../components/dashboard/Skeleton'
import { NotificationStrip } from '../../components/dashboard/NotificationStrip'
import { PeopleToConnect } from '../../components/dashboard/PeopleToConnect'
import { StatCard } from '../../components/dashboard/StatCard'
import type { Startup } from '../../types'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function InvestorDashboard() {
  const { user, profile } = useSession()
  const { savedIds, toggleSave } = useSavedStartups(user?.id)
  const [deals, setDeals] = useState<Startup[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    getRecommendedStartups(profile, 3)
      .then(setDeals)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [profile])

  useEffect(() => {
    if (!user) return
    getUnreadCount(user.id).then(setUnread).catch(() => {})
  }, [user])

  const firstName = profile?.full_name?.split(' ')[0]
  const interests = profile?.investor_interests ?? []
  const savedCount = Object.values(savedIds).filter(Boolean).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting()}, {firstName ?? 'Investor'} 👋
        </h1>
        <p className="mt-1 text-gray-500">Discover and track the startups worth betting on.</p>
      </div>

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
            <StatCard icon={Heart} label="Startups saved" value={savedCount} />
            <StatCard icon={Tags} label="Sectors tracked" value={interests.length} />
            <StatCard icon={TrendingUp} label="Deals in your pipeline" value={deals.length} />
            <StatCard icon={Bell} label="Unread notifications" value={unread} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Featured startups */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">Top Deals for You</h2>
            <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-all hover:gap-2">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {loading
              ? Array.from({ length: 2 }).map((_, i) => <StartupCardSkeleton key={i} />)
              : deals.map((startup) => (
                  <StartupCard
                    key={startup.id}
                    startup={startup}
                    showFunding
                    saved={!!savedIds[startup.id]}
                    onToggleSave={() => toggleSave(startup.id)}
                  />
                ))}
          </div>
        </section>

        <div className="space-y-6">
          {/* Investment sectors */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
            <h2 className="font-bold">Investment Sectors</h2>
            <p className="mt-1 text-sm text-gray-500">Sectors you are actively tracking.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {interests.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Add sectors in your profile to improve deal matching.
                </p>
              ) : (
                interests.map((sector) => (
                  <Link
                    key={sector}
                    to="/explore"
                    className="rounded-full border border-gray-200 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary dark:border-dark-300 dark:text-gray-300"
                  >
                    {sector}
                  </Link>
                ))
              )}
            </div>
          </section>

          {profile && <PeopleToConnect user={profile} />}
        </div>
      </div>
    </div>
  )
}
