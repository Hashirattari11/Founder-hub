import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { Button, Field, Screen } from '@/components/ui'
import { colors, spacing, typography } from '@/theme'
import { APP_SCHEME } from '@/lib/config'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const onSubmit = async () => {
    if (!email) {
      Alert.alert('Missing email')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${APP_SCHEME}://reset-password`,
      })
      if (error) throw error
      Alert.alert('Check your email', 'We sent you a password reset link')
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>Enter your email and we will send you a reset link.</Text>

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <Button title="Send Reset Link" onPress={onSubmit} loading={loading} style={styles.submit} />

            <View style={styles.footer}>
              <Link href="/(auth)/login" style={styles.link}>
                Back to sign in
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  title: { ...typography.title },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xl },
  submit: { marginTop: spacing.sm },
  link: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
})
