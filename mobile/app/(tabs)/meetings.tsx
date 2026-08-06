import React, { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Button, Field, Avatar, Chip, EmptyState, Loading, Header } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { listMeetings, createMeeting, updateMeeting, toLocalDateInput } from '@/lib/meetings'
import { searchUsers } from '@/lib/chat'
import { formatDateTime, nextFutureSlot } from '@/lib/utils'
import { colors, radius, spacing, typography } from '@/theme'
import type { Meeting } from '@/types/meetings'
import type { Profile } from '@/types'

export default function Meetings() {
  const { session } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<'upcoming' | 'past'>('upcoming')
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { meetings: data } = await listMeetings(status)
      setMeetings(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const respond = async (id: string, s: 'accepted' | 'declined' | 'cancelled') => {
    try {
      await updateMeeting(id, { status: s })
      await load()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong')
    }
  }

  const create = async (payload: { title: string; scheduled_at: string; duration_minutes: number; participant_id: string | null; description?: string }) => {
    try {
      await createMeeting(payload)
      setShowCreate(false)
      await load()
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create meeting')
    }
  }

  return (
    <Screen>
      <Header title="Meetings" showBack={false} right={
        <Pressable onPress={() => setShowCreate(true)} hitSlop={8}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </Pressable>
      } />

      <View style={styles.tabs}>
        <Chip label="Upcoming" active={status === 'upcoming'} onPress={() => setStatus('upcoming')} />
        <Chip label="Past" active={status === 'past'} onPress={() => setStatus('past')} />
      </View>

      {loading && meetings.length === 0 ? (
        <Loading />
      ) : (
        <FlatList
          data={meetings}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="📅" title="No meetings" subtitle="Schedule a meeting to collaborate" />}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => {
            const other = item.organizer_id === session?.user.id ? item.participant : item.organizer
            const isOrganizer = item.organizer_id === session?.user.id
            return (
              <Pressable style={styles.card} onPress={() => router.push(`/meeting/${item.id}`)}>
                <View style={styles.cardRow}>
                  <Avatar uri={other?.avatar_url} name={other?.full_name} role={other?.role as never} size={40} />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardMeta}>
                      {isOrganizer ? 'Organizer · ' : ''}
                      {item.scheduled_at ? formatDateTime(item.scheduled_at) : 'No time set'}
                      {item.duration_minutes ? ` · ${item.duration_minutes}m` : ''}
                    </Text>
                    {item.description ? <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text> : null}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  {item.status === 'pending' && !isOrganizer ? (
                    <>
                      <Button title="Accept" onPress={() => respond(item.id, 'accepted')} style={styles.smallBtn} />
                      <Button title="Decline" variant="outline" onPress={() => respond(item.id, 'declined')} style={styles.smallBtn} />
                    </>
                  ) : isOrganizer && item.status === 'pending' ? (
                    <Button title="Cancel" variant="outline" onPress={() => respond(item.id, 'cancelled')} style={styles.smallBtn} />
                  ) : (
                    <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                  )}
                  {item.meeting_link || item.meet_link ? (
                    <Button title="Join" variant="secondary" onPress={() => Alert.alert('Join', (item.meeting_link || item.meet_link)!)} style={styles.smallBtn} />
                  ) : null}
                </View>
              </Pressable>
            )
          }}
        />
      )}

      <CreateMeetingModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={create}
        currentUserId={session?.user.id ?? ''}
      />
    </Screen>
  )
}

function CreateMeetingModal({
  visible,
  onClose,
  onCreate,
  currentUserId,
}: {
  visible: boolean
  onClose: () => void
  onCreate: (p: { title: string; scheduled_at: string; duration_minutes: number; participant_id: string | null; description?: string }) => void
  currentUserId: string
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(toLocalDateInput(nextFutureSlot()))
  const [time, setTime] = useState('12:00')
  const [duration, setDuration] = useState('30')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [selected, setSelected] = useState<Profile | null>(null)

  const search = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    const data = await searchUsers(q, currentUserId, 6)
    setResults(data.filter((p) => p.id !== selected?.id))
  }

  const submit = () => {
    if (!title.trim()) {
      Alert.alert('Title required')
      return
    }
    const scheduledAt = new Date(`${date}T${time}`)
    if (isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
      Alert.alert('Invalid time', 'Pick a future date and time')
      return
    }
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: parseInt(duration, 10) || 30,
      participant_id: selected?.id ?? null,
    })
    setTitle('')
    setDescription('')
    setSelected(null)
    setResults([])
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <Header title="New Meeting" right={<Button title="Close" variant="ghost" onPress={onClose} />} />
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Pitch review" />
          <Field label="Description" value={description} onChangeText={setDescription} placeholder="Agenda..." multiline numberOfLines={3} />

          <View style={styles.row}>
            <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-08-10" style={styles.halfField} />
            <Field label="Time (HH:MM)" value={time} onChangeText={setTime} placeholder="14:00" style={styles.halfField} />
          </View>

          <View style={styles.row}>
            <Field label="Duration (min)" value={duration} onChangeText={setDuration} keyboardType="number-pad" style={styles.halfField} />
            <View style={styles.halfField} />
          </View>

          <Text style={styles.sectionLabel}>Invite someone (optional)</Text>
          <Field label="Search members" value={query} onChangeText={search} placeholder="Name or username" autoCapitalize="none" />

          {selected && (
            <View style={styles.selectedRow}>
              <Avatar uri={selected.avatar_url} name={selected.full_name} role={selected.role} size={32} />
              <Text style={styles.selectedName}>{selected.full_name}</Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.danger} />
              </Pressable>
            </View>
          )}

          {results.map((p) => (
            <Pressable key={p.id} style={styles.resultRow} onPress={() => setSelected(p)}>
              <Avatar uri={p.avatar_url} name={p.full_name} role={p.role} size={36} />
              <Text style={styles.resultName}>{p.full_name}</Text>
            </Pressable>
          ))}

          <Button title="Create Meeting" onPress={submit} style={styles.submit} />
        </ScrollView>
      </Screen>
    </Modal>
  )
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, marginVertical: spacing.sm },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardBody: { flex: 1, marginLeft: spacing.md },
  cardTitle: { ...typography.subheading },
  cardMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  cardDesc: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  smallBtn: { flex: 1, minHeight: 36, paddingVertical: spacing.sm },
  statusText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  modalBody: { padding: spacing.lg, paddingBottom: 60 },
  row: { flexDirection: 'row', gap: spacing.md },
  halfField: { flex: 1 },
  sectionLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs },
  selectedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primaryLight, padding: spacing.md, borderRadius: radius.md, gap: spacing.sm },
  selectedName: { ...typography.body, fontWeight: '600', flex: 1 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  resultName: { ...typography.body },
  submit: { marginTop: spacing.xl },
})
