import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import {
  Heart,
  MessageCircle,
  Repeat,
  Bookmark,
  MoreVertical,
  Trash2,
  Link as LinkIcon,
  Send,
  Pencil,
  Trophy,
  HelpCircle,
  Briefcase,
  Coins,
  Rocket,
  Eye,
} from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { Avatar } from '../Avatar'
import { ConnectButton } from '../ConnectButton'
import {
  notifyCommunityComment,
  notifyCommunityLikes,
  notifyCommunityRepost,
} from '../../lib/communityNotify'
import {
  addPostComment,
  checkPostBookmark,
  checkPostLike,
  deletePost,
  getPostComments,
  repostPost,
  togglePostBookmark,
  togglePostLike,
} from '../../lib/feed'
import type { Post, PostComment } from '../../types'

const TYPE_STYLES: Record<string, { color: string; label: string; Icon: typeof Pencil }> = {
  update: { color: '#7C3AED', label: 'Update', Icon: Pencil },
  milestone: { color: '#0F6E56', label: 'Milestone', Icon: Trophy },
  question: { color: '#185FA5', label: 'Question', Icon: HelpCircle },
  hiring: { color: '#854F0B', label: 'Hiring', Icon: Briefcase },
  funding: { color: '#B45309', label: 'Funding', Icon: Coins },
  launch: { color: '#0F6E56', label: 'Launch', Icon: Rocket },
}

function ContentText({ text, postId }: { text: string; postId?: string }) {
  const navigate = useNavigate()
  const parts = text.split(/(#[a-zA-Z0-9_]+)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('#')) {
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                navigate(`/community/hashtag/${part.slice(1)}`)
              }}
              className="text-purple-400 hover:underline"
            >
              {part}
            </button>
          )
        }
        return <span key={i}>{part}</span>
      })}
      {postId && <span className="sr-only">{postId}</span>}
    </>
  )
}

interface PostCardProps {
  post: Post
  onUpdate?: (action: 'delete', id: string) => void
}

