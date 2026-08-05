import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { Button, Chip, Field, Screen } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/theme'
import { ROLE_OPTIONS, type Role } from '@/types'

export default function Register() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [role, setRole] = useState<Role>('founder')
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Missing fields', 'Fill in all required fields')
      return
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters')
      return
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role },
        },
      })
      if (error) throw error
      if (data.session) {
        router.replace('/')
      } else {
        Alert.alert('Check your email', 'Verify your account to continue')
        router.replace('/(auth)/login')
      }
    } catch (error) {
      Alert.alert('Sign up failed', error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Start building your startup in minutes.</Text>

            <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" autoComplete="name" />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Min 6 characters"
              secureTextEntry
              autoCapitalize="none"
            />
            <Field
              label="Confirm Password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat password"
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.roleLabel}>I am a...</Text>
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={role === option.value}
                  onPress={() => setRole(option.value)}
                />
              ))}
            </View>
            <Text style={styles.roleDesc}>{ROLE_OPTIONS.find((o) => o.value === role)?.description}</Text>

            <Button title="Create Account" onPress={onSubmit} loading={loading} style={styles.submit} />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" style={styles.link}>
                Sign in
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl },
  title: { ...typography.title, marginTop: spacing.md },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xl },
  roleLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.sm },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap' },
  roleDesc: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.lg },
  submit: { marginTop: spacing.sm },
  link: { color: colors.primary, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textSecondary },
})
