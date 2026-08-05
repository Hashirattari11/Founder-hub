import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Loader2, ChevronLeft, Hash } from 'lucide-react'
import { getPost, getPostsByHashtag, incrementPostViews } from '../lib/feed'
import PostCard from '../components/feed/PostCard'
import type { Post } from '../types'

export default function PostDetail() {
  const { id } = useParams<{ id: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [related, setRelated] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPost(id)
      .then((data) => {
        setPost(data)
        if (data?.hashtags?.length) {
          getPostsByHashtag(data.hashtags[0])
            .then((posts) =>
              setRelated(posts.filter((p) => p.id !== data.id).slice(0, 3)),
            )
            .catch(() => {})
        }
        incrementPostViews(id)
          .then(() =>
            setPost((prev) =>
              prev ? { ...prev, views_count: (prev.views_count ?? 0) + 1 } : prev,
            ),
          )
          .catch(() => {})
      })
      .catch(() => setPost(null))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-800 bg-[#1A1A1A] p-12 text-center">
        <p className="text-sm font-medium text-white">Post not found</p>
        <Link
          to="/community"
          className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          Back to Community
        </Link>
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

      <PostCard post={post} />

      {post.hashtags && post.hashtags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {post.hashtags.map((tag) => (
            <Link
              key={tag}
              to={`/community/hashtag/${tag}`}
              className="flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400 hover:bg-purple-500/20"
            >
              <Hash className="h-3 w-3" /> {tag}
            </Link>
          ))}
        </div>
      )}

      {related.length > 0 && (
        <div>
          <h2 className="mb-3 text-base font-bold text-white">Related posts</h2>
          {related.map((relatedPost) => (
            <PostCard key={relatedPost.id} post={relatedPost} />
          ))}
        </div>
      )}
    </div>
  )
}
