import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Chip, Loading, EmptyState } from '@/components/ui'
import { PostCard } from '@/components/PostCard'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationsContext'
import { getFeed, subscribeToNewPosts } from '@/lib/feed'
import { colors, spacing, typography } from '@/theme'
import type { Post } from '@/types'

type FeedTab = 'for_you' | 'following' | 'trending'

const TABS: { id: FeedTab; label: string }[] = [
  { id: 'for_you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'trending', label: 'Trending' },
]

export default function Home() {
  const { session, profile } = useAuth()
  const { unreadCount } = useNotifications()
  const router = useRouter()
  const [tab, setTab] = useState<FeedTab>('for_you')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (t: FeedTab) => {
      if (!session?.user.id) return
      setLoading(true)
      try {
        const data = await getFeed(t, session.user.id, { limit: 30 })
        setPosts(data)
      } catch {
        // keep existing
      } finally {
        setLoading(false)
      }
    },
    [session?.user.id],
  )

  useEffect(() => {
    load(tab)
  }, [tab, load])

  useEffect(() => {
    const unsub = subscribeToNewPosts((p) => {
      setPosts((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]))
    })
    return unsub
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await load(tab)
    setRefreshing(false)
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.logo}>FounderHub</Text>
        <Pressable onPress={() => router.push('/notifications')} style={styles.bell}>
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Chip key={t.id} label={t.label} active={tab === t.id} onPress={() => setTab(t.id)} />
        ))}
      </View>

      {loading && posts.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} currentUserId={session!.user.id} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="📭" title="No posts yet" subtitle="Follow people or create the first post" />}
          contentContainerStyle={styles.list}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push('/create-post')}>
        <Ionicons name="create-outline" size={24} color="#fff" />
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  logo: { fontSize: 22, fontWeight: '800', color: colors.primary },
  bell: { padding: 4 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  list: { paddingBottom: 120 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
})
