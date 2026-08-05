import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Avatar, EmptyState, Loading } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getMyChats, getOtherUser, getUnreadCounts, subscribeToChats } from '@/lib/chat'
import { timeAgo } from '@/lib/utils'
import { colors, spacing, typography } from '@/theme'
import type { Chat } from '@/types'

export default function Messages() {
  const { session } = useAuth()
  const router = useRouter()
  const [chats, setChats] = useState<Chat[]>([])
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const userId = session?.user.id

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await getMyChats(userId)
      setChats(data)
      const ids = data.map((c) => c.id)
      if (ids.length) setUnread(await getUnreadCounts(ids, userId))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!userId) return
    const unsub = subscribeToChats(userId, () => {
      load()
    })
    return unsub
  }, [userId, load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Chats</Text>
        <Pressable onPress={() => router.push('/new-message')} hitSlop={8}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </Pressable>
      </View>

      {loading && chats.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="💬" title="No conversations yet" subtitle="Tap + to start a chat" />}
          renderItem={({ item }) => {
            const other = getOtherUser(item, userId!)
            return (
              <Pressable style={styles.row} onPress={() => router.push(`/chat/${item.id}`)}>
                <View style={styles.avatarWrap}>
                  <Avatar uri={other?.avatar_url} name={other?.full_name} role={other?.role} size={52} />
                  {other?.is_online && <View style={styles.online} />}
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {other?.full_name ?? 'Unknown'}
                    </Text>
                    <Text style={styles.rowTime}>{timeAgo(item.last_message_at)}</Text>
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={styles.rowPreview} numberOfLines={1}>
                      {item.last_message ?? 'No messages yet'}
                    </Text>
                    {unread[item.id] ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{unread[item.id]}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            )
          }}
        />
      )}
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
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  avatarWrap: { position: 'relative' },
  online: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.online, borderWidth: 2, borderColor: '#fff' },
  rowBody: { flex: 1, marginLeft: spacing.md },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { ...typography.subheading },
  rowTime: { ...typography.small, color: colors.textMuted },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  rowPreview: { ...typography.caption, color: colors.textSecondary, flex: 1, marginRight: spacing.sm },
  unreadBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
})
