import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { Screen, Button, Field, Header, Loading, SectionHeader } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { getJob, incrementJobViews, applyToJob, getMyJobApplications } from '@/lib/jobs'
import { colors, radius, spacing, typography } from '@/theme'
import type { Job } from '@/types'

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [applied, setApplied] = useState(false)
  const [showApply, setShowApply] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const j = await getJob(id)
    setJob(j)
    if (j) incrementJobViews(id, j.views_count).catch(() => {})
    if (session?.user.id) {
      const apps = await getMyJobApplications(session.user.id)
      if (apps.some((a) => a.job_id === id)) setApplied(true)
    }
  }, [id, session?.user.id])

  useEffect(() => {
    load()
  }, [load])

  const apply = async (cover: string) => {
    if (!session?.user.id) return
    try {
      await applyToJob({ jobId: id!, applicantId: session.user.id, coverLetter: cover })
      setApplied(true)
      setShowApply(false)
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not apply')
    }
  }

  if (!job) {
    return (
      <Screen>
        <Loading />
      </Screen>
    )
  }

  const isOwner = job.posted_by === session?.user.id

  return (
    <Screen>
      <Header title="Job" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.cover}>
          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.company}>{job.startups?.name ?? job.profiles?.full_name ?? 'Company'}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{job.job_type?.replace('_', ' ')}</Text>
            <Text style={styles.meta}>{job.is_remote ? 'Remote' : job.location ?? 'On-site'}</Text>
            <Text style={styles.meta}>{job.experience_level}</Text>
          </View>
          {job.salary_min != null && (
            <Text style={styles.salary}>${job.salary_min.toLocaleString()} - ${job.salary_max?.toLocaleString() ?? '∞'}</Text>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.md }}>
          <SectionHeader title="About the role" />
          <Text style={styles.description}>{job.description}</Text>

          {job.requirements?.length ? (
            <>
              <SectionHeader title="Requirements" />
              {job.requirements.map((r, i) => (
                <Text key={i} style={styles.bullet}>• {r}</Text>
              ))}
            </>
          ) : null}

          {job.skills_required?.length ? (
            <>
              <SectionHeader title="Skills" />
              <View style={styles.skills}>
                {job.skills_required.map((s) => (
                  <View key={s} style={styles.skill}>
                    <Text style={styles.skillText}>{s}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {job.industry ? <Text style={styles.industry}>Industry: {job.industry}</Text> : null}
        </View>

        {!isOwner && !applied && (
          <View style={styles.applyWrap}>
            <Button title="Apply Now" onPress={() => setShowApply(true)} />
          </View>
        )}
        {applied && <Text style={styles.applied}>You have applied for this job ✓</Text>}
      </ScrollView>

      <ApplyJobModal visible={showApply} onClose={() => setShowApply(false)} onApply={apply} />
    </Screen>
  )
}

function ApplyJobModal({
  visible,
  onClose,
  onApply,
}: {
  visible: boolean
  onClose: () => void
  onApply: (cover: string) => void
}) {
  const [cover, setCover] = useState('')

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <Header title="Apply" right={<Button title="Close" variant="ghost" onPress={onClose} />} />
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Field
            label="Cover letter"
            value={cover}
            onChangeText={setCover}
            placeholder="Introduce yourself and why you're a good fit..."
            multiline
            numberOfLines={6}
          />
          <Button title="Submit Application" onPress={() => onApply(cover)} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </Screen>
    </Modal>
  )
}

const styles = StyleSheet.create({
  cover: { padding: spacing.lg, backgroundColor: colors.card },
  title: { ...typography.title },
  company: { ...typography.subheading, color: colors.primary, marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  meta: { ...typography.small, color: colors.textSecondary, backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 3, overflow: 'hidden' },
  salary: { ...typography.subheading, color: colors.success, marginTop: spacing.md },
  description: { ...typography.body, lineHeight: 22, paddingHorizontal: spacing.md },
  bullet: { ...typography.body, color: colors.text, marginBottom: spacing.xs, paddingHorizontal: spacing.md },
  skills: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm },
  skill: { backgroundColor: colors.primaryLight, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  skillText: { ...typography.caption, color: colors.primaryDark, fontWeight: '600' },
  industry: { ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.md, marginTop: spacing.md },
  applyWrap: { padding: spacing.lg },
  applied: { textAlign: 'center', color: colors.success, fontWeight: '700', marginTop: spacing.md },
})
