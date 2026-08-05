import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Avatar, Button, Card, SectionHeader, EmptyState } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getMyStartups } from '@/lib/startups'
import { ROLE_LABELS } from '@/types'
import { colors, radius, spacing, typography } from '@/theme'
import type { Startup } from '@/types'

export default function Profile() {
  const { profile, session, signOut, refreshProfile } = useAuth()
  const router = useRouter()
  const [startups, setStartups] = useState<Startup[]>([])

  const load = useCallback(async () => {
    if (!session?.user.id) return
    try {
      setStartups(await getMyStartups(session.user.id))
    } catch {
      // ignore
    }
  }, [session?.user.id])

  useEffect(() => {
    load()
  }, [load])

  if (!profile) return null

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.cover}>
          <Avatar uri={profile.avatar_url} name={profile.full_name} role={profile.role} size={88} />
          <Text style={styles.name}>{profile.full_name}</Text>
          {profile.role && <Text style={styles.role}>{ROLE_LABELS[profile.role]}</Text>}
          {profile.city && <Text style={styles.location}>{profile.city}{profile.country ? `, ${profile.country}` : ''}</Text>}
        </View>

        {profile.bio ? (
          <Card>
            <Text style={styles.bio}>{profile.bio}</Text>
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button title="Edit Profile" variant="secondary" onPress={() => router.push('/edit-profile')} style={styles.actionBtn} />
          <Button title="Settings" variant="outline" onPress={() => router.push('/settings')} style={styles.actionBtn} />
        </View>

        {profile.skills?.length ? (
          <View>
            <SectionHeader title="Skills" />
            <View style={styles.skillRow}>
              {profile.skills.map((s) => (
                <View key={s} style={styles.skill}>
                  <Text style={styles.skillText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <SectionHeader title="My Startups" />
        {startups.length === 0 ? (
          <EmptyState icon="🚀" title="No startups yet" subtitle="Create a startup listing from the Startups screen" />
        ) : (
          startups.map((s) => (
            <Pressable key={s.id} onPress={() => router.push(`/startup/${s.id}`)}>
              <Card>
                <Text style={styles.startupName}>{s.name}</Text>
                {s.tagline ? <Text style={styles.startupTagline}>{s.tagline}</Text> : null}
              </Card>
            </Pressable>
          ))
        )}

        <View style={styles.signOut}>
          <Button
            title="Sign Out"
            variant="danger"
            onPress={() =>
              Alert.alert('Sign out', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
              ])
            }
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  cover: { alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: colors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  name: { ...typography.title, marginTop: spacing.md },
  role: { ...typography.subheading, color: colors.primary, marginTop: 2 },
  location: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  bio: { ...typography.body, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm },
  skill: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  skillText: { ...typography.caption, color: colors.primaryDark, fontWeight: '600' },
  startupName: { ...typography.subheading },
  startupTagline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  signOut: { paddingHorizontal: spacing.md, marginTop: spacing.xl },
})
