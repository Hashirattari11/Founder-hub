import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, UserCheck, Check, Loader2 } from 'lucide-react'
import { useSession } from '../context/AuthContext'
import {
  acceptConnectionRequest,
  getConnectionState,
  sendConnectionRequest,
} from '../lib/connections'
import type { ConnectionState } from '../lib/connections'

interface ConnectButtonProps {
  targetId: string
  targetName?: string | null
  variant?: 'default' | 'icon'
  className?: string
}

export function ConnectButton({
  targetId,
  targetName,
  variant = 'default',
  className = '',
}: ConnectButtonProps) {
  const { user } = useSession()
  const [state, setState] = useState<ConnectionState>({ status: 'none' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setState({ status: 'none' })
    if (!user || user.id === targetId) return
    getConnectionState(user.id, targetId)
      .then((s) => {
        if (active) setState(s)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [user, targetId])

  const handleClick = async () => {
    if (!user || busy) return
    setBusy(true)
    try {
      if (state.status === 'requested') {
        await acceptConnectionRequest(user.id, targetId)
        setState({ status: 'accepted' })
        toast.success(targetName ? `You and ${targetName} are now connected` : 'Connected')
      } else {
        await sendConnectionRequest(user.id, targetId)
        setState({ status: 'pending' })
        toast.success(targetName ? `Connection request sent to ${targetName}` : 'Request sent')
      }
    } catch {
      toast.error('Could not update connection')
    } finally {
      setBusy(false)
    }
  }

  if (!user || user.id === targetId) return null

  const { status } = state

  if (status === 'accepted') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-lg bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-600 dark:text-green-400 ${className}`}
      >
        <Check className="h-3.5 w-3.5" /> Connected
      </span>
    )
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || status === 'pending'}
        title={status === 'requested' ? 'Accept request' : status === 'pending' ? 'Request sent' : 'Connect'}
        className={`rounded-lg p-1.5 transition-colors disabled:opacity-50 ${
          status === 'pending'
            ? 'text-gray-500'
            : status === 'requested'
              ? 'text-green-400 hover:bg-green-500/10'
              : 'text-gray-400 hover:bg-gray-800 hover:text-purple-400'
        } ${className}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : status === 'requested' ? (
          <UserCheck className="h-4 w-4" />
        ) : status === 'pending' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || status === 'pending'}
      className={`inline-flex items-center gap-1.5 rounded-lg transition-colors disabled:opacity-50 ${
        status === 'requested'
          ? 'bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600'
          : 'bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-dark'
      } ${className}`}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : status === 'requested' ? (
        <>
          <UserCheck className="h-3.5 w-3.5" /> Accept
        </>
      ) : status === 'pending' ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Requested
        </>
      ) : (
        <>
          <UserPlus className="h-3.5 w-3.5" /> Connect
        </>
      )}
    </button>
  )
}
