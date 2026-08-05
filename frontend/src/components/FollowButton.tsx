import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { UserPlus, UserCheck } from 'lucide-react'
import { useSession } from '../context/AuthContext'
import { getFollowerCount, getFollowState, toggleFollow } from '../lib/follows'
import type { FollowTarget } from '../lib/follows'

interface FollowButtonProps {
  targetId: string
  targetType: FollowTarget
  className?: string
}

export function FollowButton({ targetId, targetType, className = '' }: FollowButtonProps) {
  const { user } = useSession()
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    setFollowerCount(0)
    setIsFollowing(false)
    getFollowerCount(targetId, targetType)
      .then((count) => {
        if (active) setFollowerCount(count)
      })
      .catch(() => {})
    if (user?.id) {
      getFollowState(user.id, targetId, targetType)
        .then((state) => {
          if (active) setIsFollowing(state)
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [targetId, targetType, user?.id])

  const handleToggle = async () => {
    if (!user || loading) return
    setLoading(true)
    try {
      const nowFollowing = await toggleFollow(user.id, targetId, targetType)
      setIsFollowing(nowFollowing)
      setFollowerCount((prev) => (nowFollowing ? prev + 1 : Math.max(prev - 1, 0)))
      toast.success(nowFollowing ? 'Following' : 'Unfollowed')
    } catch {
      toast.error('Could not update follow status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading || !user}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        isFollowing
          ? 'border border-primary/40 bg-primary/10 text-primary hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500'
          : 'bg-primary text-white hover:bg-primary/90'
      } disabled:opacity-60 ${className}`}
    >
      {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {isFollowing ? 'Following' : 'Follow'} ({followerCount})
    </button>
  )
}
