import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { UserPlus, Check, X, Loader2, ArrowRight } from 'lucide-react'
import {
  getPeopleToConnect,
  getConnectionState,
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
} from '../../lib/connections'
import { getErrorMessage } from '../../lib/errors'
import { Avatar } from '../Avatar'
import { SkeletonRow } from './Skeleton'
import { ROLE_LABELS } from '../../types'
import type { Profile } from '../../types'

interface Candidate {
  id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  role: string | null
  skills: string[] | null
  city: string | null
}

type ConnState = { status: 'none' } | { status: 'requested' } | { status: 'pending' } | { status: 'accepted' }

export function PeopleToConnect({ user, limit = 3 }: { user: Profile; limit?: number }) {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [states, setStates] = useState<Record<string, ConnState>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getPeopleToConnect(user, limit)
      .then((data) => {
        if (!active) return
        setCandidates(data)
        const init: Record<string, ConnState> = {}
        for (const c of data) init[c.id] = { status: 'none' }
        setStates(init)
        return Promise.all(
          data.map(async (c) => {
            const state = await getConnectionState(user.id, c.id)
            return { id: c.id, state }
          }),
        )
      })
      .then((results) => {
        if (!active || !results) return
        setStates((prev) => {
          const next = { ...prev }
          for (const r of results) next[r.id] = r.state
          return next
        })
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  const connect = async (candidate: Candidate) => {
    setBusy(candidate.id)
    try {
      await sendConnectionRequest(user.id, candidate.id)
      setStates((prev) => ({ ...prev, [candidate.id]: { status: 'pending' } }))
      toast.success(`Connection request sent to ${candidate.full_name}`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setBusy(null)
    }
  }

  const accept = async (candidate: Candidate) => {
    setBusy(candidate.id)
    try {
      await acceptConnectionRequest(user.id, candidate.id)
      setStates((prev) => ({ ...prev, [candidate.id]: { status: 'accepted' } }))
      toast.success(`You and ${candidate.full_name} are now connected`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setBusy(null)
    }
  }

  const reject = async (candidate: Candidate) => {
    setBusy(candidate.id)
    try {
      await rejectConnectionRequest(user.id, candidate.id)
      setStates((prev) => ({ ...prev, [candidate.id]: { status: 'none' } }))
      toast.success(`Request from ${candidate.full_name} declined`)
    } catch (err) {
      toast.error(getErrorMessage(err, 'generic'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-dark-300 dark:bg-dark-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold">People to Connect</h2>
        <Link to="/explore" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          Browse <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-gray-500">
            No suggestions yet. Complete your profile to get better matches.
          </p>
        ) : (
          candidates.map((candidate) => {
            const state = states[candidate.id]?.status ?? 'none'
            return (
              <div key={candidate.id} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-dark-300">
                <Link to={candidate.username ? `/profile/${candidate.username}` : '#'}>
                  <Avatar src={candidate.avatar_url} name={candidate.full_name} size="md" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={candidate.username ? `/profile/${candidate.username}` : '#'} className="block truncate text-sm font-semibold hover:text-primary">
                    {candidate.full_name}
                  </Link>
                  <p className="truncate text-xs text-gray-500">
                    {candidate.role ? ROLE_LABELS[candidate.role as keyof typeof ROLE_LABELS] ?? candidate.role : 'Member'}
                    {candidate.city ? ` · ${candidate.city}` : ''}
                  </p>
                  {candidate.skills && candidate.skills.length > 0 && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">
                      {candidate.skills.slice(0, 3).join(' · ')}
                    </p>
                  )}
                </div>
                {state === 'accepted' ? (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-green-500/15 px-2.5 py-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                    <Check className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : state === 'pending' ? (
                  <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-500 dark:bg-dark-200 dark:text-gray-300">
                    Pending
                  </span>
                ) : state === 'requested' ? (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => accept(candidate)}
                      disabled={busy === candidate.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                    >
                      {busy === candidate.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => reject(candidate)}
                      disabled={busy === candidate.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Decline
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => connect(candidate)}
                    disabled={busy === candidate.id}
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {busy === candidate.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                    Connect
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
