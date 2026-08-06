import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, EmptyState, Header, Loading, Screen } from '@/components/ui'
import { adminStartupMembers } from '@/lib/adminApi'
import { colors, radius, spacing, typography } from '@/theme'
import type { StartupMemberAdmin } from '@/types/admin'

const PERMISSION_COLORS: Record<string, string> = {
  owner: colors.danger,
  admin: colors.primary,
  editor: colors.success,
  viewer: colors.textSecondary,
}

export default function AdminStartupMembers() {
  const [members, setMembers] = useState<StartupMemberAdmin[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminStartupMembers()
      setMembers(res.members)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const renderItem = ({ item }: { item: StartupMemberAdmin }) => (
    <View style={styles.row}>
      <Text style={styles.name}>{item.user_name ?? item.user_id}</Text>
      <Text style={styles.startup}>{item.startup_name ?? item.startup_id}</Text>
      <Text style={[styles.permission, { color: PERMISSION_COLORS[item.permission] ?? colors.textSecondary }]}>
        {item.permission.toUpperCase()}
      </Text>
    </View>
  )

  return (
    <Screen>
      <Header title="Startup Members" />
      {loading ? (
        <Loading />
      ) : members.length === 0 ? (
        <EmptyState icon="👥" title="No memberships" />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => `${m.startup_id}:${m.user_id}`}
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
  name: { ...typography.body, fontWeight: '700', color: colors.text },
  startup: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  permission: { ...typography.caption, fontWeight: '800', marginTop: spacing.sm },
  footer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
})
