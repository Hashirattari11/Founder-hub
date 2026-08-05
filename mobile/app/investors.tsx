import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen, Avatar, Header, Loading, EmptyState, Button, SectionHeader } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getConnectionState, sendConnectionRequest, type ConnectionState } from '@/lib/connections'
import { getRecommendedStartups } from '@/lib/startups'
import { colors, radius, spacing, typography } from '@/theme'
import type { Profile, Startup } from '@/types'

export default function Investors() {
  const { session, profile } = useAuth()
  const router = useRouter()
  const [investors, setInvestors] = useState<Profile[]>([])
  const [connStates, setConnStates] = useState<Record<string, ConnectionState>>({})
  const [recommended, setRecommended] = useState<Startup[]>([])
  const [loading, setLoading] = useState(true)

  const me = session?.user.id

  const load = useCallback(async () => {
    if (!me) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'investor')
        .neq('id', me)
        .limit(50)
      const list = (data ?? []) as Profile[]
      setInvestors(list)

      const states: Record<string, ConnectionState> = {}
      for (const p of list) {
        states[p.id] = await getConnectionState(me, p.id)
      }
      setConnStates(states)

      if (profile?.role === 'investor') {
        setRecommended(
          await getRecommendedStartups(
            {
              role: profile.role,
              skills: profile.skills ?? [],
              city: profile.city,
              experience_years: profile.experience_years,
            },
            5,
          ),
        )
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [me, profile])

  useEffect(() => {
    load()
  }, [load])

  const connect = async (userId: string) => {
    if (!me) return
    await sendConnectionRequest(me, userId)
    setConnStates((prev) => ({ ...prev, [userId]: { status: 'pending' } }))
  }

  return (
    <Screen>
      <Header title="Investors" />
      {loading && investors.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={investors}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            recommended.length ? (
              <View>
                <SectionHeader title="Recommended for you" />
                {recommended.map((s) => (
                  <Pressable key={s.id} onPress={() => router.push(`/startup/${s.id}`)}>
                    <View style={styles.recoCard}>
                      <Text style={styles.recoName}>{s.name}</Text>
                      {s.tagline ? <Text style={styles.recoTagline}>{s.tagline}</Text> : null}
                    </View>
                  </Pressable>
                ))}
                <SectionHeader title="All investors" />
              </View>
            ) : undefined
          }
          ListEmptyComponent={<EmptyState icon="📈" title="No investors found" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const state = connStates[item.id]?.status ?? 'none'
            return (
              <Pressable onPress={() => router.push(`/user/${item.id}`)}>
                <View style={styles.card}>
                  <Avatar uri={item.avatar_url} name={item.full_name} role="investor" size={48} />
                  <View style={styles.body}>
                    <Text style={styles.name}>{item.full_name}</Text>
                    {item.investor_interests?.length ? (
                      <Text style={styles.meta} numberOfLines={1}>Interests: {item.investor_interests.join(', ')}</Text>
                    ) : null}
                    {item.city ? <Text style={styles.meta}>{item.city}</Text> : null}
                  </View>
                  {state === 'none' ? (
                    <Button title="Connect" variant="secondary" style={styles.connectBtn} onPress={() => connect(item.id)} />
                  ) : state === 'accepted' ? (
                    <Text style={styles.connected}>Connected</Text>
                  ) : (
                    <Text style={styles.connected}>Requested</Text>
                  )}
                </View>
              </Pressable>
            )
          }}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.md,
  },
  body: { flex: 1 },
  name: { ...typography.subheading },
  meta: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  connectBtn: { minHeight: 36, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  connected: { ...typography.caption, color: colors.success, fontWeight: '700' },
  recoCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  recoName: { ...typography.subheading, color: colors.primaryDark },
  recoTagline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
})
