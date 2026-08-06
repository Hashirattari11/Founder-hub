import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Screen, Header, Button } from '@/components/ui'
import { getAIStudioConfig, runAIStudioTool } from '@/lib/aiStudio'
import { colors, radius, spacing, typography } from '@/theme'
import type { RunToolResult, StudioTool } from '@/types/aiStudio'

export default function AIStudioTool() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const router = useRouter()
  const [tool, setTool] = useState<StudioTool | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunToolResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getAIStudioConfig()
      .then((cfg) => {
        if (!active) return
        const t = cfg.tools.find((x) => x.slug === slug)
        if (t) {
          setTool(t)
          const init: Record<string, string> = {}
          for (const f of t.fields) {
            if (f.options && f.options.length) init[f.key] = f.options[0]
          }
          setValues(init)
        } else {
          setConfigError('Tool not found')
        }
      })
      .catch((err: Error) => {
        if (active) setConfigError(err.message)
      })
    return () => {
      active = false
    }
  }, [slug])

  const run = useCallback(async () => {
    if (!tool) return
    const missing = tool.fields.filter((f) => f.required && !(values[f.key] ?? '').trim())
    if (missing.length) {
      setRunError(`Missing required: ${missing.map((f) => f.label).join(', ')}`)
      return
    }
    setRunning(true)
    setRunError(null)
    setResult(null)
    try {
      setResult(await runAIStudioTool(tool.slug, values))
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Run failed')
    } finally {
      setRunning(false)
    }
  }, [tool, values])

  if (configError) {
    return (
      <Screen>
        <Header title="Tool" />
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{configError}</Text>
          <Button title="Back" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
        </View>
      </Screen>
    )
  }

  if (!tool) {
    return (
      <Screen>
        <Header title="Tool" />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <Header title={tool.name} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.desc}>{tool.description}</Text>

          {tool.fields.length > 0 && (
            <View style={styles.form}>
              {tool.fields.map((f) => (
                <View key={f.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>
                    {f.label}
                    {f.required ? <Text style={styles.required}> *</Text> : null}
                  </Text>
                  {f.type === 'select' && f.options?.length ? (
                    <View style={styles.selectRow}>
                      {f.options.map((opt) => {
                        const selected = (values[f.key] ?? '') === opt
                        return (
                          <Pressable
                            key={opt}
                            onPress={() => setValues((v) => ({ ...v, [f.key]: opt }))}
                            style={[styles.option, selected ? styles.optionActive : null]}
                          >
                            <Text style={[styles.optionText, selected ? styles.optionTextActive : null]}>{opt}</Text>
                          </Pressable>
                        )
                      })}
                    </View>
                  ) : (
                    <TextInput
                      value={values[f.key] ?? ''}
                      onChangeText={(t) => setValues((v) => ({ ...v, [f.key]: t }))}
                      placeholder={f.placeholder || f.label}
                      placeholderTextColor={colors.textMuted}
                      multiline={f.type === 'textarea'}
                      numberOfLines={f.type === 'textarea' ? 4 : 1}
                      keyboardType={f.type === 'number' ? 'numeric' : 'default'}
                      style={[styles.input, f.type === 'textarea' ? styles.inputMultiline : null]}
                    />
                  )}
                </View>
              ))}
            </View>
          )}

          <Button
            title={running ? 'Generating…' : 'Generate'}
            onPress={run}
            loading={running}
            disabled={running}
            style={styles.runBtn}
          />

          {runError ? <Text style={styles.errorText}>{runError}</Text> : null}

          {result ? (
            <View style={styles.resultBox}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>{result.title || tool.name}</Text>
                {result.provider ? (
                  <View style={styles.providerPill}>
                    <Ionicons name="sparkles-outline" size={12} color={colors.primary} />
                    <Text style={styles.providerText}>{result.provider}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.output}>{result.output}</Text>
              <Text style={styles.latency}>{(result.latency_ms / 1000).toFixed(1)}s</Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  desc: { ...typography.body, color: colors.textSecondary, paddingHorizontal: spacing.md, marginTop: spacing.md, lineHeight: 21 },
  form: { marginTop: spacing.lg },
  field: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  required: { color: colors.danger },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  inputMultiline: { minHeight: 100 },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { ...typography.caption, color: colors.textSecondary },
  optionTextActive: { color: '#fff', fontWeight: '600' },
  runBtn: { marginHorizontal: spacing.md, marginTop: spacing.md },
  errorText: { ...typography.body, color: colors.danger, textAlign: 'center', paddingHorizontal: spacing.md, marginTop: spacing.md },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  resultBox: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  resultTitle: { ...typography.subheading, flex: 1 },
  providerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  providerText: { color: colors.primaryDark, fontSize: 11, fontWeight: '600' },
  output: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.md,
    lineHeight: 21,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  latency: { ...typography.small, color: colors.textMuted, marginTop: spacing.md, textAlign: 'right' },
})
