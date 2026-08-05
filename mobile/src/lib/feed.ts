import { supabase } from './supabase'
import type { FeedType, Hashtag, Post, PostComment, Profile, Startup } from '@/types'

export const POST_TYPES: { id: Post['post_type']; label: string; color: string }[] = [
  { id: 'update', label: 'Update', color: '#7C3AED' },
  { id: 'milestone', label: 'Milestone', color: '#0F6E56' },
  { id: 'question', label: 'Question', color: '#185FA5' },
  { id: 'hiring', label: 'Hiring', color: '#854F0B' },
  { id: 'funding', label: 'Funding', color: '#B45309' },
  { id: 'launch', label: 'Launch', color: '#0F6E56' },
]

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_]+/g) || []
  const seen = new Set<string>()
  return matches
    .map((h) => h.slice(1).toLowerCase())
    .filter((t) => (seen.has(t) ? false : (seen.add(t), true)))
    .slice(0, 10)
}

export async function getFeed(
  feedType: FeedType,
  userId?: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Post[]> {
  const { limit = 20, offset = 0 } = opts
  const select = `
    *,
    profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, city),
    startups(id, name, tagline, industry),
    reposted_from:repost_of(
      id, author_id, content, media_urls, post_type, hashtags, created_at,
      profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role)
    )
  `

  if (feedType === 'following') {
    if (!userId) return []
    const { data: following } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
    const ids = following?.map((f) => f.following_id as string) ?? []
    ids.push(userId)
    const { data, error } = await supabase
      .from('posts')
      .select(select)
      .in('author_id', ids)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error
    return (data ?? []) as unknown as Post[]
  }

  if (feedType === 'trending') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('posts')
      .select(select)
      .gte('created_at', weekAgo)
      .order('likes_count', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) throw error
    return (data ?? []) as unknown as Post[]
  }

  const { data, error } = await supabase
    .from('posts')
    .select(select)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  return (data ?? []) as unknown as Post[]
}

export async function getPostsByHashtag(
  tag: string,
  sort: 'latest' | 'top' = 'latest',
): Promise<Post[]> {
  const select = `
    *,
    profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, city),
    startups(id, name, tagline, industry)
  `
  let query = supabase
    .from('posts')
    .select(select)
    .contains('hashtags', [tag.toLowerCase()])
  if (sort === 'top') {
    query = query.order('likes_count', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }
  const { data, error } = await query.limit(50)
  if (error) throw error
  return (data ?? []) as unknown as Post[]
}

export async function getPost(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, city),
      startups(id, name, tagline, industry),
      reposted_from:repost_of(
        id, author_id, content, media_urls, post_type, hashtags, created_at,
        profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role)
      )
    `)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Post) ?? null
}

export async function incrementPostViews(postId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_post_views', { p_post_id: postId })
  if (error) throw error
}

export async function getSavedPosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('post_bookmarks')
    .select(`
      created_at,
      posts(
        *,
        profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, city),
        startups(id, name, tagline, industry)
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? [])
    .map((row) => (row.posts as unknown as Post) ?? null)
    .filter(Boolean) as Post[]
}

export async function getFounderStories(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`
      *,
      profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, city),
      startups(id, name, tagline, industry)
    `)
    .in('post_type', ['milestone', 'launch'])
    .order('likes_count', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as unknown as Post[]
}

export async function createPost(input: {
  authorId: string
  content: string
  postType: string
  mediaUrls: string[]
}): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: input.authorId,
      content: input.content,
      post_type: input.postType,
      media_urls: input.mediaUrls,
      hashtags: extractHashtags(input.content),
    })
    .select(`
      *,
      profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, city),
      startups(id, name, tagline, industry)
    `)
    .single()
  if (error) throw error
  return data as unknown as Post
}

export async function togglePostLike(userId: string, postId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId)
    if (error) throw error
    return false
  }

  const { error } = await supabase
    .from('post_likes')
    .insert({ user_id: userId, post_id: postId })
  if (error) throw error
  return true
}

export async function checkPostLike(userId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle()
  return !!data
}

export async function togglePostBookmark(userId: string, postId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('post_bookmarks')
    .select('post_id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('post_bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId)
    if (error) throw error
    return false
  }

  const { error } = await supabase
    .from('post_bookmarks')
    .insert({ user_id: userId, post_id: postId })
  if (error) throw error
  return true
}

export async function checkPostBookmark(userId: string, postId: string): Promise<boolean> {
  const { data } = await supabase
    .from('post_bookmarks')
    .select('post_id')
    .eq('user_id', userId)
    .eq('post_id', postId)
    .maybeSingle()
  return !!data
}

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select(`*, profiles!post_comments_author_id_fkey(id, full_name, avatar_url, username)`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as PostComment[]
}

