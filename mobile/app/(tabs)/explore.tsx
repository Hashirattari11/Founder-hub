import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/theme'
import { useNotifications } from '@/context/NotificationsContext'

const ITEMS: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; href: string }[] = [
  { label: 'Jobs', icon: 'briefcase-outline', color: '#2563EB', href: '/jobs' },
  { label: 'Startups', icon: 'rocket-outline', color: '#7C3AED', href: '/startups' },
  { label: 'Investors', icon: 'trending-up-outline', color: '#059669', href: '/investors' },
  { label: 'Community', icon: 'people-outline', color: '#DB2777', href: '/community' },
  { label: 'Network', icon: 'git-network-outline', color: '#D97706', href: '/network' },
  { label: 'Notifications', icon: 'notifications-outline', color: '#DC2626', href: '/notifications' },
  { label: 'Settings', icon: 'settings-outline', color: '#475569', href: '/settings' },
]

export default function Explore() {
  const router = useRouter()
  const { unreadCount } = useNotifications()

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Explore</Text>
      </View>
      <ScrollView contentContainerStyle={styles.grid}>
        {ITEMS.map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
            onPress={() => router.push(item.href as never)}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}18` }]}>
              <Ionicons name={item.icon} size={26} color={item.color} />
              {item.label === 'Notifications' && unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>
            <Text style={styles.tileLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md, paddingBottom: 40 },
  tile: { width: '31%', margin: '1.15%', alignItems: 'center', paddingVertical: spacing.lg },
  iconWrap: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  tileLabel: { ...typography.caption, fontWeight: '600', color: colors.text },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
})
