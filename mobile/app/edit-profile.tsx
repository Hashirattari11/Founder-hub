import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as ImagePicker from 'expo-image-picker'
import { Screen, Button, Field, Header, Chip, Avatar } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { updateProfile, saveAvatar } from '@/lib/profile'
import { colors, radius, spacing, typography } from '@/theme'
import { ROLE_OPTIONS, ROLE_SKILLS, SKILLS } from '@/types'

export default function EditProfile() {
  const { session, profile, refreshProfile } = useAuth()
  const router = useRouter()
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [country, setCountry] = useState(profile?.country ?? '')
  const [experience, setExperience] = useState(profile?.experience_years ? String(profile.experience_years) : '')
  const [linkedin, setLinkedin] = useState(profile?.linkedin_url ?? '')
  const [github, setGithub] = useState(profile?.github_url ?? '')
  const [portfolio, setPortfolio] = useState(profile?.portfolio_url ?? '')
  const [twitter, setTwitter] = useState(profile?.twitter_url ?? '')
  const [role, setRole] = useState(profile?.role)
  const [skills, setSkills] = useState<string[]>(profile?.skills ?? [])
  const [openToWork, setOpenToWork] = useState(profile?.is_open_to_work ?? false)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!session?.user.id) return null

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] })
    if (!result.canceled) setAvatar(result.assets[0].uri)
  }

  const suggestedSkills = role ? ROLE_SKILLS[role] ?? [] : SKILLS

  const toggleSkill = (s: string) => {
    setSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const save = async () => {
    const userId = session!.user.id
    setSaving(true)
    try {
      let avatarUrl = profile?.avatar_url ?? null
      if (avatar) {
        const res = await saveAvatar(userId, avatar, `avatar-${Date.now()}.jpg`)
        avatarUrl = res.avatarUrl
      }
      await updateProfile(userId, {
        full_name: fullName || null,
        username: username || null,
        bio: bio || null,
        city: city || null,
        country: country || null,
        experience_years: experience ? Number(experience) : null,
        linkedin_url: linkedin || null,
        github_url: github || null,
        portfolio_url: portfolio || null,
        twitter_url: twitter || null,
        role,
        skills,
        is_open_to_work: openToWork,
        avatar_url: avatarUrl,
      })
      await refreshProfile()
      router.back()
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen>
      <Header title="Edit Profile" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
            <Avatar uri={avatar ?? profile?.avatar_url} name={profile?.full_name} role={profile?.role} size={88} />
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Tap to change photo</Text>

          <Text style={styles.label}>Role</Text>
          <View style={styles.chips}>
            {ROLE_OPTIONS.map((r) => (
              <Chip key={r.value} label={r.label} active={role === r.value} onPress={() => setRole(r.value)} />
            ))}
          </View>

          <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Your name" />
          <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="@username" />
          <Field label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={4} placeholder="Tell people about you" />
          <Field label="City" value={city} onChangeText={setCity} placeholder="City" />
          <Field label="Country" value={country} onChangeText={setCountry} placeholder="Country" />
          <Field label="Experience (years)" value={experience} onChangeText={setExperience} keyboardType="numeric" placeholder="e.g. 5" />

          <Text style={styles.label}>Skills</Text>
          <View style={styles.chips}>
            {suggestedSkills.map((s) => (
              <Chip key={s} label={s} active={skills.includes(s)} onPress={() => toggleSkill(s)} />
            ))}
          </View>

          <Field label="LinkedIn" value={linkedin} onChangeText={setLinkedin} autoCapitalize="none" placeholder="https://linkedin.com/in/..." />
          <Field label="GitHub" value={github} onChangeText={setGithub} autoCapitalize="none" placeholder="https://github.com/..." />
          <Field label="Portfolio" value={portfolio} onChangeText={setPortfolio} autoCapitalize="none" placeholder="https://..." />
          <Field label="Twitter / X" value={twitter} onChangeText={setTwitter} autoCapitalize="none" placeholder="https://x.com/..." />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Open to work / collaboration</Text>
            <Switch value={openToWork} onValueChange={setOpenToWork} trackColor={{ true: colors.primary }} />
          </View>

          <Button title={saving ? 'Saving...' : 'Save Changes'} onPress={save} loading={saving} style={styles.submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: 60 },
  avatarWrap: { alignSelf: 'center' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  avatarHint: { textAlign: 'center', ...typography.caption, color: colors.textMuted, marginVertical: spacing.sm },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  switchLabel: { ...typography.body, fontWeight: '600' },
  submit: { marginTop: spacing.xl },
})
