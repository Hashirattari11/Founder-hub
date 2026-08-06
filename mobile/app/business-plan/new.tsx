import React, { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Button, Chip, Field, Header, Screen } from '@/components/ui'
import { BUSINESS_MODELS, PLAN_STAGES, generateBusinessPlan } from '@/lib/businessPlan'
import { colors, spacing, typography } from '@/theme'
import type { BusinessModel, PlanStage } from '@/types/businessPlan'

function toNumber(value: string): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) && value.trim() !== '' ? n : undefined
}

export default function NewBusinessPlan() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [idea, setIdea] = useState('')
  const [industry, setIndustry] = useState('')
  const [country, setCountry] = useState('')
  const [audience, setAudience] = useState('')
  const [stage, setStage] = useState<PlanStage>('idea')
  const [model, setModel] = useState<BusinessModel>('saas')
  const [funding, setFunding] = useState('')
  const [budget, setBudget] = useState('')
  const [team, setTeam] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const validate = (): boolean => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Give your startup a name.')
      return false
    }
    if (!idea.trim() || idea.trim().length < 20) {
      Alert.alert('Missing idea', 'Describe your idea in at least a few sentences.')
      return false
    }
    return true
  }

  const onSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const plan = await generateBusinessPlan({
        startup_name: name.trim(),
        idea: idea.trim(),
        industry: industry.trim() || undefined,
        country: country.trim() || undefined,
        target_audience: audience.trim() || undefined,
        stage,
        funding_goal: toNumber(funding),
        budget: toNumber(budget),
        team_size: toNumber(team),
        business_model: model,
      })
      router.replace(`/business-plan/${plan.id}`)
    } catch (e) {
      Alert.alert('Generation failed', e instanceof Error ? e.message : 'Could not generate business plan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <Header title="New Business Plan" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Answer a few questions and the generator builds a 30-section plan, 12-slide pitch deck and financial model.
          </Text>

          <Field label="Startup name" value={name} onChangeText={setName} placeholder="e.g. Atlas Logistics" autoCapitalize="words" />
          <Field
            label="The idea *"
            value={idea}
            onChangeText={setIdea}
            placeholder="What are you building, for whom, and why now?"
            multiline
            numberOfLines={4}
            style={styles.multiline}
          />
          <Field label="Industry" value={industry} onChangeText={setIndustry} placeholder="e.g. Logistics" />
          <Field label="Country / market" value={country} onChangeText={setCountry} placeholder="e.g. Kenya" />

          <Text style={styles.fieldLabel}>Stage</Text>
          <View style={styles.chips}>
            {PLAN_STAGES.map((s) => (
              <Chip key={s.value} label={s.label} active={stage === s.value} onPress={() => setStage(s.value as PlanStage)} />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Business model</Text>
          <View style={styles.chips}>
            {BUSINESS_MODELS.map((m) => (
              <Chip key={m.value} label={m.label} active={model === m.value} onPress={() => setModel(m.value as BusinessModel)} />
            ))}
          </View>

          <Field label="Target audience" value={audience} onChangeText={setAudience} placeholder="e.g. SMEs in Nairobi" />

          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Field
                label="Funding goal ($)"
                value={funding}
                onChangeText={setFunding}
                placeholder="e.g. 50000"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.rowHalf}>
              <Field
                label="Monthly budget ($)"
                value={budget}
                onChangeText={setBudget}
                placeholder="e.g. 12000"
                keyboardType="numeric"
              />
            </View>
          </View>

          <Field label="Team size" value={team} onChangeText={setTeam} placeholder="e.g. 3" keyboardType="numeric" />

          <View style={styles.spacer} />
          <Button title="Generate business plan" onPress={onSubmit} loading={submitting} />
          <Text style={styles.hint}>
            Runs free with the built-in engine, or uses your own AI provider key when configured.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg, paddingBottom: 80 },
  intro: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.lg },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  rowHalf: { flex: 1 },
  spacer: { height: spacing.xl },
  hint: { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
})
