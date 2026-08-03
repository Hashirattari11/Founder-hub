import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Bookmark } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { getSavedStartups } from '../../lib/startups'
import { useSavedStartups } from '../../hooks/useSavedStartups'
import { StartupCard } from '../../components/dashboard/StartupCard'
import { EmptyState } from '../../components/EmptyState'
import { SkeletonCard } from '../../components/dashboard/Skeleton'
import type { Startup } from '../../types'

export default function SavedStartups() {
  const { user } = useSession()
  const { savedIds, toggleSave } = useSavedStartups(user?.id)
  const [startups, setStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getSavedStartups(user.id)
      .then(setStartups)
      .catch(() => toast.error('Could not load saved startups'))
      .finally(() => setLoading(false))
  }, [user])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">Saved Startups</h1>
        <p className="mt-1 text-sm text-gray-500">
          Startups you've bookmarked for due diligence.
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : startups.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing saved yet"
          description="Bookmark startups while exploring to keep track of the ones you like."
          action={{ label: 'Explore Startups', to: '/explore' }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {startups.map((startup) => (
            <StartupCard
              key={startup.id}
              startup={startup}
              saved={!!savedIds[startup.id]}
              onToggleSave={() => toggleSave(startup.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
