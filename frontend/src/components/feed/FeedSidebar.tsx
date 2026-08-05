import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Hash, Home, Users, TrendingUp, BookOpen, Bookmark } from 'lucide-react'
import { getTrendingHashtags } from '../../lib/feed'
import type { Hashtag } from '../../types'

const FEED_LINKS = [
  { label: 'For You', to: '/community', icon: Home },
  { label: 'Following', to: '/community?feed=following', icon: Users },
  { label: 'Trending', to: '/community?feed=trending', icon: TrendingUp },
  { label: 'Founder Stories', to: '/community/stories', icon: BookOpen },
  { label: 'Saved Posts', to: '/community/saved', icon: Bookmark },
]

export function FeedSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [hashtags, setHashtags] = useState<Hashtag[]>([])

  useEffect(() => {
    getTrendingHashtags(5)
      .then(setHashtags)
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-800 bg-[#1A1A1A] p-3">
        {FEED_LINKS.map((link) => (
          <NavLink
            key={link.label}
            to={link.to}
            end={link.to === '/community'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-800 bg-[#1A1A1A] p-4">
        <p className="mb-3 text-sm font-bold text-white">Trending hashtags</p>
        {hashtags.length === 0 && (
          <p className="text-xs text-gray-500">No hashtags yet — start using #tags!</p>
        )}
        <div className="space-y-1">
          {hashtags.map((tag) => (
            <NavLink
              key={tag.id}
              to={`/community/hashtag/${tag.name}`}
              onClick={onNavigate}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            >
              <Hash className="h-3.5 w-3.5 text-purple-400" />
              <span className="flex-1">{tag.name}</span>
              <span className="text-xs text-gray-600">{tag.posts_count}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
