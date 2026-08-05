import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowUp, Loader2 } from 'lucide-react'
import { useSession } from '../context/AuthContext'
import { AppHeader } from '../components/AppHeader'
import { MobileBottomNav } from '../components/MobileBottomNav'
import CreatePost from '../components/feed/CreatePost'
import PostCard from '../components/feed/PostCard'
import { FeedSidebar } from '../components/feed/FeedSidebar'
import { RightSidebar } from '../components/feed/RightSidebar'
import { getFeed, subscribeToNewPosts } from '../lib/feed'
import type { FeedType, Post } from '../types'

const FEED_TABS: { id: FeedType; label: string }[] = [
  { id: 'for_you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'trending', label: 'Trending' },
]

function dedupePosts(list: Post[]): Post[] {
  const seen = new Set<string>()
  const out: Post[] = []
  for (const p of list) {
    if (!p || !p.id || seen.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
  }
  return out
}

const PAGE_SIZE = 20

export default function Community() {
  const { user } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const feedParam = searchParams.get('feed') as FeedType | null

  const [feedType, setFeedType] = useState<FeedType>(
    feedParam === 'following' || feedParam === 'trending' ? feedParam : 'for_you',
  )
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newPostsCount, setNewPostsCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fetchIdRef = useRef(0)
  const offsetRef = useRef(0)
  const hasMoreRef = useRef(true)

  const fetchFeed = useCallback(
    async (type: FeedType, append = false) => {
      const id = ++fetchIdRef.current
      setLoadError(null)
      try {
        const offset = append ? offsetRef.current : 0
        const data = await getFeed(type, user?.id, { limit: PAGE_SIZE, offset })
        if (id !== fetchIdRef.current) return
        if (append) {
          offsetRef.current += data.length
          hasMoreRef.current = data.length === PAGE_SIZE
          setPosts((prev) => dedupePosts([...prev, ...data]))
        } else {
          offsetRef.current = data.length
          hasMoreRef.current = data.length === PAGE_SIZE
          setPosts(data)
        }
      } catch {
        if (id === fetchIdRef.current) setLoadError('Could not load the feed.')
      } finally {
        if (id === fetchIdRef.current) setLoading(false)
        setLoadingMore(false)
      }
    },
    [user],
  )

  useEffect(() => {
    const next: FeedType =
      feedParam === 'following' || feedParam === 'trending' ? feedParam : 'for_you'
    if (next !== feedType) setFeedType(next)
  }, [feedParam, feedType])

  useEffect(() => {
    setNewPostsCount(0)
    offsetRef.current = 0
    hasMoreRef.current = true
    fetchFeed(feedType)
  }, [feedType, fetchFeed])

  useEffect(() => {
    if (!user) return
    const unsubscribe = subscribeToNewPosts(() => {
      setNewPostsCount((prev) => prev + 1)
    })
    return unsubscribe
  }, [user])

  useEffect(() => {
    if (!bottomRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && hasMoreRef.current) {
          setLoadingMore(true)
          fetchFeed(feedType, true)
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(bottomRef.current)
    return () => observer.disconnect()
  }, [feedType, loading, loadingMore, fetchFeed])

  const handleRefresh = () => {
    offsetRef.current = 0
    hasMoreRef.current = true
    setNewPostsCount(0)
    fetchFeed(feedType)
  }

  const handleTab = (type: FeedType) => {
    if (type === 'for_you') {
      setSearchParams({})
    } else {
      setSearchParams({ feed: type })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark">
      <AppHeader title="Community" backTo="/dashboard" />
      <div className="mx-auto flex max-w-6xl gap-6 pb-24 lg:pb-6">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="sticky top-20">
          <FeedSidebar />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mb-4 flex gap-1 rounded-2xl border border-gray-800 bg-[#1A1A1A] p-1 lg:hidden">
          {FEED_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTab(tab.id)}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                feedType === tab.id
                  ? 'bg-purple-500/15 text-purple-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <CreatePost
          onPostCreated={(post) => {
            setPosts((prev) => dedupePosts([post, ...prev]))
            setNewPostsCount(0)
          }}
        />

        {newPostsCount > 0 && (
          <button
            type="button"
            onClick={handleRefresh}
            className="mb-3 w-full rounded-xl bg-purple-600/20 py-2 text-sm text-purple-400 transition-all hover:bg-purple-600/30"
          >
            <ArrowUp className="mr-2 inline h-4 w-4" />
            {newPostsCount} new post{newPostsCount > 1 ? 's' : ''} — Click to refresh
          </button>
        )}

        {loadError && (
          <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {loadError}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-10 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && !loadError && posts.length === 0 && (
          <div className="rounded-2xl border border-gray-800 bg-[#1A1A1A] p-8 text-center">
            <p className="text-sm font-medium text-white">No posts yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Be the first to share an update, milestone, or question.
            </p>
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

        <div ref={bottomRef} />
        {loadingMore && (
          <div className="flex justify-center py-6 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </main>

      <aside className="hidden w-72 shrink-0 xl:block">
        <div className="sticky top-20">
          <RightSidebar />
        </div>
      </aside>
      </div>
      <MobileBottomNav />
    </div>
  )
}
