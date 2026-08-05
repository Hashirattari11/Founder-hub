import React, { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View, Image } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Card, Avatar } from './ui'
import { colors, spacing, typography } from '@/theme'
import { timeAgo } from '@/lib/utils'
import { POST_TYPES, checkPostLike, checkPostBookmark, togglePostLike, togglePostBookmark, incrementPostViews } from '@/lib/feed'
import type { Post } from '@/types'

export function PostCard({ post, currentUserId, onMutated }: { post: Post; currentUserId: string; onMutated?: () => void }) {
  const router = useRouter()
  const [liked, setLiked] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [likes, setLikes] = useState(post.likes_count)

  useEffect(() => {
    checkPostLike(currentUserId, post.id).then(setLiked)
    checkPostBookmark(currentUserId, post.id).then(setBookmarked)
  }, [post.id, currentUserId])

  const postType = POST_TYPES.find((t) => t.id === post.post_type)

  const onLike = async () => {
    const nowLiked = await togglePostLike(currentUserId, post.id)
    setLiked(nowLiked)
    setLikes((l) => (nowLiked ? l + 1 : Math.max(0, l - 1)))
    onMutated?.()
  }

  const onBookmark = async () => {
    const nowBookmarked = await togglePostBookmark(currentUserId, post.id)
    setBookmarked(nowBookmarked)
  }

  const openPost = () => {
    incrementPostViews(post.id).catch(() => {})
    router.push(`/post/${post.id}`)
  }

  const author = post.profiles

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={() => router.push(`/user/${author?.id ?? post.author_id}`)}
        style={styles.authorRow}
      >
        <Avatar uri={author?.avatar_url} name={author?.full_name} role={author?.role} size={40} />
        <View style={styles.authorInfo}>
          <Text style={styles.authorName}>{author?.full_name ?? 'Unknown'}</Text>
          {postType && <Text style={[styles.typeTag, { color: postType.color }]}>{postType.label}</Text>}
          {author?.city && <Text style={styles.meta}>{author.city}</Text>}
        </View>
        <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
      </Pressable>

      {post.startups && (
        <Pressable onPress={() => router.push(`/startup/${post.startup_id}`)}>
          <Text style={styles.startup}>🏢 {post.startups.name}</Text>
        </Pressable>
      )}

      <Pressable onPress={openPost}>
        <Text style={styles.content}>{post.content}</Text>
      </Pressable>

      {post.media_urls?.length ? (
        <Pressable onPress={openPost}>
          <Image source={{ uri: post.media_urls[0] }} style={styles.media} resizeMode="cover" />
        </Pressable>
      ) : null}

      <View style={styles.actions}>
        <Pressable onPress={onLike} style={styles.action} hitSlop={6}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} color={liked ? colors.danger : colors.textSecondary} size={20} />
          <Text style={styles.actionText}>{likes}</Text>
        </Pressable>
        <Pressable onPress={openPost} style={styles.action} hitSlop={6}>
          <Ionicons name="chatbubble-outline" color={colors.textSecondary} size={18} />
          <Text style={styles.actionText}>{post.comments_count}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Alert.alert('Share', 'Copy link?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Copy', onPress: () => {} },
            ])
          }}
          style={styles.action}
          hitSlop={6}
        >
          <Ionicons name="share-social-outline" color={colors.textSecondary} size={18} />
          <Text style={styles.actionText}>{post.reposts_count}</Text>
        </Pressable>
        <Pressable onPress={onBookmark} style={styles.action} hitSlop={6}>
          <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} color={bookmarked ? colors.primary : colors.textSecondary} size={18} />
        </Pressable>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { paddingVertical: spacing.lg },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  authorInfo: { flex: 1, marginLeft: spacing.md },
  authorName: { ...typography.subheading },
  typeTag: { ...typography.small, fontWeight: '600', marginTop: 2 },
  meta: { ...typography.small, color: colors.textMuted },
  time: { ...typography.small, color: colors.textMuted },
  startup: { ...typography.caption, color: colors.primary, fontWeight: '600', marginBottom: spacing.sm },
  content: { ...typography.body, lineHeight: 22 },
  media: { width: '100%', height: 200, borderRadius: 12, marginTop: spacing.md },
  actions: { flexDirection: 'row', marginTop: spacing.lg, gap: spacing.xl },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { ...typography.caption, color: colors.textSecondary },
})
