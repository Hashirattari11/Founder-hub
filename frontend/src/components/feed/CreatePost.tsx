import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Send, Image as ImageIcon, X, Pencil, Trophy, HelpCircle, Briefcase, Coins, Rocket, Loader2 } from 'lucide-react'
import { useSession } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { createPost, POST_TYPES } from '../../lib/feed'
import { Avatar } from '../Avatar'
import type { Post } from '../../types'

const TYPE_ICONS: Record<string, typeof Pencil> = {
  update: Pencil,
  milestone: Trophy,
  question: HelpCircle,
  hiring: Briefcase,
  funding: Coins,
  launch: Rocket,
}

interface CreatePostProps {
  onPostCreated?: (post: Post) => void
}

export default function CreatePost({ onPostCreated }: CreatePostProps) {
  const { user, profile } = useSession()
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState('update')
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [isPosting, setIsPosting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMedia = async (files: File[]) => {
    if (!user) return []
    const urls: string[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { data, error } = await supabase.storage
        .from('post-media')
        .upload(path, file)
      if (error) throw error
      if (data) {
        const { data: publicData } = supabase.storage
          .from('post-media')
          .getPublicUrl(path)
        urls.push(publicData.publicUrl)
      }
    }
    return urls
  }

  const submitPost = async () => {
    if (!user) return
    if (!content.trim() || isPosting || content.length > 1000) return
    setIsPosting(true)
    try {
      let uploadedUrls: string[] = []
      if (mediaFiles.length > 0) {
        uploadedUrls = await uploadMedia(mediaFiles)
      }

      const post = await createPost({
        authorId: user.id,
        content: content.trim(),
        postType,
        mediaUrls: uploadedUrls,
      })

      setContent('')
      setMediaFiles([])
      setMediaUrls([])
      setPostType('update')
      setExpanded(false)
      onPostCreated?.(post)
      toast.success('Post published!')
    } catch {
      toast.error('Failed to post. Try again.')
    } finally {
      setIsPosting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4)
    setMediaFiles(files)
    setMediaUrls(files.map((f) => URL.createObjectURL(f)))
  }

  return (
    <div className="mb-4 rounded-2xl border border-gray-800 bg-[#1A1A1A] p-4">
      <div className="flex gap-3">
        <Avatar src={profile?.avatar_url} name={profile?.full_name} size="sm" />

        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setExpanded(true)}
            placeholder="Share an update, milestone, or question..."
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-white placeholder-gray-600 focus:outline-none"
            rows={expanded ? 4 : 2}
          />

          {mediaUrls.length > 0 && (
            <div className={`mb-3 grid gap-2 ${mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative overflow-hidden rounded-xl">
                  <img src={url} alt="" className="h-32 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setMediaFiles((prev) => prev.filter((_, idx) => idx !== i))
                      setMediaUrls((prev) => prev.filter((_, idx) => idx !== i))
                    }}
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {expanded && (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {POST_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t.id ?? 'update'] ?? Pencil
                  const isActive = postType === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPostType(t.id ?? 'update')}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition-all"
                      style={
                        isActive
                          ? { background: t.color + '30', color: t.color, border: `1px solid ${t.color}40` }
                          : { color: '#6b7280' }
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between border-t border-gray-800 pt-3">
                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,video/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-all hover:bg-gray-800 hover:text-white"
                  >
                    <ImageIcon className="h-4 w-4" /> Photo
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs ${content.length > 900 ? 'text-red-400' : 'text-gray-600'}`}>
                    {content.length}/1000
                  </span>
                  <button
                    type="button"
                    onClick={submitPost}
                    disabled={!content.trim() || isPosting || content.length > 1000}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white transition-all hover:bg-purple-700 disabled:bg-gray-800 disabled:text-gray-600"
                  >
                    {isPosting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Post
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
