import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, EmptyState, Header, Loading, Screen } from '@/components/ui'
import { adminDismissReport, adminReports, adminResolveReport } from '@/lib/adminApi'
import { colors, radius, spacing, typography } from '@/theme'
import type { ReportItem } from '@/types/admin'

export default function AdminReports() {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminReports()
      setReports(res.reports)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (report: ReportItem, action: 'resolve' | 'dismiss') => {
    setBusyId(report.id)
    try {
      if (action === 'resolve') await adminResolveReport(report.id)
      else await adminDismissReport(report.id)
      await load()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update report')
    } finally {
      setBusyId(null)
    }
  }

  const renderItem = ({ item }: { item: ReportItem }) => {
    const open = item.status === 'open'
    return (
      <View style={styles.row}>
        <View style={styles.head}>
          <Text style={styles.name}>{item.target_name ?? item.target_type}</Text>
          <Text style={[styles.status, open ? styles.open : styles.closed]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.meta}>
          {item.target_type} by {item.reporter_name ?? 'unknown'}
        </Text>
        <Text style={styles.reason}>{item.reason}</Text>
        {open ? (
          <View style={styles.actions}>
            <Pressable onPress={() => act(item, 'resolve')} disabled={busyId === item.id} style={styles.resolve}>
              <Text style={styles.resolveText}>Resolve</Text>
            </Pressable>
            <Pressable onPress={() => act(item, 'dismiss')} disabled={busyId === item.id} style={styles.dismiss}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <Screen>
      <Header title="Reports" />
      {loading ? (
        <Loading />
      ) : reports.length === 0 ? (
        <EmptyState icon="🚩" title="No reports" subtitle="Nothing to moderate right now" />
      ) : (
        <FlatList
          data={reports}
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...typography.body, fontWeight: '700', color: colors.text, flex: 1 },
  status: { fontSize: 12, fontWeight: '800' },
  open: { color: colors.warning },
  closed: { color: colors.textMuted },
  meta: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  reason: { ...typography.body, color: colors.text, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  resolve: { flex: 1, backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  resolveText: { color: '#fff', fontWeight: '700' },
  dismiss: { flex: 1, backgroundColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  dismissText: { color: colors.text, fontWeight: '700' },
  footer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
})
