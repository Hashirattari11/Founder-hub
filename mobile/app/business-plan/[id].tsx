import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Card, EmptyState, Header, Loading, Screen, SectionHeader } from '@/components/ui'
import { deleteBusinessPlan, getBusinessPlan } from '@/lib/businessPlan'
import { colors, radius, spacing, typography } from '@/theme'
import type { BusinessPlanRecord } from '@/types/businessPlan'

type Tab = 'overview' | 'pitch' | 'financials' | 'team' | 'ai'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'financials', label: 'Financials' },
  { id: 'team', label: 'Team' },
  { id: 'ai', label: 'AI' },
]

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

export default function BusinessPlanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const [plan, setPlan] = useState<BusinessPlanRecord | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const res = await getBusinessPlan(id)
      setPlan(res)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load business plan')
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

  const onDelete = () => {
    Alert.alert('Delete plan', `Delete "${plan?.startup_name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBusinessPlan(plan!.id)
            router.back()
          } catch (e) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete plan')
          }
        },
      },
    ])
  }

  if (loading) {
    return (
      <Screen>
        <Loading label="Loading plan..." />
      </Screen>
    )
  }

  if (!plan) {
    return (
      <Screen>
        <Header title="Business Plan" />
        <EmptyState icon="📋" title="Plan unavailable" />
      </Screen>
    )
  }

  const readiness = plan.investor_readiness
  const fin = plan.financial_projection

  return (
    <Screen>
      <Header
        title={plan.startup_name}
        right={
          <Pressable hitSlop={8} onPress={onDelete}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        }
      />
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.id} style={[styles.tab, tab === t.id && styles.tabActive]} onPress={() => setTab(t.id)}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {tab === 'overview' && <OverviewTab plan={plan} />}
        {tab === 'pitch' && <PitchTab plan={plan} />}
        {tab === 'financials' && <FinancialsTab plan={plan} />}
        {tab === 'team' && <TeamTab plan={plan} />}
        {tab === 'ai' && <AiTab plan={plan} />}
      </ScrollView>
    </Screen>
  )
}

function OverviewTab({ plan }: { plan: BusinessPlanRecord }) {
  const readiness = plan.investor_readiness
  const inputs = plan.inputs
  const overallColor = readiness.overall >= 70 ? colors.success : readiness.overall >= 40 ? colors.warning : colors.danger

  return (
    <>
      <Card>
        <View style={styles.readyRow}>
          <View>
            <Text style={[styles.readyScore, { color: overallColor }]}>{readiness.overall}</Text>
            <Text style={styles.readyLabel}>Investor readiness</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.readyTitle}>{readiness.label}</Text>
            <Text style={styles.readySummary}>{readiness.summary}</Text>
          </View>
        </View>
        <View style={styles.scoreGrid}>
          {readiness.scores.map((s) => (
            <View key={s.label} style={styles.scoreRow}>
              <Text style={styles.scoreName}>{s.label}</Text>
              <Text style={styles.scoreVal}>
                {s.score}/{s.max}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <SectionHeader title="Setup" />
      <Card>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Idea</Text>
          <Text style={styles.infoValue}>{plan.idea}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Industry</Text>
          <Text style={styles.infoValue}>{inputs.industry || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Market</Text>
          <Text style={styles.infoValue}>{inputs.country || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Audience</Text>
          <Text style={styles.infoValue}>{inputs.target_audience || '—'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Model</Text>
          <Text style={styles.infoValue}>{inputs.business_model}</Text>
        </View>
      </Card>

      <SectionHeader title="Business plan" />
      {plan.business_plan.map((section) => (
        <Card key={section.key}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionContent}>{section.content}</Text>
        </Card>
      ))}
    </>
  )
}

function PitchTab({ plan }: { plan: BusinessPlanRecord }) {
  return (
    <>
      <Text style={styles.hint}>12-slide investor pitch deck with speaker notes.</Text>
      {plan.pitch_deck.map((slide, i) => (
        <Card key={slide.key}>
          <Text style={styles.slideNum}>SLIDE {i + 1}</Text>
          <Text style={styles.sectionTitle}>{slide.title}</Text>
          {slide.bullets.map((b, j) => (
            <View key={j} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>{b}</Text>
            </View>
          ))}
          {slide.note ? <Text style={styles.slideNote}>{slide.note}</Text> : null}
        </Card>
      ))}
    </>
  )
}

function FinancialsTab({ plan }: { plan: BusinessPlanRecord }) {
  const fin = plan.financial_projection
  const peak = Math.max(...fin.monthly_revenue, 1)
  return (
    <>
      <Text style={styles.hint}>12-month financial model.</Text>

      <Card>
        <View style={styles.statRow}>
          <StatCell label="Year 1 revenue" value={formatCurrency(fin.year1_revenue)} />
          <StatCell label="Year 2 revenue" value={formatCurrency(fin.year2_revenue)} />
          <StatCell label="Year 3 revenue" value={formatCurrency(fin.year3_revenue)} />
        </View>
        <View style={styles.statRow}>
          <StatCell label="Break-even" value={fin.break_even_month ? `M${fin.break_even_month}` : '—'} />
          <StatCell label="Runway" value={fin.runway_months ? `${fin.runway_months} mo` : '—'} />
          <StatCell label="Burn" value={formatCurrency(fin.burn_rate)} />
        </View>
        <View style={styles.statRow}>
          <StatCell label="Monthly budget" value={formatCurrency(fin.monthly_budget)} />
          <StatCell label="Funding need" value={formatCurrency(fin.funding_requirement)} />
        </View>
      </Card>

      <SectionHeader title="Monthly revenue" />
      <Card>
        <View style={styles.barChart}>
          {fin.monthly_revenue.map((r, i) => (
            <View key={i} style={styles.barCol}>
              <View style={[styles.bar, { height: `${Math.max(4, (r / peak) * 100)}%`, backgroundColor: colors.primary }]} />
            </View>
          ))}
        </View>
        <View style={styles.chartAxis}>
          <Text style={styles.axisLabel}>M1</Text>
          <Text style={styles.axisLabel}>M6</Text>
          <Text style={styles.axisLabel}>M12</Text>
        </View>
      </Card>

      <SectionHeader title="Use of funds" />
      <Card>
        {fin.use_of_funds.map((item) => (
          <View key={item.label} style={styles.pctRow}>
            <Text style={styles.pctName}>{item.label}</Text>
            <View style={styles.pctTrack}>
              <View style={[styles.pctFill, { width: `${item.percent}%` }]} />
            </View>
            <Text style={styles.pctVal}>{item.percent}%</Text>
          </View>
        ))}
      </Card>

      <SectionHeader title="Expense breakdown" />
      <Card>
        {Object.entries(fin.expense_breakdown).map(([key, value]) => {
          if (key === 'total') return null
          return (
            <View key={key} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{key.replace(/_/g, ' ')}</Text>
              <Text style={styles.infoValue}>{formatCurrency(value as number)}</Text>
            </View>
          )
        })}
      </Card>

      <SectionHeader title="Key assumptions" />
      <Card>
        {fin.key_assumptions.map((a, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{a}</Text>
          </View>
        ))}
      </Card>
    </>
  )
}

function TeamTab({ plan }: { plan: BusinessPlanRecord }) {
  return (
    <>
      <Text style={styles.hint}>Recommended hiring plan.</Text>
      {plan.team_recommendations.map((t) => (
        <Card key={t.role}>
          <View style={styles.teamRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>{t.role}</Text>
              <Text style={styles.teamMeta}>
                {t.seniority} · {t.count} {t.count > 1 ? 'hires' : 'hire'} · {t.remote_ok ? 'remote ok' : 'on-site'}
              </Text>
            </View>
          </View>
          <Text style={styles.bulletText}>{t.reason}</Text>
        </Card>
      ))}
    </>
  )
}

function AiTab({ plan }: { plan: BusinessPlanRecord }) {
  const rec = plan.ai_recommendations
  const groups: { title: string; items: string[] }[] = [
    { title: 'Missing features', items: rec.missing_features },
    { title: 'Weaknesses', items: rec.weaknesses },
    { title: 'Improvements', items: rec.improvements },
    { title: 'Risks', items: rec.risks },
    { title: 'Scaling plan', items: rec.scaling_plan },
    { title: 'Internationalization', items: rec.internationalization },
  ]
  return (
    <>
      <Text style={styles.hint}>
        {plan.provider === 'ai' ? 'Generated with your AI provider.' : 'Generated with the built-in offline engine.'}
      </Text>
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <View key={g.title}>
              <SectionHeader title={g.title} />
              <Card>
                {g.items.map((item, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))}
              </Card>
            </View>
          ),
      )}
    </>
  )
}

const styles = StyleSheet.create({
  body: { paddingBottom: 60 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { ...typography.caption, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  hint: { ...typography.small, color: colors.textMuted, paddingHorizontal: spacing.md, marginTop: spacing.md },
  readyRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  readyScore: { fontSize: 40, fontWeight: '800' },
  readyLabel: { ...typography.small, color: colors.textMuted, textTransform: 'uppercase' },
  readyTitle: { ...typography.subheading, marginTop: 2 },
  readySummary: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  scoreGrid: { marginTop: spacing.lg, gap: spacing.sm },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreName: { ...typography.caption, color: colors.textSecondary, textTransform: 'capitalize' },
  scoreVal: { ...typography.caption, fontWeight: '700', color: colors.text },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs },
  infoLabel: { ...typography.caption, color: colors.textMuted, width: 90 },
  infoValue: { ...typography.caption, color: colors.text, flex: 1, textAlign: 'right' },
  sectionTitle: { ...typography.subheading, marginBottom: 4 },
  sectionContent: { ...typography.caption, color: colors.textSecondary, lineHeight: 20 },
  slideNum: { ...typography.small, color: colors.primary, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  slideNote: { ...typography.small, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.sm },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  bulletDot: { color: colors.primary, width: 8 },
  bulletText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 19 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  statCell: { flex: 1, minWidth: '30%' },
  statLabel: { ...typography.small, color: colors.textMuted, textTransform: 'uppercase' },
  statValue: { ...typography.subheading, marginTop: 2 },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderRadius: 2 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  axisLabel: { ...typography.small, color: colors.textMuted },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  pctName: { ...typography.small, color: colors.textSecondary, width: 96 },
  pctTrack: { flex: 1, height: 6, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  pctFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
  pctVal: { ...typography.small, color: colors.text, width: 44, textAlign: 'right' },
  teamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamMeta: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.sm, textTransform: 'capitalize' },
})
