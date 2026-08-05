import React from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen, Header, Loading, EmptyState } from '@/components/ui'
import { useNotifications } from '@/context/NotificationsContext'
import { timeAgo } from '@/lib/utils'
import { colors, radius, spacing, typography } from '@/theme'
import type { AppNotification } from '@/types'

export default function Notifications() {
  const { notifications, loading, markRead, markAllRead } = useNotifications()
  const router = useRouter()

  const open = (n: AppNotification) => {
    markRead(n.id)
    const url = (n.data?.url as string | undefined) ?? (n.data?.post_id as string | undefined)
    if (url) {
      router.push(url.startsWith('/') ? (url as never) : (`/${url}` as never))
    }
  }

  return (
    <Screen>
      <Header title="Notifications" right={
        <Pressable onPress={() => markAllRead()} hitSlop={8}>
          <Text style={styles.markAll}>Mark all read</Text>
        </Pressable>
      } />
      {loading && notifications.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<EmptyState icon="🔔" title="No notifications yet" />}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, !item.is_read && styles.rowUnread]}
              onPress={() => open(item)}
            >
              <View style={[styles.dot, item.is_read && styles.dotRead]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  markAll: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  rowUnread: { backgroundColor: colors.primaryLight },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  dotRead: { backgroundColor: colors.border },
  title: { ...typography.body, fontWeight: '700' },
  body: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  time: { ...typography.small, color: colors.textMuted, marginTop: 4 },
})
