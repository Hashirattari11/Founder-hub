import { api } from './api'
import { notifyUser } from './feed'

/** Bell notification (always) + backend email pipeline (preference-aware). */
export async function notifyCommunityFollow(receiverId: string): Promise<void> {
  await notifyUser({
    userId: receiverId,
    type: 'new_follower',
    title: 'New follower',
    body: 'Someone started following you on FounderHub.',
    data: {},
  })
  try {
    await api.post('/api/notify/community/follow', { receiver_id: receiverId }, { auth: true })
  } catch {
    // Email is best-effort.
  }
}

export async function notifyCommunityComment(
  receiverId: string,
  postId: string,
  preview: string,
): Promise<void> {
  await notifyUser({
    userId: receiverId,
    type: 'post_comment',
    title: 'New comment on your post',
    body: preview.slice(0, 60),
    data: { post_id: postId },
  })
  try {
    await api.post(
      '/api/notify/community/comment',
      { receiver_id: receiverId, post_id: postId, preview },
      { auth: true },
    )
  } catch {
    // Email is best-effort.
  }
}

export async function notifyCommunityRepost(receiverId: string, postId: string): Promise<void> {
  await notifyUser({
    userId: receiverId,
    type: 'post_repost',
    title: 'Your post was reposted',
    body: 'Someone reposted your post on FounderHub.',
    data: { post_id: postId },
  })
  try {
    await api.post(
      '/api/notify/community/repost',
      { receiver_id: receiverId, post_id: postId },
      { auth: true },
    )
  } catch {
    // Email is best-effort.
  }
}

export async function notifyCommunityLikes(
  receiverId: string,
  postId: string,
  likeCount: number,
): Promise<void> {
  if (likeCount <= 0) return
  try {
    await api.post(
      '/api/notify/community/likes',
      { receiver_id: receiverId, post_id: postId, like_count: likeCount },
      { auth: true },
    )
  } catch {
    // Batched likes email is best-effort; bell is skipped to avoid spam.
  }
}

export async function notifyWaitlistSignup(input: {
  email: string
  country: string
  city: string
}): Promise<void> {
  await api.post('/api/notify/waitlist-signup', input)
}
