import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, EmptyState, Header, Loading, Screen } from '@/components/ui'
import { adminNotifications } from '@/lib/adminApi'
import { colors, radius, spacing, typography } from '@/theme'
import type { AdminNotification } from '@/types/admin'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminNotifications()
      setNotifications(res.notifications)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const renderItem = ({ item }: { item: AdminNotification }) => (
    <View style={[styles.row, !item.is_read && styles.unread]}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
      <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
    </View>
  )

  return (
    <Screen>
      <Header title="Notifications" />
      {loading ? (
        <Loading />
      ) : notifications.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications" />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      )}
      <View style={styles.footer}>
        <Button title="Refresh" variant="secondary" onPress={load} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  title: { ...typography.body, fontWeight: '700', color: colors.text },
  body: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  time: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
})
