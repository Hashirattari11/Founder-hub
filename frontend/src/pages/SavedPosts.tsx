import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark, Loader2, ChevronLeft } from 'lucide-react'
import { useSession } from '../context/AuthContext'
import PostCard from '../components/feed/PostCard'
import { getSavedPosts } from '../lib/feed'
import type { Post } from '../types'

export default function SavedPosts() {
  const { user } = useSession()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getSavedPosts(user.id)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

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

      <h1 className="mb-5 flex items-center gap-2 text-xl font-bold text-white">
        <Bookmark className="h-5 w-5 text-yellow-400" />
        Saved Posts
      </h1>

      {posts.length === 0 && (
        <div className="rounded-2xl border border-gray-800 bg-[#1A1A1A] p-10 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-gray-600" />
          <p className="mt-3 text-sm font-medium text-white">No saved posts yet</p>
          <p className="mt-1 text-xs text-gray-500">
            Bookmark posts you want to revisit later.
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
        <PostCard
          key={post.id}
          post={post}
          onUpdate={(action, id) => {
            if (action === 'delete') {
              setPosts((prev) => prev.filter((p) => p.id !== id))
            }
          }}
        />
      ))}
    </div>
  )
}
