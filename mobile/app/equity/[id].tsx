import React, { useCallback, useEffect, useState } from 'react'
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Card, EmptyState, Header, Loading, Screen, SectionHeader } from '@/components/ui'
import { getEquityDashboard } from '@/lib/equity'
import { colors, radius, spacing, typography } from '@/theme'
import type { EquityDashboardResponse, EquityHolder, EquityHolderType, InvestmentRound, ShareClassDef } from '@/types/equity'

const TYPE_LABELS: Record<EquityHolderType, string> = {
  founder: 'Founder',
  investor: 'Investor',
  employee: 'Employee',
  advisor: 'Advisor',
  esop: 'ESOP Pool',
  other: 'Other',
}

const TYPE_COLORS: Record<EquityHolderType, string> = {
  founder: '#7C3AED',
  investor: '#185FA5',
  employee: '#0F6E56',
  advisor: '#B45309',
  esop: '#0D9488',
  other: '#52525B',
}

const ROUND_TYPE_LABELS: Record<string, string> = {
  pre_seed: 'Pre-Seed',
  seed: 'Seed',
  series_a: 'Series A',
  series_b: 'Series B',
  series_c: 'Series C',
  bridge: 'Bridge',
  angel: 'Angel',
  grant: 'Grant',
  other: 'Other',
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

export default function EquityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [data, setData] = useState<EquityDashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await getEquityDashboard(id)
      setData(res)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load cap table')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (loading) {
    return (
      <Screen>
        <Loading label="Loading cap table..." />
      </Screen>
    )
  }

  if (!data) {
    return (
      <Screen>
        <Header title="Equity" />
        <EmptyState icon="analytics-outline" title="Cap table unavailable" />
      </Screen>
    )
  }

  const holders = data.holders
  const summary = data.summary

  return (
    <Screen>
      <Header title="Equity & Cap Table" />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{data.startup.name}</Text>
          <Text style={styles.subtitle}>
            {summary.total_shares.toLocaleString()} total shares · {summary.allocated_pct}% allocated
          </Text>
        </View>

        <View style={styles.statsRow}>
          <StatCard icon="people-outline" label="Holders" value={String(holders.length)} />
          <StatCard icon="bar-chart-outline" label="Allocated" value={`${summary.allocated_pct}%`} />
          <StatCard icon="cash-outline" label="Valuation" value={formatCurrency(summary.valuation)} />
          <StatCard icon="trending-up-outline" label="ESOP" value={`${summary.esop_pct}%`} />
        </View>

        {holders.length > 0 ? (
          <>
            <SectionHeader title="Ownership by type" />
            <Card>
              <View style={styles.bar}>
                {(['founder', 'investor', 'employee', 'advisor', 'esop', 'other'] as EquityHolderType[]).map((t) =>
                  summary.by_holder_type[t]?.shares > 0 ? (
                    <View
                      key={t}
                      style={{ width: `${summary.by_holder_type[t].pct}%`, backgroundColor: TYPE_COLORS[t] }}
                    />
                  ) : null,
                )}
              </View>
              <View style={styles.legendWrap}>
                {(['founder', 'investor', 'employee', 'advisor', 'esop', 'other'] as EquityHolderType[]).map((t) =>
                  summary.by_holder_type[t]?.shares > 0 ? (
                    <View key={t} style={styles.legendRow}>
                      <View style={[styles.legendDot, { backgroundColor: TYPE_COLORS[t] }]} />
                      <Text style={styles.legendText}>
                        {TYPE_LABELS[t]} {summary.by_holder_type[t].pct}%
                      </Text>
                    </View>
                  ) : null,
                )}
              </View>
            </Card>

            <SectionHeader title="Equity holders" />
            {holders.map((h) => (
              <HolderCard key={h.id} holder={h} />
            ))}
          </>
        ) : (
          <EmptyState icon="people-outline" title="No holders yet" subtitle="Holders will appear once the founder builds the cap table." />
        )}

        {data.share_classes.length > 0 && (
          <>
            <SectionHeader title="Share classes" />
            <Card>
              {data.share_classes.map((c) => (
                <ClassRow key={c.id} klass={c} />
              ))}
            </Card>
          </>
        )}

        {data.rounds.length > 0 && (
          <>
            <SectionHeader title="Investment rounds" />
            {data.rounds.map((r) => (
              <RoundCard key={r.id} round={r} />
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

function HolderCard({ holder }: { holder: EquityHolder }) {
  const sched = holder.vesting_schedules[0]
  const pct = Math.min(100, Math.max(0, holder.vested_pct))
  return (
    <Card>
      <View style={styles.holderRow}>
        <View style={styles.holderMain}>
          <Text style={styles.holderName}>{holder.name}</Text>
          <Text style={styles.holderMeta}>
            {TYPE_LABELS[holder.holder_type] ?? holder.holder_type}
            {holder.share_class_name ? ` · ${holder.share_class_name}` : ''}
            {holder.title ? ` · ${holder.title}` : ''}
          </Text>
        </View>
        <View style={styles.holderPct}>
          <Text style={styles.holderPctValue}>{holder.ownership_pct.toFixed(2)}%</Text>
          <Text style={styles.holderShares}>{holder.shares.toLocaleString()} shares</Text>
        </View>
      </View>
      {sched ? (
        <View style={styles.vestWrap}>
          <View style={styles.vestBar}>
            <View style={[styles.vestFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.vestText}>
            {holder.vested_shares != null ? `${holder.vested_shares.toLocaleString()} / ${holder.shares.toLocaleString()} vested` : 'Not started'}
            {' · '}
            {sched.cliff_months ?? 0}mo cliff / {sched.total_months ?? 0}mo
          </Text>
        </View>
      ) : null}
    </Card>
  )
}

function ClassRow({ klass }: { klass: ShareClassDef }) {
  return (
    <View style={styles.classRow}>
      <View style={styles.classDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.className}>{klass.name}</Text>
        <Text style={styles.classMeta}>
          {klass.class_type} · pref {klass.liquidation_preference ?? 1}x · {klass.voting_rights ? 'voting' : 'non-voting'}
        </Text>
      </View>
      <Text style={styles.classPar}>${klass.par_value ?? 0.0001}</Text>
    </View>
  )
}

function RoundCard({ round }: { round: InvestmentRound }) {
  return (
    <Card>
      <View style={styles.roundRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.roundName}>{round.round_name}</Text>
          <Text style={styles.roundMeta}>
            {ROUND_TYPE_LABELS[round.round_type] ?? round.round_type} · {round.status.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.roundVal}>{formatCurrency(round.post_money_valuation)}</Text>
      </View>
      <View style={styles.roundStats}>
        <Text style={styles.roundStat}>Target {formatCurrency(round.target_amount)}</Text>
        <Text style={styles.roundStat}>Raised {formatCurrency(round.raised_amount)}</Text>
        {round.new_shares_issued != null ? (
          <Text style={styles.roundStat}>{round.new_shares_issued.toLocaleString()} new shares</Text>
        ) : null}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  body: { paddingBottom: 60 },
  titleBlock: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { ...typography.title },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statLabel: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs, textTransform: 'uppercase' },
  statValue: { ...typography.subheading, marginTop: 2 },
  bar: { flexDirection: 'row', height: 10, borderRadius: radius.full, overflow: 'hidden', backgroundColor: colors.border },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { ...typography.small, color: colors.textSecondary },
  holderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  holderMain: { flex: 1 },
  holderName: { ...typography.subheading },
  holderMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  holderPct: { alignItems: 'flex-end' },
  holderPctValue: { ...typography.subheading, color: colors.primary },
  holderShares: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  vestWrap: { marginTop: spacing.md },
  vestBar: { height: 6, borderRadius: radius.full, overflow: 'hidden', backgroundColor: colors.border },
  vestFill: { height: '100%', backgroundColor: colors.success, borderRadius: radius.full },
  vestText: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  classRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  classDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginRight: spacing.md },
  className: { ...typography.subheading },
  classMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  classPar: { ...typography.caption, color: colors.textMuted },
  roundRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  roundName: { ...typography.subheading },
  roundMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  roundVal: { ...typography.subheading, color: colors.primary },
  roundStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  roundStat: { ...typography.small, color: colors.textMuted },
})
