import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Avatar, Header, Button, Loading } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getPost, getPostComments, addPostComment, togglePostLike, checkPostLike, incrementPostViews } from '@/lib/feed'
import { colors, radius, spacing, typography } from '@/theme'
import { timeAgo } from '@/lib/utils'
import type { Post, PostComment } from '@/types'

export default function PostDetail() {
  const { postId } = useLocalSearchParams<{ postId: string }>()
  const { session } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<PostComment[]>([])
  const [liked, setLiked] = useState(false)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)

  const me = session?.user.id

  const load = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    try {
      const p = await getPost(postId)
      setPost(p)
      if (p) {
        incrementPostViews(postId).catch(() => {})
        setComments(await getPostComments(postId))
        if (me) setLiked(await checkPostLike(me, postId))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [postId, me])

  useEffect(() => {
    load()
  }, [load])

  const onLike = async () => {
    if (!me || !post) return
    const nowLiked = await togglePostLike(me, post.id)
    setLiked(nowLiked)
    setPost((p) => (p ? { ...p, likes_count: nowLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1) } : p))
  }

  const submitComment = async () => {
    const text = comment.trim()
    if (!text || !me || !post) return
    setComment('')
    const c = await addPostComment(post.id, me, text)
    setComments((prev) => [...prev, c])
    setPost((p) => (p ? { ...p, comments_count: p.comments_count + 1 } : p))
  }

  if (loading && !post) {
    return (
      <Screen>
        <Header title="Post" />
        <Loading />
      </Screen>
    )
  }

  if (!post) {
    return (
      <Screen>
        <Header title="Post" />
      </Screen>
    )
  }

  return (
    <Screen>
      <Header title="Post" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.post}>
              <Pressable style={styles.authorRow}>
                <Avatar uri={post.profiles?.avatar_url} name={post.profiles?.full_name} size={44} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.authorName}>{post.profiles?.full_name ?? 'Unknown'}</Text>
                  <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
                </View>
              </Pressable>
              <Text style={styles.content}>{post.content}</Text>
              <View style={styles.actions}>
                <Pressable onPress={onLike} style={styles.action} hitSlop={6}>
                  <Ionicons name={liked ? 'heart' : 'heart-outline'} color={liked ? colors.danger : colors.textSecondary} size={20} />
                  <Text style={styles.actionText}>{post.likes_count}</Text>
                </Pressable>
                <View style={styles.action}>
                  <Ionicons name="chatbubble-outline" color={colors.textSecondary} size={18} />
                  <Text style={styles.actionText}>{post.comments_count}</Text>
                </View>
              </View>
              <Text style={styles.commentsHeader}>Comments</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.commentRow}>
              <Avatar uri={item.profiles?.avatar_url} name={item.profiles?.full_name} size={32} />
              <View style={styles.commentBody}>
                <Text style={styles.commentName}>{item.profiles?.full_name ?? 'Unknown'}</Text>
                <Text style={styles.commentText}>{item.content}</Text>
                <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 80 }}
        />
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textMuted}
          />
          <Pressable onPress={submitComment} style={styles.sendBtn}>
            <Ionicons name="send" size={16} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  post: { padding: spacing.lg, backgroundColor: colors.card },
  authorRow: { flexDirection: 'row', alignItems: 'center' },
  authorName: { ...typography.subheading },
  time: { ...typography.small, color: colors.textMuted },
  content: { ...typography.body, lineHeight: 22, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { ...typography.caption, color: colors.textSecondary },
  commentsHeader: { ...typography.subheading, marginTop: spacing.xl },
  commentRow: { flexDirection: 'row', padding: spacing.lg, gap: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  commentBody: { flex: 1 },
  commentName: { ...typography.caption, fontWeight: '700' },
  commentText: { ...typography.body, marginTop: 2 },
  commentTime: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
