import React, { useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import { Screen, Button, Field, Header, Chip } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { createPost, POST_TYPES } from '@/lib/feed'
import { POST_MEDIA_BUCKET } from '@/lib/config'
import { uriToBlob } from '@/lib/assets'
import { colors, radius, spacing, typography } from '@/theme'
import type { PostType } from '@/types'

export default function CreatePost() {
  const { session } = useAuth()
  const router = useRouter()
  const [content, setContent] = useState('')
  const [postType, setPostType] = useState<PostType>('update')
  const [image, setImage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 })
    if (!result.canceled) setImage(result.assets[0].uri)
  }

  const submit = async () => {
    if (!content.trim() && !image) {
      Alert.alert('Empty post', 'Write something or add an image')
      return
    }
    if (!session?.user.id) return
    setSubmitting(true)
    try {
      const mediaUrls: string[] = []
      if (image) {
        const blob = await uriToBlob(image)
        const path = `${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error } = await supabase.storage.from(POST_MEDIA_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
        if (error) throw error
        const { data } = supabase.storage.from(POST_MEDIA_BUCKET).getPublicUrl(path)
        mediaUrls.push(data.publicUrl)
      }
      await createPost({ authorId: session.user.id, content: content.trim(), postType, mediaUrls })
      router.back()
    } catch (e) {
      Alert.alert('Failed to post', e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <Header title="Create Post" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Post type</Text>
          <View style={styles.chips}>
            {POST_TYPES.map((t) => (
              <Chip key={t.id} label={t.label} active={postType === t.id} onPress={() => setPostType(t.id!)} />
            ))}
          </View>

          <Field
            label="What's on your mind?"
            value={content}
            onChangeText={setContent}
            placeholder="Share an update with the community..."
            multiline
            numberOfLines={6}
          />

          {image ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
              <Pressable onPress={() => setImage(null)} style={styles.remove} hitSlop={8}>
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.pickBtn} onPress={pickImage}>
              <Ionicons name="image-outline" size={22} color={colors.primary} />
              <Text style={styles.pickText}>Add image</Text>
            </Pressable>
          )}

          <Button title={submitting ? 'Posting...' : 'Post'} onPress={submit} loading={submitting} style={styles.submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: 60 },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg },
  imageWrap: { position: 'relative', marginTop: spacing.sm },
  image: { width: '100%', height: 220, borderRadius: radius.lg },
  remove: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  pickText: { color: colors.primary, fontWeight: '600' },
  submit: { marginTop: spacing.xl },
})
