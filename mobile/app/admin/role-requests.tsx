import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, EmptyState, Header, Loading, Screen } from '@/components/ui'
import { adminApproveRoleRequest, adminRejectRoleRequest, adminRoleRequests } from '@/lib/adminApi'
import { colors, radius, spacing, typography } from '@/theme'
import type { RoleRequest } from '@/types/admin'

export default function AdminRoleRequests() {
  const [requests, setRequests] = useState<RoleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminRoleRequests()
      setRequests(res.requests)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load role requests')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (request: RoleRequest, action: 'approve' | 'reject') => {
    setBusyId(request.id)
    try {
      if (action === 'approve') await adminApproveRoleRequest(request.id)
      else await adminRejectRoleRequest(request.id)
      await load()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update request')
    } finally {
      setBusyId(null)
    }
  }

  const renderItem = ({ item }: { item: RoleRequest }) => {
    const pending = item.status === 'pending'
    return (
      <View style={styles.row}>
        <Text style={styles.name}>{item.user_name ?? 'Unknown user'}</Text>
        <Text style={styles.meta}>
          {item.user_email ?? ''}
        </Text>
        <View style={styles.roles}>
          <Text style={styles.currentRole}>{item.current_role ?? 'none'} → </Text>
          <Text style={styles.requestedRole}>{item.requested_role}</Text>
        </View>
        {item.reason ? <Text style={styles.reason}>"{item.reason}"</Text> : null}
        {pending ? (
          <View style={styles.actions}>
            <Pressable onPress={() => act(item, 'approve')} disabled={busyId === item.id} style={styles.approve}>
              <Text style={styles.approveText}>Approve</Text>
            </Pressable>
            <Pressable onPress={() => act(item, 'reject')} disabled={busyId === item.id} style={styles.reject}>
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.status, item.status === 'approved' ? styles.approved : styles.rejected]}>
            {item.status.toUpperCase()}
          </Text>
        )}
      </View>
    )
  }

  return (
    <Screen>
      <Header title="Role Requests" />
      {loading ? (
        <Loading />
      ) : requests.length === 0 ? (
        <EmptyState icon="📨" title="No role requests" />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(r) => r.id}
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
  meta: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  roles: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' },
  currentRole: { ...typography.caption, color: colors.textSecondary },
  requestedRole: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  reason: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  approve: { flex: 1, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  approveText: { color: '#fff', fontWeight: '700' },
  reject: { flex: 1, backgroundColor: colors.danger, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  rejectText: { color: '#fff', fontWeight: '700' },
  status: { marginTop: spacing.md, fontWeight: '800', fontSize: 13 },
  approved: { color: colors.success },
  rejected: { color: colors.danger },
  footer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
})
