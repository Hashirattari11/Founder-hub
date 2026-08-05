import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import {
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayerStatus,
  RecordingPresets,
  AudioModule,
  setAudioModeAsync,
} from 'expo-audio'
import { Screen, Avatar, Header } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import {
  getChatMessages,
  getOtherUser,
  markMessagesRead,
  sendChatMessage,
  subscribeToChatMessages,
  subscribeToTyping,
  uploadChatAttachment,
  uploadVoiceNote,
  emitTyping,
  stopTyping,
  CHAT_PROFILE_FIELDS,
} from '@/lib/chat'
import { supabase } from '@/lib/supabase'
import { colors, radius, spacing, typography } from '@/theme'
import type { ChatMessage } from '@/types'

function VoiceMessage({ message }: { message: ChatMessage }) {
  const [playing, setPlaying] = useState(false)
  const player = useAudioPlayer(message.file_url ?? '')
  const status = useAudioPlayerStatus(player)

  const toggle = () => {
    if (status.playing) {
      player.pause()
    } else {
      if (status.didJustFinish || player.currentTime >= (player.duration ?? 0)) {
        player.seekTo(0)
      }
      player.play()
    }
  }

  useEffect(() => {
    return () => {
      player.remove()
    }
  }, [player])

  const duration = Math.round((player.duration ?? 0) * 10) / 10

  return (
    <Pressable onPress={toggle} style={styles.voiceBubble}>
      <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color="#fff" />
      <Text style={styles.voiceTime}>{isFinite(duration) ? `${duration}s` : ''}</Text>
    </Pressable>
  )
}

export default function ChatWindow() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>()
  const { session, profile } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [otherUser, setOtherUser] = useState<ReturnType<typeof getOtherUser>>(null)
  const [otherTyping, setOtherTyping] = useState(false)
  const listRef = useRef<FlatList>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(recorder)
  const [recording, setRecording] = useState(false)
  const [sendingVoice, setSendingVoice] = useState(false)

  const userId = session?.user.id

  const load = useCallback(async () => {
    if (!chatId) return
    const messages = await getChatMessages(chatId)
    setMessages(messages)
    const { data: chat } = await supabase
      .from('chats')
      .select(`*, participant_1_profile:profiles!chats_participant_1_fkey(${CHAT_PROFILE_FIELDS}), participant_2_profile:profiles!chats_participant_2_fkey(${CHAT_PROFILE_FIELDS})`)
      .eq('id', chatId)
      .maybeSingle()
    if (chat) {
      setOtherUser(getOtherUser(chat as never, userId!))
      markMessagesRead(chatId, userId!).catch(() => {})
    }
  }, [chatId, userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!chatId || !userId) return
    const unsubMessages = subscribeToChatMessages(chatId, userId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    })
    const unsubTyping = subscribeToTyping(chatId, userId, (typing) => setOtherTyping(typing))
    return () => {
      unsubMessages()
      unsubTyping()
    }
  }, [chatId, userId])

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true })
  }, [messages.length])

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current)
    }
  }, [])

  const handleTyping = (text: string) => {
    setInput(text)
    if (!chatId || !userId) return
    emitTyping(chatId, userId).catch(() => {})
  }

  const send = async () => {
    const text = input.trim()
    if (!text || !chatId || !userId) return
    setInput('')
    try {
      await sendChatMessage({ chatId, senderId: userId, content: text })
      stopTyping(chatId, userId).catch(() => {})
    } catch (e) {
      Alert.alert('Failed to send', e instanceof Error ? e.message : 'Error')
    }
  }

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 })
    if (result.canceled || !chatId || !userId) return
    const asset = result.assets[0]
    const fileName = asset.fileName ?? `photo-${Date.now()}.jpg`
    try {
      const { url, size } = await uploadChatAttachment(userId, asset.uri, fileName)
      await sendChatMessage({ chatId, senderId: userId, content: '📷 Photo', type: 'image', fileUrl: url, fileName, fileSize: size })
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Error')
    }
  }

  const startRecording = async () => {
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      const perm = await AudioModule.requestRecordingPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('Permission denied', 'Microphone access is required for voice messages')
        return
      }
      await recorder.prepareToRecordAsync()
      recorder.record()
      setRecording(true)
    } catch {
      Alert.alert('Error', 'Could not start recording')
    }
  }

  const stopRecording = async () => {
    if (!recording) return
    try {
      await recorder.stop()
      setRecording(false)
      const uri = recorder.uri
      if (!uri) return
      setSendingVoice(true)
      const response = await fetch(uri)
      const blob = await response.blob()
      const { url, size } = await uploadVoiceNote(userId!, blob, 'm4a')
      await sendChatMessage({ chatId: chatId!, senderId: userId!, content: '🎤 Voice message', type: 'voice', fileUrl: url, fileSize: size })
    } catch (e) {
      Alert.alert('Failed to send voice note', e instanceof Error ? e.message : 'Error')
    } finally {
      setSendingVoice(false)
    }
  }

  const renderBubble = ({ item }: { item: ChatMessage }) => {
    const mine = item.sender_id === userId
    const showSender = !mine
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : null]}>
        {showSender && <Avatar uri={item.sender?.avatar_url} name={item.sender?.full_name} size={28} />}
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
          {item.reply_to && <Text style={styles.replyLabel}>↩ {item.reply_to.content ?? 'Attachment'}</Text>}
          {item.type === 'image' && item.file_url ? (
            <Image source={{ uri: item.file_url }} style={styles.imageMsg} resizeMode="cover" />
          ) : null}
          {item.type === 'voice' && item.file_url ? <VoiceMessage message={item} /> : null}
          {item.content ? <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : null]}>{item.content}</Text> : null}
          <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : null]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <Screen>
      <Header title={otherUser?.full_name ?? 'Chat'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderBubble}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={otherTyping ? <Text style={styles.typing}>typing...</Text> : null}
        />

        <View style={styles.inputBar}>
          <Pressable onPress={pickImage} hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="image-outline" size={24} color={colors.primary} />
          </Pressable>

          {recording ? (
            <Pressable style={styles.recBtn} onPress={stopRecording}>
              <Ionicons name="stop" size={20} color="#fff" />
              <Text style={styles.recText}>Recording {Math.round(recorderState.durationMillis / 1000)}s</Text>
            </Pressable>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={handleTyping}
                placeholder="Message..."
                placeholderTextColor={colors.textMuted}
                multiline
              />
              <Pressable onPress={startRecording} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="mic-outline" size={24} color={colors.primary} />
              </Pressable>
              {input.trim() ? (
                <Pressable onPress={send} hitSlop={8} style={styles.sendBtn}>
                  {sendingVoice ? <Ionicons name="sync" size={20} color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, paddingBottom: 20 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4, gap: spacing.sm },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', borderRadius: radius.lg, padding: spacing.md, paddingBottom: spacing.sm },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { ...typography.small, color: colors.textMuted, marginTop: 2, alignSelf: 'flex-end' },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  imageMsg: { width: 180, height: 180, borderRadius: radius.md },
  replyLabel: { ...typography.small, color: colors.textSecondary, marginBottom: 4, fontStyle: 'italic' },
  voiceBubble: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  voiceTime: { ...typography.caption, color: '#fff', fontWeight: '600' },
  typing: { ...typography.small, color: colors.textMuted, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  iconBtn: { padding: spacing.sm },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  recText: { color: '#fff', fontWeight: '700' },
})
