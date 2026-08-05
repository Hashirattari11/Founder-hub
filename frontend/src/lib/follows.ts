import { supabase } from './supabase'
import { notifyUser } from './feed'

export type FollowTarget = 'user' | 'startup'

const TABLES: Record<FollowTarget, string> = {
  user: 'follows',
  startup: 'startup_follows',
}

const TARGET_FIELD: Record<FollowTarget, string> = {
  user: 'following_id',
  startup: 'startup_id',
}

const FOLLOWER_FIELD: Record<FollowTarget, string> = {
  user: 'follower_id',
  startup: 'user_id',
}

export async function getFollowState(
  userId: string,
  targetId: string,
  targetType: FollowTarget,
): Promise<boolean> {
  const { data } = await supabase
    .from(TABLES[targetType])
    .select('*')
    .eq(FOLLOWER_FIELD[targetType], userId)
    .eq(TARGET_FIELD[targetType], targetId)
    .maybeSingle()
  return !!data
}

export async function getFollowerCount(
  targetId: string,
  targetType: FollowTarget,
): Promise<number> {
  const { count } = await supabase
    .from(TABLES[targetType])
    .select('*', { count: 'exact', head: true })
    .eq(TARGET_FIELD[targetType], targetId)
  return count ?? 0
}

export async function toggleFollow(
  userId: string,
  targetId: string,
  targetType: FollowTarget,
): Promise<boolean> {
  const isFollowing = await getFollowState(userId, targetId, targetType)
  if (isFollowing) {
    const { error } = await supabase
      .from(TABLES[targetType])
      .delete()
      .eq(FOLLOWER_FIELD[targetType], userId)
      .eq(TARGET_FIELD[targetType], targetId)
    if (error) throw error
    return false
  }

  const { error } =
    targetType === 'user'
      ? await supabase
          .from('follows')
          .insert({ follower_id: userId, following_id: targetId })
      : await supabase
          .from('startup_follows')
          .insert({ user_id: userId, startup_id: targetId })
  if (error) throw error

  if (targetType === 'user') {
    const { data: me } = await supabase
      .from('profiles')
      .select('full_name, role, city')
      .eq('id', userId)
      .maybeSingle()
    await notifyUser({
      userId: targetId,
      type: 'new_follower',
      title: `${me?.full_name ?? 'Someone'} started following you`,
      body: `${me?.role ?? 'Member'} from ${me?.city || 'FounderHub'}`,
      data: { follower_id: userId },
    })
  }

  return true
}
