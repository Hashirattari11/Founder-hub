import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Button, Field, Header, Chip, Loading, EmptyState } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { exploreStartups, createStartup } from '@/lib/startups'
import { colors, radius, spacing, typography } from '@/theme'
import type { Startup, StartupStage } from '@/types'

const STAGES: { id: StartupStage; label: string }[] = [
  { id: 'idea', label: 'Idea' },
  { id: 'mvp', label: 'MVP' },
  { id: 'growth', label: 'Growth' },
  { id: 'scaling', label: 'Scaling' },
]

export default function Startups() {
  const { profile } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [stage, setStage] = useState<StartupStage | null>(null)
  const [startups, setStartups] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { startups: data } = await exploreStartups({ search: query, stages: stage ? [stage] : [], page: 0, pageSize: 50 })
      setStartups(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [query, stage])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const create = async (payload: Parameters<typeof createStartup>[0]) => {
    try {
      await createStartup(payload)
      setShowCreate(false)
      await load()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create startup')
    }
  }

  return (
    <Screen>
      <Header
        title="Startups"
        showBack={false}
        right={
          profile?.role === 'founder' ? (
            <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
              <Ionicons name="add" size={28} color={colors.primary} />
            </Pressable>
          ) : undefined
        }
      />
      <View style={styles.search}>
        <Field label="" value={query} onChangeText={setQuery} placeholder="Search startups..." autoCapitalize="none" />
      </View>
      <View style={styles.chips}>
        {STAGES.map((s) => (
          <Chip key={s.id} label={s.label} active={stage === s.id} onPress={() => setStage(stage === s.id ? null : s.id)} />
        ))}
      </View>
      {loading && startups.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={startups}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="🚀" title="No startups found" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/startup/${item.id}`)}>
              <View style={styles.card}>
                <Text style={styles.name}>{item.name}</Text>
                {item.tagline ? <Text style={styles.tagline}>{item.tagline}</Text> : null}
                <View style={styles.metaRow}>
                  {item.industry ? <Text style={styles.meta}>{item.industry}</Text> : null}
                  {item.stage ? <Text style={styles.meta}>{item.stage}</Text> : null}
                  {item.funding_needed ? <Text style={styles.meta}>{item.funding_needed}</Text> : null}
                </View>
                {item.team_roles_needed?.length ? (
                  <Text style={styles.roles}>Hiring: {item.team_roles_needed.join(', ')}</Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}

      <CreateStartupModal visible={showCreate} onClose={() => setShowCreate(false)} onCreate={create} />
    </Screen>
  )
}

function CreateStartupModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean
  onClose: () => void
  onCreate: (p: Parameters<typeof createStartup>[0]) => void
}) {
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('')
  const [stage, setStage] = useState<StartupStage>('idea')
  const [funding, setFunding] = useState('')
  const [equity, setEquity] = useState('')
  const [roles, setRoles] = useState('')
  const [tech, setTech] = useState('')
  const [location, setLocation] = useState('')

  const submit = () => {
    if (!name.trim()) {
      Alert.alert('Name required')
      return
    }
    onCreate({
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      industry: industry.trim(),
      stage,
      funding_needed: funding.trim() || null,
      equity_offered: parseInt(equity, 10) || 0,
      team_roles_needed: roles.split(',').map((r) => r.trim()).filter(Boolean),
      tech_stack: tech.split(',').map((t) => t.trim()).filter(Boolean),
      location: location.trim() || null,
      remote_friendly: true,
      is_published: true,
    })
    setName('')
    setTagline('')
    setDescription('')
    setIndustry('')
    setFunding('')
    setEquity('')
    setRoles('')
    setTech('')
    setLocation('')
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <Header title="Create Startup" right={<Button title="Close" variant="ghost" onPress={onClose} />} />
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Field label="Name" value={name} onChangeText={setName} placeholder="Startup name" />
          <Field label="Tagline" value={tagline} onChangeText={setTagline} placeholder="One line about it" />
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="What do you build?" multiline numberOfLines={4} />
          <Field label="Industry" value={industry} onChangeText={setIndustry} placeholder="e.g. AI/ML, Fintech" />
          <Field label="Location" value={location} onChangeText={setLocation} placeholder="City / Remote" />
          <Field label="Funding needed" value={funding} onChangeText={setFunding} placeholder="e.g. $50K-$100K" />
          <Field label="Equity offered (%)" value={equity} onChangeText={setEquity} keyboardType="number-pad" />
          <Field label="Roles needed (comma separated)" value={roles} onChangeText={setRoles} placeholder="Developer, Designer" />
          <Field label="Tech stack (comma separated)" value={tech} onChangeText={setTech} placeholder="React, Node.js" />

          <Text style={styles.stageLabel}>Stage</Text>
          <View style={styles.chips}>
            {STAGES.map((s) => (
              <Chip key={s.id} label={s.label} active={stage === s.id} onPress={() => setStage(s.id)} />
            ))}
          </View>

          <Button title="Create Startup" onPress={submit} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </Screen>
    </Modal>
  )
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  name: { ...typography.subheading },
  tagline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  meta: { ...typography.small, color: colors.textSecondary, backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 3, overflow: 'hidden' },
  roles: { ...typography.caption, color: colors.primaryDark, fontWeight: '600', marginTop: spacing.sm },
  stageLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs },
})