export async function addPostComment(
  postId: string,
  authorId: string,
  content: string,
): Promise<PostComment> {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, author_id: authorId, content })
    .select(`*, profiles!post_comments_author_id_fkey(id, full_name, avatar_url, username)`)
    .single()
  if (error) throw error
  return data as unknown as PostComment
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  if (error) throw error
}

export async function repostPost(userId: string, post: Post): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: userId,
      content: post.content,
      post_type: post.post_type,
      media_urls: post.media_urls,
      hashtags: post.hashtags,
      repost_of: post.id,
    })
    .select(`
      *,
      profiles!posts_author_id_fkey(id, full_name, avatar_url, username, role, city),
      startups(id, name, tagline, industry)
    `)
    .single()
  if (error) throw error
  return data as unknown as Post
}

export async function getTrendingHashtags(limit = 5): Promise<Hashtag[]> {
  const { data, error } = await supabase
    .from('hashtags')
    .select('*')
    .order('posts_count', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as unknown as Hashtag[]
}

export async function getHashtag(name: string): Promise<Hashtag | null> {
  const { data, error } = await supabase
    .from('hashtags')
    .select('*')
    .eq('name', name.toLowerCase())
    .maybeSingle()
  if (error) throw error
  return (data as unknown as Hashtag) ?? null
}

export async function toggleHashtagFollow(userId: string, hashtagId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('hashtag_follows')
    .select('hashtag_id')
    .eq('user_id', userId)
    .eq('hashtag_id', hashtagId)
    .maybeSingle()
  if (existing) {
    await supabase
      .from('hashtag_follows')
      .delete()
      .eq('user_id', userId)
      .eq('hashtag_id', hashtagId)
    return false
  }
  await supabase
    .from('hashtag_follows')
    .insert({ user_id: userId, hashtag_id: hashtagId })
  return true
}

export async function checkHashtagFollow(userId: string, hashtagId: string): Promise<boolean> {
  const { data } = await supabase
    .from('hashtag_follows')
    .select('hashtag_id')
    .eq('user_id', userId)
    .eq('hashtag_id', hashtagId)
    .maybeSingle()
  return !!data
}

export async function getSuggestedPeople(userId: string): Promise<Profile[]> {
  const { data: me } = await supabase
    .from('profiles')
    .select('skills, role')
    .eq('id', userId)
    .maybeSingle()

  const { data: followingRows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
  const followingIds = new Set((followingRows ?? []).map((f) => f.following_id as string))

  const select =
    'id, full_name, avatar_url, username, role, city, skills, bio, connections_count'
  const candidates: Profile[] = []

  if (me?.role) {
    const sameRole = await supabase
      .from('profiles')
      .select(select)
      .eq('role', me.role)
      .neq('id', userId)
      .limit(20)
    if (sameRole.data?.length) candidates.push(...(sameRole.data as unknown as Profile[]))
  }

  const fallback = await supabase
    .from('profiles')
    .select(select)
    .neq('id', userId)
    .not('full_name', 'is', null)
    .limit(20)
  if (fallback.data?.length) candidates.push(...(fallback.data as unknown as Profile[]))

  const seen = new Set<string>()
  const out: Profile[] = []
  for (const p of candidates) {
    if (!p?.id || seen.has(p.id)) continue
    if (followingIds.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
  }
  return out
}

export async function getTrendingStartups(): Promise<
  (Startup & { views_count: number })[]
> {
  const { data: startups, error } = await supabase
    .from('startups')
    .select('id, name, tagline, industry, is_published')
    .eq('is_published', true)
    .limit(20)
  if (error) throw error
  const list = (startups ?? []) as unknown as Startup[]
  const ids = list.map((s) => s.id)
  if (!ids.length) return []

  const { data: viewRows, error: viewError } = await supabase
    .from('startup_views')
    .select('startup_id')
    .in('startup_id', ids)
  if (viewError) throw viewError

  const counts: Record<string, number> = {}
  for (const row of viewRows ?? []) {
    counts[row.startup_id as string] = (counts[row.startup_id as string] ?? 0) + 1
  }

  return list
    .map((s) => ({ ...s, views_count: counts[s.id] ?? 0 }))
    .sort((a, b) => b.views_count - a.views_count)
    .slice(0, 3)
}

export async function notifyUser(input: {
  userId: string
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
}): Promise<void> {
  try {
    await supabase.rpc('create_notification', {
      p_user_id: input.userId,
      p_type: input.type,
      p_title: input.title,
      p_body: input.body,
      p_data: input.data ?? {},
    })
  } catch {
    // Notifications are best-effort.
  }
}

export function subscribeToNewPosts(onPost: (post: Post) => void): () => void {
  const channel = supabase
    .channel('feed-posts')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'posts' },
      (payload) => {
        onPost(payload.new as Post)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
