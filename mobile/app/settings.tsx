import React, { useState } from 'react'
import { Alert, StyleSheet, Switch, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Header, Button } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/context/NotificationsContext'
import { isBiometricEnabled, setBiometricEnabled } from '@/components/BiometricGate'
import { colors, radius, spacing, typography } from '@/theme'

export default function Settings() {
  const { signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const [biometric, setBiometric] = useState<boolean>(false)
  const [prefs, setPrefs] = useState({
    email: true,
    push: true,
    inApp: true,
  })

  React.useEffect(() => {
    isBiometricEnabled().then(setBiometric).catch(() => {})
  }, [])

  const toggleBiometric = (v: boolean) => {
    setBiometric(v)
    setBiometricEnabled(v).catch(() => {})
  }

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ])
  }

  const Row = ({ icon, label, value, onChange }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  )

  return (
    <Screen>
      <Header title="Settings" />
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <Row icon="finger-print-outline" label="Biometric lock" value={biometric} onChange={toggleBiometric} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Row icon="mail-outline" label="Email notifications" value={prefs.email} onChange={(v) => setPrefs((p) => ({ ...p, email: v }))} />
        <Row icon="notifications-outline" label="Push notifications" value={prefs.push} onChange={(v) => setPrefs((p) => ({ ...p, push: v }))} />
        <Row icon="chatbubble-outline" label="In-app notifications" value={prefs.inApp} onChange={(v) => setPrefs((p) => ({ ...p, inApp: v }))} />
        <Text style={styles.hint}>You have {unreadCount} unread in-app notifications</Text>
      </View>

      <Button title="Sign Out" variant="danger" onPress={confirmSignOut} style={styles.signOut} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sectionTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  rowLabel: { ...typography.body, flex: 1, marginLeft: spacing.md },
  hint: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  signOut: { marginHorizontal: spacing.md, marginTop: spacing.xl },
})
