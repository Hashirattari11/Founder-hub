import React, { useCallback, useEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button, Card, EmptyState, Header, Loading, Screen, SectionHeader } from '@/components/ui'
import { adminAnalytics } from '@/lib/adminApi'
import { colors, radius, spacing, typography } from '@/theme'
import type { AnalyticsResponse } from '@/types/admin'

function Bar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <View style={styles.barCol}>
      <Text style={styles.barValue}>{value}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { height: `${Math.max(pct, 4)}%` }]} />
      </View>
      <Text style={styles.barLabel}>{label}</Text>
    </View>
  )
}

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setAnalytics(await adminAnalytics())
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const registrations = analytics?.registrations_30d ?? []
  const max = Math.max(...registrations.map((r) => r.count), 1)
  const today = analytics?.request_stats?.today
  const totals = analytics?.request_stats?.totals

  return (
    <Screen>
      <Header title="Analytics" />
      {loading ? (
        <Loading />
      ) : !analytics ? (
        <EmptyState icon="📊" title="No analytics available" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <Card style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{analytics.dau}</Text>
              <Text style={styles.statLabel}>DAU</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{analytics.mau}</Text>
              <Text style={styles.statLabel}>MAU</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{totals?.requests ?? 0}</Text>
              <Text style={styles.statLabel}>Requests</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{today ? `${Math.round(today.avg_latency_ms)}ms` : '—'}</Text>
              <Text style={styles.statLabel}>Avg latency</Text>
            </View>
          </Card>

          <SectionHeader title="Registrations (30d)" />
          {registrations.length ? (
            <Card>
              <View style={styles.barChart}>
                {registrations.slice(-14).map((r) => (
                  <Bar key={r.day} value={r.count} max={max} label={r.day.slice(5)} />
                ))}
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={styles.muted}>No registration data yet.</Text>
            </Card>
          )}

          {analytics.request_stats?.by_endpoint?.length ? (
            <>
              <SectionHeader title="Top endpoints" />
              <Card>
                {analytics.request_stats.by_endpoint.slice(0, 10).map((e) => (
                  <View key={e.endpoint} style={styles.endpointRow}>
                    <Text style={styles.endpointName} numberOfLines={1}>{e.endpoint}</Text>
                    <Text style={styles.endpointMeta}>{e.requests} req · {e.errors} err</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          <View style={styles.footer}>
            <Button title="Refresh" variant="secondary" onPress={load} />
          </View>
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', marginBottom: spacing.md },
  statValue: { ...typography.title, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, gap: spacing.xs },
  barCol: { flex: 1, alignItems: 'center' },
  barValue: { ...typography.small, color: colors.textSecondary, marginBottom: 2 },
  barTrack: { flex: 1, width: '100%', backgroundColor: colors.primaryLight, borderRadius: radius.sm, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', backgroundColor: colors.primary, borderRadius: radius.sm },
  barLabel: { ...typography.small, color: colors.textMuted, marginTop: 4, fontSize: 10 },
  muted: { ...typography.caption, color: colors.textSecondary },
  endpointRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  endpointName: { ...typography.caption, color: colors.text, flex: 1, marginRight: spacing.sm },
  endpointMeta: { ...typography.small, color: colors.textSecondary },
  footer: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
})
