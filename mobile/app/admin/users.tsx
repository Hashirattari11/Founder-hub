import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Button, EmptyState, Header, Loading, Screen } from '@/components/ui'
import { adminSuspendUser, adminUnsuspendUser, adminUsers } from '@/lib/adminApi'
import { colors, radius, spacing, typography } from '@/theme'
import type { AdminUser } from '@/types/admin'

function RoleBadge({ role }: { role: string }) {
  const admin = role === 'administrator' || role === 'admin'
  return (
    <View style={[styles.badge, admin ? styles.badgeAdmin : styles.badgeRole]}>
      <Text style={[styles.badgeText, admin ? styles.badgeTextAdmin : null]}>{role}</Text>
    </View>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async (query?: string) => {
    setLoading(true)
    try {
      const res = await adminUsers({ search: query || undefined, limit: 100 })
      setUsers(res.users)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleSuspend = async (user: AdminUser) => {
    if (user.is_super_admin) return
    setBusyId(user.id)
    try {
      if (user.is_suspended) await adminUnsuspendUser(user.id)
      else await adminSuspendUser(user.id)
      await load(search)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setBusyId(null)
    }
  }

  const renderItem = ({ item }: { item: AdminUser }) => {
    const canAct = !item.is_super_admin && busyId !== item.id
    return (
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.rowName}>{item.full_name || item.username || '—'}</Text>
          <Text style={styles.rowSub}>{item.email ?? item.id}</Text>
          <View style={styles.rowMeta}>
            <RoleBadge role={item.role} />
            {item.is_verified ? <Text style={styles.verified}>✓ Verified</Text> : null}
            {item.is_banned ? <Text style={styles.banned}>Banned</Text> : null}
            {item.is_suspended ? <Text style={styles.suspended}>Suspended</Text> : null}
          </View>
        </View>
        <View style={styles.rowActions}>
          {canAct && !item.is_banned ? (
            <Pressable onPress={() => toggleSuspend(item)} style={[styles.actionBtn, item.is_suspended ? styles.actionSafe : styles.actionWarn]}>
              <Text style={styles.actionText}>{item.is_suspended ? 'Unsuspend' : 'Suspend'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <Screen>
      <Header title="Users" />
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or email"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCapitalize="none"
        />
        <Pressable onPress={() => load(search)} style={styles.searchBtn}>
          <Ionicons name="search" size={18} color="#fff" />
        </Pressable>
      </View>
      {loading ? (
        <Loading />
      ) : users.length === 0 ? (
        <EmptyState icon="👥" title="No users found" />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
        />
      )}
      <View style={styles.footer}>
        <Button title="Refresh" variant="secondary" onPress={() => load(search)} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  searchWrap: { flexDirection: 'row', paddingHorizontal: spacing.md, marginVertical: spacing.sm, gap: spacing.sm },
  search: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowMain: { flex: 1 },
  rowName: { ...typography.body, fontWeight: '700', color: colors.text },
  rowSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm, flexWrap: 'wrap' },
  badge: { borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeRole: { backgroundColor: colors.primaryLight },
  badgeAdmin: { backgroundColor: colors.danger },
  badgeText: { ...typography.small, color: colors.primaryDark, fontWeight: '600' },
  badgeTextAdmin: { color: '#fff' },
  verified: { ...typography.small, color: colors.success, fontWeight: '600' },
  banned: { ...typography.small, color: colors.danger, fontWeight: '600' },
  suspended: { ...typography.small, color: colors.warning, fontWeight: '600' },
  rowActions: { marginLeft: spacing.sm },
  actionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  actionWarn: { backgroundColor: colors.warning },
  actionSafe: { backgroundColor: colors.success },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  footer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
})
