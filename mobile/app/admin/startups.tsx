import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { Button, EmptyState, Header, Loading, Screen } from '@/components/ui'
import { adminStartups, adminUpdateStartup } from '@/lib/adminApi'
import { colors, radius, spacing, typography } from '@/theme'
import type { AdminStartup } from '@/types/admin'

export default function AdminStartups() {
  const [startups, setStartups] = useState<AdminStartup[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminStartups({ limit: 100 })
      setStartups(res.startups)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load startups')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleFlag = async (s: AdminStartup, flag: 'is_featured' | 'is_verified' | 'is_published' | 'is_hidden') => {
    setBusyId(s.id)
    try {
      await adminUpdateStartup(s.id, { [flag]: !s[flag] })
      setStartups((prev) => prev.map((x) => (x.id === s.id ? { ...x, [flag]: !x[flag] } : x)))
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update startup')
    } finally {
      setBusyId(null)
    }
  }

  const renderItem = ({ item }: { item: AdminStartup }) => {
    const disabled = busyId === item.id
    return (
      <View style={styles.row}>
        <Text style={styles.name}>{item.name}</Text>
        {item.tagline ? <Text style={styles.tagline}>{item.tagline}</Text> : null}
        <Text style={styles.meta}>
          {item.industry ?? '—'} · {item.stage ?? '—'} · by {item.founder_name ?? 'unknown'}
        </Text>
        <View style={styles.flags}>
          <Pressable onPress={() => toggleFlag(item, 'is_featured')} disabled={disabled} style={[styles.flag, item.is_featured ? styles.flagOn : styles.flagOff]}>
            <Text style={styles.flagText}>{item.is_featured ? '★ Featured' : 'Feature'}</Text>
          </Pressable>
          <Pressable onPress={() => toggleFlag(item, 'is_verified')} disabled={disabled} style={[styles.flag, item.is_verified ? styles.flagOn : styles.flagOff]}>
            <Text style={styles.flagText}>{item.is_verified ? '✓ Verified' : 'Verify'}</Text>
          </Pressable>
          <Pressable onPress={() => toggleFlag(item, 'is_published')} disabled={disabled} style={[styles.flag, item.is_published ? styles.flagOn : styles.flagOff]}>
            <Text style={styles.flagText}>{item.is_published ? 'Published' : 'Draft'}</Text>
          </Pressable>
          {item.is_hidden ? (
            <Pressable onPress={() => toggleFlag(item, 'is_hidden')} disabled={disabled} style={[styles.flag, styles.flagDanger]}>
              <Text style={styles.flagText}>Unhide</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }

  return (
    <Screen>
      <Header title="Startups" />
      {loading ? (
        <Loading />
      ) : startups.length === 0 ? (
        <EmptyState icon="🚀" title="No startups found" />
      ) : (
        <FlatList
          data={startups}
          keyExtractor={(s) => s.id}
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
  name: { ...typography.subheading, color: colors.text },
  tagline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  meta: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  flag: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  flagOn: { backgroundColor: colors.primary },
  flagOff: { backgroundColor: colors.primaryLight },
  flagDanger: { backgroundColor: colors.danger },
  flagText: { color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
  footer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
})
