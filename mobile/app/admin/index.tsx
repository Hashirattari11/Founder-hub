import React, { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Card, EmptyState, Header, Loading, Screen } from '@/components/ui'
import { adminOverview } from '@/lib/adminApi'
import { useAuth } from '@/context/AuthContext'
import { isSuperAdminProfile } from '@/lib/admin'
import { colors, radius, spacing, typography } from '@/theme'
import type { AdminOverviewResponse } from '@/types/admin'

interface MenuItem {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  route: string
  superAdmin?: boolean
}

const MENU: MenuItem[] = [
  { title: 'Users', icon: 'people-outline', route: '/admin/users' },
  { title: 'Startups', icon: 'rocket-outline', route: '/admin/startups' },
  { title: 'Role Requests', icon: 'swap-horizontal-outline', route: '/admin/role-requests', superAdmin: true },
  { title: 'Reports', icon: 'flag-outline', route: '/admin/reports' },
  { title: 'Analytics', icon: 'bar-chart-outline', route: '/admin/analytics' },
  { title: 'Notifications', icon: 'notifications-outline', route: '/admin/notifications' },
  { title: 'Startup Members', icon: 'people-circle-outline', route: '/admin/startup-members' },
]

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  )
}

export default function AdminIndex() {
  const router = useRouter()
  const { profile } = useAuth()
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const superAdmin = isSuperAdminProfile(profile)

  const load = useCallback(async () => {
    try {
      setOverview(await adminOverview())
    } catch {
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Screen>
      <Header title="Admin Console" showBack={false} />
      {loading ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {overview ? (
            <Card style={styles.statsRow}>
              <Stat label="Users" value={overview.users.total} sub={`+${overview.users.new_7d} in 7d`} />
              <Stat label="Startups" value={overview.startups.total} sub={`${overview.startups.published} published`} />
              <Stat label="Reports" value={overview.reports.open} />
              <Stat label="Requests" value={overview.request_stats.today?.requests ?? 0} sub="today" />
            </Card>
          ) : null}

          <View style={styles.menu}>
            {MENU.filter((m) => !m.superAdmin || superAdmin).map((item) => (
              <Pressable key={item.route} onPress={() => router.push(item.route as never)} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}>
                <View style={styles.menuIcon}>
                  <Ionicons name={item.icon} size={20} color={colors.primary} />
                </View>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>

          {!overview ? <EmptyState icon="⚠️" title="Could not load overview" subtitle="Check your connection and try again." /> : null}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stat: { width: '48%', marginBottom: spacing.md },
  statValue: { ...typography.title, color: colors.primary },
  statLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  menu: { paddingHorizontal: spacing.md, marginTop: spacing.sm },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuTitle: { ...typography.body, flex: 1, fontWeight: '600', color: colors.text },
})
