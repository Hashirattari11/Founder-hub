import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen, Avatar, Header, Loading, EmptyState, SectionHeader, Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { acceptConnectionRequest, rejectConnectionRequest } from '@/lib/connections'
import { colors, radius, spacing, typography } from '@/theme'
import type { Profile } from '@/types'

export default function Network() {
  const { session } = useAuth()
  const router = useRouter()
  const [requests, setRequests] = useState<Profile[]>([])
  const [connections, setConnections] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const me = session?.user.id

  const load = useCallback(async () => {
    if (!me) return
    setLoading(true)
    try {
      const { data: reqData } = await supabase
        .from('connections')
        .select('requester_id, profiles!connections_requester_id_fkey(id, full_name, avatar_url, role, city, username)')
        .eq('receiver_id', me)
        .eq('status', 'pending')
      setRequests(
        (reqData ?? []).map((r) => (r.profiles as unknown as Profile[])?.[0]).filter(Boolean) as Profile[],
      )

      const { data: connData } = await supabase
        .from('connections')
        .select(
          'requester_id, receiver_id, requester:profiles!connections_requester_id_fkey(id, full_name, avatar_url, role, city), receiver:profiles!connections_receiver_id_fkey(id, full_name, avatar_url, role, city)',
        )
        .eq('status', 'accepted')
        .or(`requester_id.eq.${me},receiver_id.eq.${me}`)
      const list: Profile[] = []
      const rows = (connData ?? []) as unknown as Array<{ requester_id: string; requester: Profile[]; receiver: Profile[] }>
      for (const row of rows) {
        const p = (row.requester_id === me ? row.receiver : row.requester)?.[0] as Profile | undefined
        if (p && p.id !== me) list.push(p)
      }
      setConnections(list)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [me])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const accept = async (userId: string) => {
    await acceptConnectionRequest(me!, userId)
    setRequests((prev) => prev.filter((p) => p.id !== userId))
    await load()
  }

  const reject = async (userId: string) => {
    await rejectConnectionRequest(me!, userId)
    setRequests((prev) => prev.filter((p) => p.id !== userId))
  }

  return (
    <Screen>
      <Header title="Network" />
      {loading && requests.length === 0 && connections.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={connections}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <>
              {requests.length > 0 && (
                <View>
                  <SectionHeader title={`Connection Requests (${requests.length})`} />
                  {requests.map((p) => (
                    <View key={p.id} style={styles.card}>
                      <Pressable style={styles.rowBody} onPress={() => router.push(`/user/${p.id}`)}>
                        <Avatar uri={p.avatar_url} name={p.full_name} role={p.role} size={44} />
                        <View style={{ flex: 1, marginLeft: spacing.md }}>
                          <Text style={styles.name}>{p.full_name}</Text>
                          {p.city ? <Text style={styles.meta}>{p.city}</Text> : null}
                        </View>
                      </Pressable>
                      <View style={styles.reqActions}>
                        <Button title="Accept" style={styles.smallBtn} onPress={() => accept(p.id)} />
                        <Button title="Reject" variant="outline" style={styles.smallBtn} onPress={() => reject(p.id)} />
                      </View>
                    </View>
                  ))}
                  <SectionHeader title={`Connections (${connections.length})`} />
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            requests.length === 0 ? (
              <EmptyState icon="🕸️" title="No connections yet" subtitle="Connect with people from Community" />
            ) : (
              <EmptyState icon="🕸️" title="No connections yet" subtitle="Connect with people from Community" />
            )
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/user/${item.id}`)}>
              <View style={styles.card}>
                <Avatar uri={item.avatar_url} name={item.full_name} role={item.role} size={44} />
                <View style={styles.rowBody}>
                  <Text style={styles.name}>{item.full_name}</Text>
                  {item.city ? <Text style={styles.meta}>{item.city}</Text> : null}
                </View>
              </View>
            </Pressable>
          )}
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
  },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  name: { ...typography.subheading },
  meta: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  reqActions: { flexDirection: 'row', gap: spacing.sm },
  smallBtn: { minHeight: 34, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
})
