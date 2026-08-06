import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Header, Chip, EmptyState } from '@/components/ui'
import { getAIStudioConfig } from '@/lib/aiStudio'
import { ROLE_LABELS } from '@/types'
import { colors, radius, spacing, typography } from '@/theme'
import type { AIStudioConfig, StudioTool } from '@/types/aiStudio'

const ROLE_BADGE_COLORS: Record<string, string> = {
  founder: '#6D28D9',
  developer: '#2563EB',
  designer: '#DB2777',
  marketer: '#D97706',
  investor: '#059669',
  legal_advisor: '#475569',
  business_analyst: '#0D9488',
  mentor: '#7C3AED',
  recruiter: '#B45309',
  administrator: '#DC2626',
}

export default function AIStudioIndex() {
  const router = useRouter()
  const [config, setConfig] = useState<AIStudioConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setError(null)
    try {
      setConfig(await getAIStudioConfig())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI Studio')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const categories = config ? ['All', ...config.categories] : ['All']
  const tools = config
    ? config.tools.filter(
        (t) =>
          (activeCategory === 'All' || t.category === activeCategory) &&
          (!query.trim() || t.name.toLowerCase().includes(query.trim().toLowerCase())),
      )
    : []

  return (
    <Screen>
      <Header title="AI Studio" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {config?.studios.length ? (
          <View style={styles.rolesRow}>
            {config.studios.map((s) => (
              <View key={s.role} style={[styles.roleBadge, { backgroundColor: ROLE_BADGE_COLORS[s.role] ?? colors.primary }]}>
                <Text style={styles.roleBadgeText}>{ROLE_LABELS[s.role as keyof typeof ROLE_LABELS] ?? s.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search tools"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsContent}>
          {categories.map((c) => (
            <Chip key={c} label={c} active={activeCategory === c} onPress={() => setActiveCategory(c)} />
          ))}
        </ScrollView>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={load} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !config ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : tools.length === 0 ? (
          <EmptyState icon="🧰" title="No tools found" subtitle="Try another category or search term" />
        ) : (
          tools.map((tool) => <ToolCard key={tool.slug} tool={tool} onPress={() => router.push(`/ai-studio/${tool.slug}`)} />)
        )}
      </ScrollView>
    </Screen>
  )
}

function ToolCard({ tool, onPress }: { tool: StudioTool; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardName}>{tool.name}</Text>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{tool.category}</Text>
        </View>
      </View>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {tool.description}
      </Text>
      <Text style={styles.cardHint}>
        {tool.fields.length} input{tool.fields.length === 1 ? '' : 's'} · {tool.output_format}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  roleBadge: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  roleBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  chips: { marginTop: spacing.md },
  chipsContent: { paddingHorizontal: spacing.md },
  loadingBox: { alignItems: 'center', paddingTop: 80 },
  errorBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.lg },
  errorText: { ...typography.body, color: colors.danger, textAlign: 'center' },
  retryBtn: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.primary },
  retryText: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardPressed: { opacity: 0.7 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardName: { ...typography.subheading, flex: 1 },
  categoryPill: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  categoryText: { color: colors.primaryDark, fontSize: 11, fontWeight: '600' },
  cardDesc: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
  cardHint: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
})
