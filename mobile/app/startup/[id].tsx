import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Avatar, Button, Card, Field, Header, Loading, SectionHeader } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getStartupById, trackStartupView, isStartupSaved, saveStartup, unsaveStartup } from '@/lib/startups'
import { getFollowState, toggleFollow } from '@/lib/follows'
import { hasApplied, applyToStartup } from '@/lib/applications'
import { startChat } from '@/lib/chat'
import { colors, radius, spacing, typography } from '@/theme'
import type { Startup } from '@/types'

export default function StartupDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuth()
  const router = useRouter()
  const [startup, setStartup] = useState<Startup | null>(null)
  const [following, setFollowing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [applied, setApplied] = useState(false)
  const [showApply, setShowApply] = useState(false)

  const me = session?.user.id
  const isOwner = startup?.founder_id === me

  const load = useCallback(async () => {
    if (!id) return
    const s = await getStartupById(id)
    setStartup(s)
    if (s && me) {
      trackStartupView(id, me).catch(() => {})
      setFollowing(await getFollowState(me, id, 'startup'))
      setSaved(await isStartupSaved(me, id))
      setApplied(await hasApplied(id, me))
    }
  }, [id, me])

  useEffect(() => {
    load()
  }, [load])

  const follow = async () => {
    if (!me) return
    setFollowing((f) => !f)
    try {
      await toggleFollow(me, id!, 'startup')
    } catch {
      setFollowing((f) => !f)
    }
  }

  const toggleSave = async () => {
    if (!me) return
    if (saved) {
      await unsaveStartup(me, id!)
      setSaved(false)
    } else {
      await saveStartup(me, id!)
      setSaved(true)
    }
  }

  const apply = async (role: string, message: string) => {
    if (!me || !id) return
    try {
      await applyToStartup({ startup_id: id, role_applying_for: role, cover_message: message })
      setApplied(true)
      setShowApply(false)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not apply')
    }
  }

  const chatWithFounder = async () => {
    if (!startup?.founder_id) return
    try {
      const chat = await startChat(startup.founder_id)
      router.push(`/chat/${chat.id}`)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not start chat')
    }
  }

  if (!startup) {
    return (
      <Screen>
        <Loading />
      </Screen>
    )
  }

  return (
    <Screen>
      <Header title="Startup" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.cover}>
          <Text style={styles.name}>{startup.name}</Text>
          {startup.tagline ? <Text style={styles.tagline}>{startup.tagline}</Text> : null}
          {startup.industry ? <Text style={styles.industry}>{startup.industry}</Text> : null}
          <View style={styles.saveRow}>
            <Pressable onPress={follow} hitSlop={8}>
              <Text style={styles.actionText}>{following ? 'Following ✓' : '+ Follow'}</Text>
            </Pressable>
            <Pressable onPress={toggleSave} hitSlop={8}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? colors.primary : colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {startup.description ? (
          <Card>
            <Text style={styles.description}>{startup.description}</Text>
          </Card>
        ) : null}

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Stage</Text>
            <Text style={styles.infoValue}>{startup.stage ?? '—'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Funding</Text>
            <Text style={styles.infoValue}>{startup.funding_needed ?? '—'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Equity</Text>
            <Text style={styles.infoValue}>{startup.equity_offered != null ? `${startup.equity_offered}%` : '—'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Location</Text>
            <Text style={styles.infoValue}>{startup.location ?? (startup.remote_friendly ? 'Remote' : '—')}</Text>
          </View>
        </View>

        {startup.tech_stack?.length ? (
          <View>
            <SectionHeader title="Tech Stack" />
            <View style={styles.chips}>
              {startup.tech_stack.map((t) => (
                <View key={t} style={styles.chip}>
                  <Text style={styles.chipText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {startup.team_roles_needed?.length ? (
          <View>
            <SectionHeader title="Looking For" />
            <View style={styles.chips}>
              {startup.team_roles_needed.map((r) => (
                <View key={r} style={[styles.chip, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.chipText, { color: '#92400E' }]}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {startup.profiles && (
          <Pressable onPress={() => router.push(`/user/${startup.founder_id}`)}>
            <Card>
              <View style={styles.founderRow}>
                <Avatar uri={startup.profiles.avatar_url} name={startup.profiles.full_name} size={44} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.founderName}>{startup.profiles.full_name}</Text>
                  <Text style={styles.founderRole}>Founder</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          </Pressable>
        )}

        <View style={styles.actions}>
          {!isOwner && !applied && (
            <Button title={applied ? 'Applied ✓' : 'Apply to Join'} onPress={() => setShowApply(true)} style={styles.actionBtn} />
          )}
          {!isOwner && (
            <Button title="Message Founder" variant="secondary" onPress={chatWithFounder} style={styles.actionBtn} />
          )}
        </View>
      </ScrollView>

      <ApplyModal
        visible={showApply}
        onClose={() => setShowApply(false)}
        startupName={startup.name}
        roles={startup.team_roles_needed ?? []}
        onSubmit={apply}
      />
    </Screen>
  )
}

function ApplyModal({
  visible,
  onClose,
  startupName,
  roles,
  onSubmit,
}: {
  visible: boolean
  onClose: () => void
  startupName: string
  roles: string[]
  onSubmit: (role: string, message: string) => void
}) {
  const [role, setRole] = useState(roles[0] ?? '')
  const [message, setMessage] = useState('')

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <Header title={`Apply to ${startupName}`} right={<Button title="Close" variant="ghost" onPress={onClose} />} />
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          {roles.length ? (
            <View style={styles.applyRoles}>
              {roles.map((r) => (
                <Pressable key={r} style={[styles.rolePill, role === r && styles.rolePillActive]} onPress={() => setRole(r)}>
                  <Text style={[styles.rolePillText, role === r && styles.rolePillTextActive]}>{r}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Field
            label="Why do you want to join?"
            value={message}
            onChangeText={setMessage}
            placeholder="Tell the founder about yourself..."
            multiline
            numberOfLines={5}
          />
          <Button title="Submit Application" onPress={() => onSubmit(role, message)} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </Screen>
    </Modal>
  )
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: colors.card },
  name: { ...typography.title },
  tagline: { ...typography.subheading, color: colors.textSecondary, marginTop: 4, textAlign: 'center', paddingHorizontal: spacing.lg },
  industry: { ...typography.caption, color: colors.primary, fontWeight: '700', marginTop: 4 },
  saveRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg },
  actionText: { color: colors.primary, fontWeight: '700' },
  description: { ...typography.body, lineHeight: 22 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.md },
  infoItem: { width: '50%', paddingVertical: spacing.sm },
  infoLabel: { ...typography.small, color: colors.textMuted },
  infoValue: { ...typography.subheading, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { ...typography.caption, color: colors.primaryDark, fontWeight: '600' },
  founderRow: { flexDirection: 'row', alignItems: 'center' },
  founderName: { ...typography.subheading },
  founderRole: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, marginTop: spacing.sm },
  actionBtn: { flex: 1 },
  applyRoles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  rolePill: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rolePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rolePillText: { ...typography.caption, color: colors.textSecondary },
  rolePillTextActive: { color: '#fff', fontWeight: '700' },
})
