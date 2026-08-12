import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserCheck } from 'lucide-react'
import { AppHeader } from '../components/AppHeader'
import { PeopleToConnect } from '../components/dashboard/PeopleToConnect'
import { useSession } from '../context/AuthContext'
import { getAcceptedConnections } from '../lib/connections'
import { Avatar } from '../components/Avatar'
import { ROLE_LABELS } from '../types'
import type { Role } from '../types'

export default function Connections() {
  const { profile, user } = useSession()
  const [connected, setConnected] = useState<
    Array<{
      id: string
      full_name: string | null
      username: string | null
      avatar_url: string | null
      role: string | null
    }>
  >([])
  const [loadingConnected, setLoadingConnected] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    let active = true
    getAcceptedConnections(user.id)
      .then((list) => {
        if (active) setConnected(list)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingConnected(false)
      })
    return () => {
      active = false
    }
  }, [user?.id])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Connections" backTo="/dashboard" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-6 pb-24 sm:px-6 lg:pb-6">
        <div className="flex items-center gap-3">
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

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
          <div className="mb-4 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-green-600" />
            <h2 className="font-bold">Your connections</h2>
          </div>
          {loadingConnected ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : connected.length === 0 ? (
            <p className="text-sm text-gray-500">No connections yet. Send a request below.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {connected.map((person) => (
                <Link
                  key={person.id}
                  to={person.username ? `/profile/${person.username}` : '#'}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 transition-colors hover:border-primary/40 dark:border-dark-300"
                >
                  <Avatar src={person.avatar_url} name={person.full_name ?? 'Member'} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{person.full_name ?? 'Member'}</p>
                    <p className="truncate text-xs text-gray-500">
                      {person.role
                        ? ROLE_LABELS[person.role.toLowerCase() as Role] ?? person.role
                        : 'Member'}
                      {person.username ? ` · @${person.username}` : ''}
                    </p>
                  </div>
                  <span className="rounded-lg bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-600">
                    Connected
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {profile ? (
          <PeopleToConnect user={profile} limit={12} />
        ) : (
          <p className="text-sm text-gray-500">Complete your profile to see suggestions.</p>
        )}
      </main>
    </div>
  )
}
