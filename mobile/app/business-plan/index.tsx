import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { EmptyState, Header, Loading, Screen } from '@/components/ui'
import { listBusinessPlans } from '@/lib/businessPlan'
import { colors, radius, spacing, typography } from '@/theme'
import type { BusinessPlanSummary } from '@/types/businessPlan'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

function readinessColor(score: number | undefined): string {
  if (score == null) return colors.textMuted
  if (score >= 70) return colors.success
  if (score >= 40) return colors.warning
  return colors.danger
}

function PlanCard({ plan, onPress }: { plan: BusinessPlanSummary; onPress: () => void }) {
  const score = plan.readiness ?? 0
  return (
    <Pressable onPress={onPress}>
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardMain}>
            <Text style={styles.cardTitle}>{plan.startup_name}</Text>
            <Text style={styles.cardMeta}>
              {plan.industry ? `${plan.industry} · ` : ''}
              {plan.stage ? `${plan.stage} stage` : 'Idea stage'}
            </Text>
            <Text style={styles.cardDate}>Created {formatDate(plan.created_at)}</Text>
          </View>
          <View style={styles.readiness}>
            <Text style={[styles.readinessValue, { color: readinessColor(score) }]}>{score}</Text>
            <Text style={styles.readinessLabel}>{plan.readiness_label ?? 'readiness'}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          {plan.provider === 'ai' ? (
            <View style={styles.tag}>
              <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
              <Text style={styles.tagText}>AI</Text>
            </View>
          ) : (
            <View style={styles.tag}>
              <Ionicons name="layers-outline" size={12} color={colors.textMuted} />
              <Text style={styles.tagText}>Offline</Text>
            </View>
          )}
          <Text style={styles.cardChevron}>›</Text>
        </View>
      </View>
    </Pressable>
  )
}

export default function BusinessPlanList() {
  const router = useRouter()
  const [plans, setPlans] = useState<BusinessPlanSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await listBusinessPlans()
      setPlans(res.plans)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load business plans')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <Screen>
      <Header
        title="Business Plans"
        right={
          <Pressable hitSlop={8} onPress={() => router.push('/business-plan/new')}>
            <Ionicons name="add" size={26} color={colors.primary} />
          </Pressable>
        }
      />
      {loading ? (
        <Loading label="Loading plans..." />
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PlanCard
              plan={item}
              onPress={() => router.push(`/business-plan/${item.id}`)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <EmptyState
              icon="📋"
              title="No business plans yet"
              subtitle="Generate your first AI-assisted plan"
            />
          }
          contentContainerStyle={styles.list}
        />
      )}
      {plans.length > 0 ? (
        <Pressable style={styles.fab} onPress={() => router.push('/business-plan/new')}>
          <Ionicons name="sparkles" size={22} color="#fff" />
        </Pressable>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120, paddingTop: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.lg,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  cardMain: { flex: 1 },
  cardTitle: { ...typography.subheading },
  cardMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2, textTransform: 'capitalize' },
  cardDate: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  readiness: { alignItems: 'flex-end' },
  readinessValue: { ...typography.heading },
  readinessLabel: { ...typography.small, color: colors.textMuted, textTransform: 'uppercase' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagText: { ...typography.small, color: colors.textMuted },
  cardChevron: { fontSize: 20, color: colors.textMuted },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
})
