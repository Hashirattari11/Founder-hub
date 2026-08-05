import { Users } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { PeopleToConnect } from '../components/dashboard/PeopleToConnect'
import { useSession } from '../context/AuthContext'

export default function Connections() {
  const { profile } = useSession()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Connections" backTo="/dashboard" />
      <main className="mx-auto max-w-3xl px-4 pt-6 pb-24 sm:px-6 lg:pb-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold">Connections</h1>
            <p className="text-sm text-gray-500">
              Connect with the right people — like LinkedIn.
            </p>
          </div>
        </div>

        {profile ? (
          <PeopleToConnect user={profile} limit={12} />
        ) : (
          <p className="text-sm text-gray-500">Complete your profile to see suggestions.</p>
        )}
      </main>
    </div>
  )
}
