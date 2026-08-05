import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen, Avatar, Button, Card, Loading, SectionHeader } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getConnectionState, sendConnectionRequest, acceptConnectionRequest, type ConnectionState } from '@/lib/connections'
import { getFollowState, toggleFollow } from '@/lib/follows'
import { startChat } from '@/lib/chat'
import { ROLE_LABELS, type Profile } from '@/types'
import { colors, radius, spacing, typography } from '@/theme'

export default function UserProfile() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { session } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [connState, setConnState] = useState<ConnectionState>({ status: 'none' })
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

  const me = session?.user.id
  const isMe = me === userId

  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data as Profile | null)
    if (me && !isMe) {
      setConnState(await getConnectionState(me, userId))
      setFollowing(await getFollowState(me, userId, 'user'))
    }
  }, [userId, me, isMe])

  useEffect(() => {
    load()
  }, [load])

  if (!profile) {
    return (
      <Screen>
        <Loading />
      </Screen>
    )
  }

  const connect = async () => {
    if (!me) return
    setBusy(true)
    try {
      if (connState.status === 'none') {
        await sendConnectionRequest(me, userId!)
        setConnState({ status: 'pending' })
      } else if (connState.status === 'requested') {
        await acceptConnectionRequest(me, userId!)
        setConnState({ status: 'accepted' })
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  const follow = async () => {
    if (!me) return
    setFollowing((f) => !f)
    try {
      await toggleFollow(me, userId!, 'user')
    } catch {
      setFollowing((f) => !f)
    }
  }

  const message = async () => {
    if (!me) return
    try {
      const chat = await startChat(userId!)
      router.push(`/chat/${chat.id}`)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not start chat')
    }
  }

  const connectLabel =
    connState.status === 'accepted'
      ? 'Connected'
      : connState.status === 'pending'
        ? 'Requested'
        : connState.status === 'requested'
          ? 'Accept Request'
          : 'Connect'

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.cover}>
          <Avatar uri={profile.avatar_url} name={profile.full_name} role={profile.role} size={96} />
          <Text style={styles.name}>{profile.full_name}</Text>
          {profile.role && <Text style={styles.role}>{ROLE_LABELS[profile.role]}</Text>}
          {profile.city && <Text style={styles.location}>{profile.city}</Text>}
          {profile.is_open_to_work && <Text style={styles.openBadge}>Open to work</Text>}
        </View>

        {!isMe && (
          <View style={styles.actions}>
            <Button
              title={connectLabel}
              variant={connState.status === 'accepted' ? 'secondary' : 'primary'}
              onPress={connect}
              loading={busy}
              style={styles.actionBtn}
            />
            <Button title="Message" variant="secondary" onPress={message} style={styles.actionBtn} />
          </View>
        )}
        {!isMe && (
          <View style={styles.followWrap}>
            <Pressable onPress={follow}>
              <Text style={styles.followText}>{following ? 'Following ✓' : '+ Follow'}</Text>
            </Pressable>
          </View>
        )}

        {profile.bio ? (
          <Card>
            <Text style={styles.bio}>{profile.bio}</Text>
          </Card>
        ) : null}

        {profile.skills?.length ? (
          <View>
            <SectionHeader title="Skills" />
            <View style={styles.chips}>
              {profile.skills.map((s) => (
                <View key={s} style={styles.chip}>
                  <Text style={styles.chipText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {profile.role === 'investor' && (
          <View>
            <SectionHeader title="Investor Profile" />
            <Card>
              {profile.investor_interests?.length ? <Text style={styles.infoLine}>Interests: {profile.investor_interests.join(', ')}</Text> : null}
              {profile.investment_range_min != null && (
                <Text style={styles.infoLine}>
                  Range: ${profile.investment_range_min}K - ${profile.investment_range_max ?? '∞'}K
                </Text>
              )}
              {profile.investment_stage?.length ? <Text style={styles.infoLine}>Stages: {profile.investment_stage.join(', ')}</Text> : null}
            </Card>
          </View>
        )}

        <View style={styles.experience}>
          {profile.experience_years != null && <Text style={styles.infoLine}>Experience: {profile.experience_years} years</Text>}
          {profile.connections_count != null && <Text style={styles.infoLine}>Connections: {profile.connections_count}</Text>}
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
  openBadge: { marginTop: spacing.sm, backgroundColor: colors.success, color: '#fff', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full, overflow: 'hidden', fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
  followWrap: { alignItems: 'center', marginTop: spacing.sm },
  followText: { color: colors.primary, fontWeight: '700' },
  bio: { ...typography.body, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipText: { ...typography.caption, color: colors.primaryDark, fontWeight: '600' },
  infoLine: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  experience: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
})
