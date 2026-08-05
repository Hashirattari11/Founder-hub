import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Hash, Loader2, ChevronLeft, UserPlus, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSession } from '../context/AuthContext'
import PostCard from '../components/feed/PostCard'
import {
  checkHashtagFollow,
  getHashtag,
  getPostsByHashtag,
  toggleHashtagFollow,
} from '../lib/feed'
import type { Hashtag, Post } from '../types'

export default function HashtagPage() {
  const { tag } = useParams<{ tag: string }>()
  const { user } = useSession()
  const [hashtag, setHashtag] = useState<Hashtag | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [sort, setSort] = useState<'latest' | 'top'>('latest')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tag) return
    setLoading(true)
    getHashtag(tag)
      .then(setHashtag)
      .catch(() => {})
    getPostsByHashtag(tag, sort)
      .then((data) => {
        setPosts(data)
        setFollowingCount(data.length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tag, sort])

  useEffect(() => {
    if (!user || !hashtag) return
    checkHashtagFollow(user.id, hashtag.id)
      .then(setIsFollowing)
      .catch(() => {})
  }, [user, hashtag])

  const handleFollow = async () => {
    if (!user || !hashtag) return
    try {
      const nowFollowing = await toggleHashtagFollow(user.id, hashtag.id)
      setIsFollowing(nowFollowing)
      toast.success(nowFollowing ? `Following #${hashtag.name}` : 'Unfollowed hashtag')
    } catch {
      toast.error('Could not update follow status')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        type="button"
        onClick={() => window.history.back()}
        className="mb-4 flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> Back
      </button>

      <div className="mb-5 rounded-2xl border border-gray-800 bg-[#1A1A1A] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
              <Hash className="h-6 w-6 text-purple-400" />
              {tag}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {followingCount} post{followingCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={handleFollow}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              isFollowing
                ? 'border border-purple-500/40 bg-purple-500/10 text-purple-400'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {isFollowing ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {isFollowing ? 'Following' : 'Follow hashtag'}
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl border border-gray-800 bg-[#1A1A1A] p-1">
        {(['latest', 'top'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSort(s)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold capitalize transition-colors ${
              sort === s
                ? 'bg-purple-500/15 text-purple-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="rounded-2xl border border-gray-800 bg-[#1A1A1A] p-10 text-center">
          <Hash className="mx-auto h-8 w-8 text-gray-600" />
          <p className="mt-3 text-sm font-medium text-white">
            No posts with #{tag} yet
          </p>
          <Link
            to="/community"
            className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Go to Community
          </Link>
        </div>
      )}

      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  )
}
