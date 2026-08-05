import React, { useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen, Avatar, Field, Header, EmptyState } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { searchUsers, startChat } from '@/lib/chat'
import { colors, spacing, typography } from '@/theme'
import type { Profile } from '@/types'

export default function NewMessage() {
  const { session } = useAuth()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])

  const search = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    try {
      setResults(await searchUsers(q, session?.user.id ?? '', 20))
    } catch {
      setResults([])
    }
  }

  const openChat = async (userId: string) => {
    try {
      const chat = await startChat(userId)
      router.replace(`/chat/${chat.id}`)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not start chat')
    }
  }

  return (
    <Screen>
      <Header title="New Message" />
      <View style={styles.searchWrap}>
        <Field label="" value={query} onChangeText={search} placeholder="Search members..." autoCapitalize="none" />
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          query.trim().length < 2 ? (
            <EmptyState icon="🔍" title="Search people" subtitle="Type at least 2 characters" />
          ) : (
            <EmptyState icon="👤" title="No results" />
          )
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openChat(item.id)}>
            <Avatar uri={item.avatar_url} name={item.full_name} role={item.role} size={48} />
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.full_name}</Text>
              {item.city ? <Text style={styles.meta}>{item.city}</Text> : null}
            </View>
            <Text style={styles.chat}>Chat</Text>
          </Pressable>
        )}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  searchWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  rowBody: { flex: 1 },
  name: { ...typography.subheading },
  meta: { ...typography.caption, color: colors.textSecondary },
  chat: { color: colors.primary, fontWeight: '700' },
})
