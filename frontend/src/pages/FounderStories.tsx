import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Loader2, BookOpen } from 'lucide-react'
import { getFounderStories } from '../lib/feed'
import { Avatar } from '../components/Avatar'
import type { Post } from '../types'

export default function FounderStories() {
  const [stories, setStories] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFounderStories()
      .then(setStories)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (stories.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-800 bg-[#1A1A1A] p-12 text-center">
        <BookOpen className="mx-auto h-8 w-8 text-gray-600" />
        <p className="mt-3 text-sm font-medium text-white">No founder stories yet</p>
        <p className="mt-1 text-xs text-gray-500">
          Share a milestone or launch post in the community to be featured here.
        </p>
        <Link
          to="/community"
          className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          Go to Community
        </Link>
      </div>
    )
  }

  const [featured, ...rest] = stories

  const StoryCard = ({ story, large = false }: { story: Post; large?: boolean }) => {
    const title = story.content.split('\n')[0].slice(0, large ? 100 : 80)
    const preview = story.content.slice(0, large ? 300 : 200)
    return (
      <Link
        to={`/community/post/${story.id}`}
        className={`block overflow-hidden rounded-2xl border border-gray-800 bg-[#1A1A1A] transition-colors hover:border-purple-500/40 ${
          large ? 'md:col-span-2' : ''
        }`}
      >
        {story.media_urls && story.media_urls[0] && (
          <div className={large ? 'h-56' : 'h-40'}>
            <img
              src={story.media_urls[0]}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Avatar src={story.profiles?.avatar_url} name={story.profiles?.full_name} size="sm" />
            <div>
              <p className="text-sm font-medium text-white">{story.profiles?.full_name}</p>
              <p className="text-xs text-gray-500">{story.profiles?.role}</p>
            </div>
          </div>
          <h3 className={`font-bold text-white ${large ? 'text-xl' : 'text-base'}`}>{title}</h3>
          <p className="mt-1 line-clamp-3 text-sm text-gray-400">{preview}...</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> {story.likes_count || 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" /> {story.comments_count || 0}
            </span>
            <span className="ml-auto rounded-lg bg-purple-500/10 px-2.5 py-1 font-medium text-purple-400">
              Read Story
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <BookOpen className="h-6 w-6 text-purple-400" />
          Founder Stories
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Journeys, milestones and launches from founders across the ecosystem.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <StoryCard story={featured} large />
        {rest.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>
    </div>
  )
}