export default function PostCard({ post, onUpdate }: PostCardProps) {
  const { user, profile } = useSession()
  const navigate = useNavigate()

  const [isLiked, setIsLiked] = useState(false)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [likesCount, setLikesCount] = useState(post.likes_count || 0)
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0)
  const [repostsCount, setRepostsCount] = useState(post.reposts_count || 0)
  const [viewsCount, setViewsCount] = useState(post.views_count || 0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const typeStyle =
    TYPE_STYLES[post.post_type ?? 'update'] ?? TYPE_STYLES.update
  const isOwnPost = post.author_id === user?.id

  useEffect(() => {
    let active = true
    if (!user) return
    checkPostLike(user.id, post.id)
      .then((v) => active && setIsLiked(v))
      .catch(() => {})
    checkPostBookmark(user.id, post.id)
      .then((v) => active && setIsBookmarked(v))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [user, post.id])

  useEffect(() => {
    setViewsCount(post.views_count || 0)
  }, [post.views_count])

  const toggleLike = async () => {
    if (!user) return
    const newLiked = !isLiked
    setIsLiked(newLiked)
    setLikesCount((prev) => Math.max(newLiked ? prev + 1 : prev - 1, 0))

    try {
      const nowLiked = await togglePostLike(user.id, post.id)
      setIsLiked(nowLiked)
      if (nowLiked && post.author_id !== user.id) {
        void notifyCommunityLikes(post.author_id, post.id, likesCount + 1)
      }
    } catch {
      toast.error('Could not update like')
    }
  }

  const toggleBookmark = async () => {
    if (!user) return
    const newBookmarked = !isBookmarked
    setIsBookmarked(newBookmarked)
    try {
      const nowSaved = await togglePostBookmark(user.id, post.id)
      setIsBookmarked(nowSaved)
      toast.success(nowSaved ? 'Post saved' : 'Post removed from saved')
    } catch {
      toast.error('Could not update bookmark')
    }
  }

  const loadComments = async () => {
    try {
      const data = await getPostComments(post.id)
      setComments(data)
    } catch {
      toast.error('Could not load comments')
    }
  }

  const toggleComments = () => {
    if (!showComments) loadComments()
    setShowComments((prev) => !prev)
  }

  const submitComment = async () => {
    if (!user || !commentText.trim() || isSubmittingComment) return
    setIsSubmittingComment(true)
    try {
      const comment = await addPostComment(post.id, user.id, commentText.trim())
      setComments((prev) => [...prev, comment])
      setCommentsCount((prev) => prev + 1)
      setCommentText('')
      if (post.author_id !== user.id) {
        void notifyCommunityComment(post.author_id, post.id, comment.content)
      }
    } catch {
      toast.error('Could not post comment')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleDelete = async () => {
    if (!isOwnPost) return
    try {
      await deletePost(post.id)
      onUpdate?.('delete', post.id)
      toast.success('Post deleted')
    } catch {
      toast.error('Could not delete post')
    }
  }

  const handleRepost = async () => {
    if (!user) return
    try {
      await repostPost(user.id, post)
      setRepostsCount((prev) => prev + 1)
      if (post.author_id !== user.id) {
        void notifyCommunityRepost(post.author_id, post.id)
      }
      toast.success('Reposted!')
    } catch {
      toast.error('Could not repost')
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/community/post/${post.id}`)
    toast.success('Link copied')
    setShowMenu(false)
  }

  return (
    <div className="mb-3 rounded-2xl border border-gray-800 bg-[#1A1A1A] p-4">
      {post.repost_of && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-500">
          <Repeat className="h-3.5 w-3.5" />
          Reposted
        </p>
      )}

      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/profile/${post.profiles?.username ?? ''}`}>
            <Avatar src={post.profiles?.avatar_url} name={post.profiles?.full_name} size="sm" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link
                to={`/profile/${post.profiles?.username ?? ''}`}
                className="text-sm font-medium text-white hover:underline"
              >
                {post.profiles?.full_name}
              </Link>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: typeStyle.color + '20', color: typeStyle.color }}
              >
                {typeStyle.label}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {post.profiles?.role} ·{' '}
              {post.created_at
                ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
                : ''}
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-1">
          {!isOwnPost && (
            <ConnectButton targetId={post.author_id} targetName={post.profiles?.full_name} variant="icon" />
          )}
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="rounded-lg p-1 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 z-20 min-w-40 rounded-xl border border-gray-700 bg-[#1A1A1A] shadow-lg">
                {isOwnPost && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false)
                      handleDelete()
                    }}
                    className="flex w-full items-center gap-2 rounded-t-xl px-4 py-2.5 text-left text-sm text-red-400 hover:bg-gray-800"
                  >
                    <Trash2 className="h-4 w-4" /> Delete post
                  </button>
                )}
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex w-full items-center gap-2 rounded-b-xl px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800"
                >
                  <LinkIcon className="h-4 w-4" /> Copy link
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/community/post/${post.id}`)}
        className="mb-3 block w-full text-left text-sm leading-relaxed whitespace-pre-wrap text-gray-200"
      >
        <ContentText text={post.content} />
      </button>

      {post.media_urls && post.media_urls.length > 0 && (
        <div
          className={`mb-3 grid gap-2 overflow-hidden rounded-xl ${
            post.media_urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {post.media_urls.map((url, i) => (
            <img key={i} src={url} alt="" className="max-h-64 w-full object-cover" />
          ))}
        </div>
      )}

      {post.hashtags && post.hashtags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {post.hashtags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => navigate(`/community/hashtag/${tag}`)}
              className="cursor-pointer text-xs text-purple-400 hover:underline"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 flex items-center gap-4 border-t border-gray-800 pt-3 text-xs text-gray-600">
        <span>{likesCount} likes</span>
        <span>{commentsCount} comments</span>
        <span>{repostsCount} reposts</span>
        <span className="ml-auto flex items-center gap-1">
          <Eye className="h-3 w-3" /> {viewsCount} views
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={toggleLike}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
            isLiked
              ? 'bg-red-400/10 text-red-400'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-red-400' : ''}`} />
          Like
        </button>

        <button
          type="button"
          onClick={toggleComments}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
        >
          <MessageCircle className="h-4 w-4" />
          Comment
        </button>

        <button
          type="button"
          onClick={handleRepost}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
        >
          <Repeat className="h-4 w-4" />
          Repost
        </button>

        <button
          type="button"
          onClick={toggleBookmark}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
            isBookmarked
              ? 'bg-yellow-400/10 text-yellow-400'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-yellow-400' : ''}`} />
          Save
        </button>
      </div>

      {showComments && (
        <div className="mt-3 border-t border-gray-800 pt-3">
          <div className="mb-3 flex gap-2">
            <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />
            <div className="flex flex-1 gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitComment()}
                placeholder="Write a comment..."
                className="flex-1 rounded-xl border border-gray-700 bg-[#0F0F0F] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={submitComment}
                disabled={!commentText.trim()}
                className="rounded-xl bg-purple-600 px-3 py-2 text-white transition-all hover:bg-purple-700 disabled:bg-gray-800"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {comments.map((comment) => (
            <div key={comment.id} className="mb-3 flex gap-2">
              <Avatar
                src={comment.profiles?.avatar_url}
                name={comment.profiles?.full_name}
                size="sm"
              />
              <div className="flex-1 rounded-xl bg-[#0F0F0F] px-3 py-2">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-medium text-white">
                    {comment.profiles?.full_name}
                  </span>
                  <span className="text-xs text-gray-600">
                    {comment.created_at
                      ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })
                      : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{comment.content}</p>
              </div>
            </div>
          ))}

          {comments.length === 0 && (
            <p className="py-2 text-center text-sm text-gray-600">
              No comments yet. Be first!
            </p>
          )}
        </div>
      )}
    </div>
  )
}
