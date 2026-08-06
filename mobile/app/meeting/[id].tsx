import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Button, Card, Loading, SectionHeader, Avatar, Header } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getMeeting, endMeeting, generateMeetingSummary, updateActionItem, createActionItem, deleteMeeting } from '@/lib/meetings'
import { formatDateTime } from '@/lib/utils'
import { colors, radius, spacing, typography } from '@/theme'
import type { Meeting, MeetingActionItem } from '@/types/meetings'

export default function MeetingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAuth()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [recordingUrl, setRecordingUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newItem, setNewItem] = useState('')

  const isOrganizer = meeting?.organizer_id === session?.user.id

  const load = useCallback(async () => {
    if (!id) return
    try {
      const { meeting: m } = await getMeeting(id)
      setMeeting(m)
      setTranscript(m.transcript ?? '')
      setRecordingUrl(m.recording_url ?? '')
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not load meeting')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const summary = useMemo(() => {
    const raw = (meeting?.ai_summary as { raw?: string } | null)?.raw ?? ''
    const sections: { title: string; body: string[] }[] = []
    let current: { title: string; body: string[] } | null = null
    for (const line of raw.split('\n')) {
      const m = line.match(/^#{1,3}\s+(.*)$/)
      if (m) {
        current = { title: m[1].trim(), body: [] }
        sections.push(current)
      } else if (current) {
        current.body.push(line)
      }
    }
    return sections.filter((s) => s.body.some((b) => b.trim()))
  }, [meeting])

  const end = async () => {
    if (!meeting) return
    setGenerating(true)
    try {
      const { meeting: m } = await endMeeting(meeting.id, { transcript, recording_url: recordingUrl || null })
      setMeeting(m)
      Alert.alert('Done', 'Meeting marked as completed')
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not end meeting')
    } finally {
      setGenerating(false)
    }
  }

  const generate = async () => {
    if (!meeting) return
    if (!transcript.trim()) {
      Alert.alert('Transcript required', 'Add a transcript first')
      return
    }
    setGenerating(true)
    try {
      const result = await generateMeetingSummary({ meeting_id: meeting.id, transcript, recording_url: recordingUrl || null })
      setMeeting(result.meeting)
      Alert.alert('Done', 'AI summary generated')
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not generate summary')
    } finally {
      setGenerating(false)
    }
  }

  const toggleItem = async (item: MeetingActionItem) => {
    try {
      const { action_item } = await updateActionItem(item.id, {
        status: item.status === 'completed' ? 'pending' : 'completed',
      })
      setMeeting((m) =>
        m
          ? { ...m, action_items: (m.action_items ?? []).map((a) => (a.id === item.id ? { ...a, ...action_item } : a)) }
          : m,
      )
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update item')
    }
  }

  const addItem = async () => {
    if (!meeting || !newItem.trim()) return
    try {
      const { action_item } = await createActionItem({ meeting_id: meeting.id, description: newItem.trim() })
      setMeeting((m) => (m ? { ...m, action_items: [...(m.action_items ?? []), action_item] } : m))
      setNewItem('')
      setShowAdd(false)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not add item')
    }
  }

  const buildFollowUp = () => {
    if (!meeting) return ''
    const items = (meeting.action_items ?? [])
      .filter((a) => a.status !== 'completed')
      .map((a, i) => `${i + 1}. ${a.description}`)
      .join('\n')
    return [
      `Follow-up: ${meeting.title}`,
      '',
      summary.map((s) => `${s.title}\n${s.body.join('\n')}`).join('\n\n'),
      items ? `\nAction items:\n${items}` : '',
    ].join('\n')
  }

  const shareFollowUp = (channel: 'email' | 'whatsapp') => {
    const body = buildFollowUp()
    if (channel === 'whatsapp') {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(body)}`)
      return
    }
    const subject = encodeURIComponent(`Follow-up: ${meeting?.title ?? 'Meeting'}`)
    Linking.openURL(`mailto:?subject=${subject}&body=${encodeURIComponent(body)}`)
  }

  if (loading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    )
  }

  if (!meeting) {
    return (
      <Screen>
        <Header title="Meeting" />
        <EmptyStateWrapper />
      </Screen>
    )
  }

  return (
    <Screen>
      <Header title="Meeting" right={
        <Pressable onPress={() => shareFollowUp('email')} hitSlop={8}>
          <Ionicons name="mail-outline" size={24} color={colors.primary} />
        </Pressable>
      } />
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card>
          <Text style={styles.title}>{meeting.title}</Text>
          <Text style={styles.meta}>
            {meeting.scheduled_at ? formatDateTime(meeting.scheduled_at) : 'No time set'}
            {meeting.duration_minutes ? ` · ${meeting.duration_minutes}m` : ''}
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{meeting.status.toUpperCase()}</Text>
            </View>
            {meeting.recording_url ? (
              <Pressable onPress={() => Linking.openURL(meeting.recording_url!)}>
                <Text style={styles.link}>View recording</Text>
              </Pressable>
            ) : null}
          </View>
          {meeting.description ? <Text style={styles.desc}>{meeting.description}</Text> : null}
          {(meeting.meet_link || meeting.meeting_link) ? (
            <Button
              title="Join meeting"
              variant="primary"
              onPress={() => Linking.openURL(meeting.meet_link || meeting.meeting_link!)}
              style={styles.mt}
            />
          ) : null}
          <Button title="Send WhatsApp follow-up" variant="outline" onPress={() => shareFollowUp('whatsapp')} style={styles.mt} />
        </Card>

        <SectionHeader title="Transcript & recording" />
        <Card>
          <TextInput
            style={styles.input}
            multiline
            value={transcript}
            onChangeText={setTranscript}
            placeholder="Paste the transcript here…"
          />
          <TextInput
            style={styles.input}
            value={recordingUrl}
            onChangeText={setRecordingUrl}
            placeholder="Recording URL (optional)"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            title={generating ? 'Working…' : 'Generate AI summary'}
            onPress={generate}
            loading={generating}
            disabled={!transcript.trim()}
            style={styles.mt}
          />
          {meeting.status !== 'completed' && (
            <Button title="End meeting" variant="outline" onPress={end} style={styles.mt} />
          )}
        </Card>

        {summary.length > 0 && (
          <>
            <SectionHeader title="AI Summary" />
            <Card>
              {summary.map((s) => (
                <View key={s.title} style={styles.section}>
                  <Text style={styles.sectionTitle}>{s.title}</Text>
                  {s.body.map((line, i) =>
                    line.trim() === '' ? null : (
                      <Text key={i} style={styles.sectionBody}>
                        {line.trim().startsWith('-') ? `• ${line.trim().slice(1).trim()}` : line}
                      </Text>
                    ),
                  )}
                </View>
              ))}
            </Card>
          </>
        )}

        <SectionHeader title="Action items" />
        <Card>
          {(meeting.action_items ?? []).length === 0 ? (
            <Text style={styles.empty}>No action items yet. Generate a summary to extract them.</Text>
          ) : (
            (meeting.action_items ?? []).map((item) => (
              <Pressable key={item.id} style={styles.itemRow} onPress={() => toggleItem(item)}>
                <Ionicons
                  name={item.status === 'completed' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={item.status === 'completed' ? colors.success : colors.textMuted}
                />
                <View style={styles.itemBody}>
                  <Text
                    style={[
                      styles.itemText,
                      item.status === 'completed' && { textDecorationLine: 'line-through', color: colors.textMuted },
                    ]}
                  >
                    {item.description}
                  </Text>
                  {item.due_date ? (
                    <Text style={styles.itemMeta}>
                      {item.assignee?.full_name ? `${item.assignee.full_name} · ` : ''}Due {formatDateTime(item.due_date)}
                    </Text>
                  ) : item.assignee?.full_name ? (
                    <Text style={styles.itemMeta}>{item.assignee.full_name}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
          <Button title="Add action item" variant="outline" onPress={() => setShowAdd(true)} style={styles.mt} />
        </Card>

        {isOrganizer ? (
          <Button
            title="Delete meeting"
            variant="ghost"
            onPress={() => {
              Alert.alert('Delete meeting?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await deleteMeeting(meeting.id)
                      router.back()
                    } catch (e) {
                      Alert.alert('Error', e instanceof Error ? e.message : 'Could not delete')
                    }
                  },
                },
              ])
            }}
            style={styles.delete}
          />
        ) : null}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" onRequestClose={() => setShowAdd(false)} transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAdd(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>New action item</Text>
            <TextInput
              style={styles.input}
              multiline
              autoFocus
              value={newItem}
              onChangeText={setNewItem}
              placeholder="What needs to be done?"
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowAdd(false)} style={styles.modalBtn} />
              <Button title="Add" onPress={addItem} disabled={!newItem.trim()} style={styles.modalBtn} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  )
}

function EmptyStateWrapper() {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
      <Text style={styles.emptyText}>Meeting not found</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: 60 },
  title: { ...typography.heading },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  statusPill: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  statusText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  link: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  desc: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  mt: { marginTop: spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.text,
    minHeight: 48,
  },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.subheading, color: colors.primary, marginBottom: 4 },
  sectionBody: { ...typography.body, color: colors.textSecondary, marginTop: 2 },
  empty: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted },
  itemRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemBody: { flex: 1 },
  itemText: { ...typography.body },
  itemMeta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  delete: { marginTop: spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl },
  modalTitle: { ...typography.heading, marginBottom: spacing.md },
  modalActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  modalBtn: { flex: 1 },
})
