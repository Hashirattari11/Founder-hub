import React from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native'
import { useRouter } from 'expo-router'
import { colors, radius, spacing, typography } from '@/theme'
import { initials } from '@/lib/utils'
import type { Role } from '@/types'

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.screen, style]}>{children}</View>
}

export function Header({ title, showBack = true, right }: { title: string; showBack?: boolean; right?: React.ReactNode }) {
  const router = useRouter()
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {showBack && (
          <Pressable hitSlop={8} onPress={() => router.back()}>
            <Text style={styles.headerBack}>‹</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  )
}

interface ButtonProps {
  title: string
  onPress?: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const isDisabled = disabled || loading
  const bg = {
    primary: colors.primary,
    secondary: colors.primaryLight,
    outline: 'transparent',
    danger: colors.danger,
    ghost: 'transparent',
  }[variant]
  const textColor = {
    primary: '#fff',
    secondary: colors.primaryDark,
    outline: colors.primary,
    danger: '#fff',
    ghost: colors.primary,
  }[variant]
  const border = variant === 'outline' ? { borderWidth: 1, borderColor: colors.primary } : undefined

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg },
        border,
        (isDisabled || pressed) && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  )
}

interface FieldProps extends TextInputProps {
  label?: string
  error?: string
}

export function Field({ label, error, style, ...props }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  )
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const inner = <View style={[styles.card, style]}>{children}</View>
  if (onPress) {
    return <Pressable onPress={onPress}>{inner}</Pressable>
  }
  return inner
}

const ROLE_COLORS: Record<Role, string> = {
  founder: '#6D28D9',
  developer: '#2563EB',
  designer: '#DB2777',
  investor: '#059669',
  marketer: '#D97706',
}

export function Avatar({ uri, name, role, size = 44 }: { uri?: string | null; name?: string | null; role?: Role | null; size?: number }) {
  const bg = role ? ROLE_COLORS[role] : colors.primary
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.4, fontWeight: '700' }}>{initials(name)}</Text>
    </View>
  )
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, active ? styles.chipActive : null, pressed && styles.buttonPressed]}
    >
      <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
    </Pressable>
  )
}

export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  )
}

export function EmptyState({ icon, title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.center}>
      {icon ? <Text style={styles.emptyIcon}>{icon}</Text> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

export function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerSide: { width: 44, alignItems: 'flex-start' },
  headerRight: { alignItems: 'flex-end' },
  headerBack: { fontSize: 34, color: colors.primary, lineHeight: 34 },
  headerTitle: { ...typography.heading, flex: 1, textAlign: 'center' },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  fieldWrap: { marginBottom: spacing.md },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { ...typography.small, color: colors.danger, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingLabel: { marginTop: spacing.md, color: colors.textSecondary },
  emptyIcon: { fontSize: 44, marginBottom: spacing.md },
  emptyTitle: { ...typography.subheading, color: colors.text, textAlign: 'center' },
  emptySubtitle: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  sectionHeader: {
    ...typography.subheading,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
})
