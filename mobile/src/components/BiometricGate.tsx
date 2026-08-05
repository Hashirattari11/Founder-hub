import React, { useEffect, useState, useCallback } from 'react'
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { colors, radius, spacing, typography } from '@/theme'

const BIOMETRIC_PREF = 'biometric_enabled'

export async function isBiometricEnabled() {
  try {
    const value = await AsyncStorage.getItem(BIOMETRIC_PREF)
    return value === 'true'
  } catch {
    return false
  }
}

export async function setBiometricEnabled(enabled: boolean) {
  try {
    await AsyncStorage.setItem(BIOMETRIC_PREF, enabled ? 'true' : 'false')
  } catch {
    // ignore
  }
}

export function BiometricGate({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false)
  const [checking, setChecking] = useState(true)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    ;(async () => {
      const isEnabled = await isBiometricEnabled()
      setEnabled(isEnabled)
      if (isEnabled) setLocked(true)
      setChecking(false)
    })()
  }, [])

  const unlock = useCallback(async () => {
    const hardware = await LocalAuthentication.hasHardwareAsync()
    if (!hardware) {
      setLocked(false)
      return
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock FounderHub',
      cancelLabel: 'Cancel',
    })
    if (result.success) {
      setLocked(false)
    } else {
      Alert.alert('Locked', 'Biometric verification failed')
    }
  }, [])

  if (checking) return null

  return (
    <>
      {children}
      {enabled && locked && (
        <Modal transparent animationType="fade" onRequestClose={() => {}}>
          <View style={styles.overlay}>
            <View style={styles.card}>
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.title}>FounderHub is locked</Text>
              <Text style={styles.subtitle}>Use biometrics to unlock the app</Text>
              <Pressable style={styles.button} onPress={unlock}>
                <Text style={styles.buttonText}>Unlock</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', width: '100%' },
  lockIcon: { fontSize: 48, marginBottom: spacing.md },
  title: { ...typography.heading, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xl, textAlign: 'center' },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl },
  buttonText: { color: '#fff', fontWeight: '700' },
})
