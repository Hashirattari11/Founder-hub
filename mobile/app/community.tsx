import React, { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen, Avatar, Header, Field, Loading, EmptyState } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { searchUsers } from '@/lib/chat'
import { getSuggestedPeople } from '@/lib/feed'
import { getConnectionState, sendConnectionRequest, acceptConnectionRequest } from '@/lib/connections'
import { getFollowState, toggleFollow } from '@/lib/follows'
import { colors, radius, spacing, typography } from '@/theme'
import type { Profile } from '@/types'

export default function Community() {
  const { session } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [states, setStates] = useState<Record<string, { conn: string; following: boolean }>>({})

  const me = session?.user.id

  const load = useCallback(async () => {
    if (!me) return
    setLoading(true)
    try {
      const list = await getSuggestedPeople(me)
      setPeople(list)
      const s: Record<string, { conn: string; following: boolean }> = {}
      for (const p of list) {
        const conn = await getConnectionState(me, p.id)
        s[p.id] = { conn: conn.status, following: await getFollowState(me, p.id, 'user') }
      }
      setStates(s)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [me])

  useEffect(() => {
    load()
  }, [load])

  const search = async (q: string) => {
    setQuery(q)
    if (!me) return
    if (q.trim().length < 2) {
      await load()
      return
    }
    setLoading(true)
    try {
      setPeople(await searchUsers(q, me, 30))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const connect = async (userId: string) => {
    if (!me) return
    const s = states[userId]
    if (s?.conn === 'none') {
      await sendConnectionRequest(me, userId)
      setStates((prev) => ({ ...prev, [userId]: { ...s, conn: 'pending' } }))
    } else if (s?.conn === 'requested') {
      await acceptConnectionRequest(me, userId)
      setStates((prev) => ({ ...prev, [userId]: { ...s, conn: 'accepted' } }))
    }
  }

  const follow = async (userId: string) => {
    if (!me) return
    const s = states[userId]
    setStates((prev) => ({ ...prev, [userId]: { ...s, following: !s?.following } }))
    try {
      await toggleFollow(me, userId, 'user')
    } catch {
      setStates((prev) => ({ ...prev, [userId]: { ...s, following: !s?.following } }))
    }
  }

  const actionLabel = (userId: string) => {
    const s = states[userId]
    if (!s) return 'Connect'
    if (s.conn === 'accepted') return 'Connected'
    if (s.conn === 'pending') return 'Requested'
    if (s.conn === 'requested') return 'Accept'
    return 'Connect'
  }

  return (
    <Screen>
      <Header title="Community" />
      <View style={styles.search}>
        <Field label="" value={query} onChangeText={search} placeholder="Find people by name or skills..." autoCapitalize="none" />
      </View>
      {loading && people.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<EmptyState icon="👥" title="No people found" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const s = states[item.id]
            return (
              <Pressable onPress={() => router.push(`/user/${item.id}`)}>
                <View style={styles.card}>
                  <Avatar uri={item.avatar_url} name={item.full_name} role={item.role} size={48} />
                  <View style={styles.body}>
                    <Text style={styles.name}>{item.full_name}</Text>
                    {item.skills?.length ? <Text style={styles.meta} numberOfLines={1}>{item.skills.slice(0, 3).join(', ')}</Text> : null}
                    {item.city ? <Text style={styles.meta}>{item.city}</Text> : null}
                  </View>
                  <View style={styles.actions}>
                    <Pressable onPress={() => follow(item.id)} hitSlop={6}>
                      <Text style={styles.follow}>{s?.following ? 'Following' : 'Follow'}</Text>
                    </Pressable>
                    {item.id !== me && (
                      <Pressable onPress={() => connect(item.id)} hitSlop={6}>
                        <Text style={styles.connect}>{actionLabel(item.id)}</Text>
                      </Pressable>
                    )}
                  </View>
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
  search: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
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
  actions: { alignItems: 'flex-end', gap: spacing.xs },
  follow: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  connect: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
})
